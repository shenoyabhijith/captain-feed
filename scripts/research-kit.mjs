#!/usr/bin/env node
// Research kit for paper traders (PAPER ONLY). Gathers market data + SEC filings,
// scaffolds and validates research records, and builds the dashboard index.
//
//   node scripts/research-kit.mjs regime                       # market regime JSON
//   node scripts/research-kit.mjs symbols NVDA SMH ...          # indicators
//   node scripts/research-kit.mjs sec AAPL MSFT --days 21       # EDGAR filings
//   node scripts/research-kit.mjs scan [--quiet]                # cheap market-watch scan (no X)
//   node scripts/research-kit.mjs init --trader mega [--check now|ISO] [--symbols X,Y] [--date YYYY-MM-DD]
//        (legacy: --session open|midday|preclose|premarket still works for old-style records)
//   node scripts/research-kit.mjs add-source --file F --type x|web|sec|market \
//        --title T --url U --takeaway K [--author A] [--symbols NVDA,AMD] [--published ISO]
//   node scripts/research-kit.mjs validate [FILE ...]           # default: all records
//   node scripts/research-kit.mjs index                         # data/trading/index.json
//
// X and web research are done by the agent (x tools / web search) and attached
// with add-source or by editing the JSON. Never invent sources: every entry must
// be something the agent actually opened and read.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dailyHistory, indicators, latestQuote, SECTOR_ETFS } from "./lib/market.mjs";
import { recentFilings, EIGHT_K_ITEMS } from "./lib/sec.mjs";
import { PERSONAS, SESSIONS, TRADER_IDS, CHECK, FRUGALITY, activity, etDate, ctHHMM } from "./lib/personas.mjs";
import { sleeveNav } from "../src/finances/simEngine.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TR = path.join(root, "data/trading");
const RESEARCH = path.join(TR, "research");
const STRATS = path.join(TR, "strategies");
const SOURCE_TYPES = ["x", "web", "sec", "market"];

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const positional = () => argv.slice(1).filter((a, i, all) => !a.startsWith("--") && !(all[i - 1] || "").startsWith("--"));
const etToday = () => etDate();
const BROAD_ETFS = ["VOO", "VTI", "VXUS", "BND", "QQQ", "SMH", "SOXX", "VGT", "XLK", "SPY", "IVV", "AGG", "SGOV", "BIL"];
const LEDGER = path.join(root, "data/finances-ledger.json");
const ledgerNow = () => (fs.existsSync(LEDGER) ? readJson(LEDGER) : { sleeves: [], decisions: [], marks: {} });
const holdingsOf = (ledger, trader) => ((ledger.sleeves || []).find((s) => s.id === trader)?.positions || []).map((x) => x.symbol);
const nowIso = () => new Date().toISOString();
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJson = (p, o) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(o, null, 2) + "\n"); };

async function symbolsIndicators(list) {
  const out = [];
  for (const s of list) {
    try { out.push(indicators(await dailyHistory(s, "2y"))); }
    catch (e) { out.push({ symbol: s, error: String(e.message || e) }); }
  }
  return out;
}

export async function regime() {
  const [spy, qqq] = await symbolsIndicators(["SPY", "QQQ"]);
  const vixH = await dailyHistory("^VIX", "3mo");
  const vix = indicators(vixH);
  const tnx = indicators(await dailyHistory("^TNX", "3mo"));
  const irx = indicators(await dailyHistory("^IRX", "3mo"));
  const sectors = (await symbolsIndicators(Object.keys(SECTOR_ETFS)))
    .map((x) => ({ symbol: x.symbol, name: SECTOR_ETFS[x.symbol], chg1dPct: x.chg1dPct, chg5dPct: x.chg5dPct, chg20dPct: x.chg20dPct, vsSma50Pct: x.vsSma50Pct }))
    .sort((a, b) => (b.chg5dPct ?? 0) - (a.chg5dPct ?? 0));
  const trend = spy.vsSma200Pct > 0 ? (spy.vsSma50Pct > 0 ? "uptrend" : "pullback in uptrend") : (spy.vsSma50Pct > 0 ? "bear-market rally" : "downtrend");
  const vol = vix.last < 15 ? "calm" : vix.last < 20 ? "normal" : vix.last < 28 ? "elevated" : "stressed";
  const label = `${trend} · ${vol} vol`;
  return {
    asOf: spy.asOf,
    label,
    riskOn: spy.vsSma200Pct > 0,
    spy, qqq,
    vix: { last: vix.last, chg1dPct: vix.chg1dPct, chg5dPct: vix.chg5dPct, sma50: vix.sma50 },
    rates: { us10y: tnx.last, us10yChg5dPct: tnx.chg5dPct, us13w: irx.last },
    sectors,
    leaders: sectors.slice(0, 3).map((s) => s.symbol),
    laggards: sectors.slice(-3).map((s) => s.symbol),
    summary: `SPY ${spy.last} (${spy.vsSma50Pct >= 0 ? "+" : ""}${spy.vsSma50Pct}% vs 50d, ${spy.vsSma200Pct >= 0 ? "+" : ""}${spy.vsSma200Pct}% vs 200d), QQQ ${qqq.vsSma200Pct >= 0 ? "+" : ""}${qqq.vsSma200Pct}% vs 200d, VIX ${vix.last}, 10y ${tnx.last}%. 5-day leaders ${sectors.slice(0, 3).map((s) => s.symbol).join("/")}, laggards ${sectors.slice(-3).map((s) => s.symbol).join("/")}.`,
    sourceUrls: { yahooChart: "https://query1.finance.yahoo.com/v8/finance/chart/SPY" },
  };
}

export async function secScan(symbols, days = 21) {
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const out = [];
  for (const s of symbols) {
    try { out.push(await recentFilings(s, { sinceDate: since })); }
    catch (e) { out.push({ symbol: s, error: String(e.message || e), filings: [] }); }
  }
  return out;
}

function describeFiling(f) {
  if (f.form === "8-K" && f.items) return `8-K items ${f.items} (${f.items.split(",").map((i) => EIGHT_K_ITEMS[i.trim()] || i).join("; ")})`;
  if (f.form === "4") return "Form 4 insider transaction report";
  return `${f.form}${f.reportDate ? ` for period ${f.reportDate}` : ""}`;
}

async function cmdInit() {
  const trader = opt("trader");
  const legacy = opt("session");
  const date = opt("date", etToday());
  if (!TRADER_IDS.includes(trader)) throw new Error(`--trader must be one of ${TRADER_IDS.join(", ")}`);
  if (legacy && !SESSIONS.includes(legacy)) throw new Error(`--session must be one of ${SESSIONS.join(", ")} (or use --check)`);
  const checkAt = legacy ? null : (opt("check") && opt("check") !== "now" ? new Date(opt("check")) : new Date());
  if (checkAt && Number.isNaN(checkAt.getTime())) throw new Error("--check must be 'now' or an ISO timestamp");
  const suffix = legacy || `${CHECK}-${ctHHMM(checkAt)}`;
  const file = path.join(RESEARCH, date, `${trader}-${suffix}.json`);
  if (fs.existsSync(file) && !argv.includes("--force")) { console.log(`exists: ${path.relative(root, file)}`); return; }
  // Shared regime cache (one fetch for all five traders). Checks share a 20-minute cache.
  const cache = path.join(RESEARCH, date, `_regime-${legacy || CHECK}.json`);
  let reg;
  if (fs.existsSync(cache) && Date.now() - fs.statSync(cache).mtimeMs < (legacy ? 30 : 20) * 60e3) reg = readJson(cache);
  else { reg = await regime(); writeJson(cache, reg); }
  const p = PERSONAS[trader];
  const extra = (opt("symbols") || "").split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);
  const scope = [...new Set([...holdingsOf(ledgerNow(), trader), ...p.watchlist, ...extra])];
  const universe = await symbolsIndicators(scope);
  const sec = await secScan(scope.filter((s) => !BROAD_ETFS.includes(s)), Number(opt("days", 21)));
  const stratFile = path.join(STRATS, `${trader}.json`);
  const strat = fs.existsSync(stratFile) ? readJson(stratFile) : null;
  const t = nowIso();
  const sources = [{
    id: "m1", type: "market", title: `Yahoo Finance daily history: SPY, QQQ, ^VIX, ^TNX, sector ETFs, ${scope.join(", ")}`,
    url: "https://finance.yahoo.com/quote/SPY/history/", retrievedAt: t,
    takeaway: reg.summary,
  }];
  const rec = {
    schema: 2,
    id: `${date}-${trader}-${suffix}`,
    date, session: legacy || CHECK, checkAt: checkAt ? checkAt.toISOString() : null,
    trigger: opt("trigger") || null, // why this check escalated to research (from scan)
    trader, traderName: p.name, agentId: p.agentId,
    createdAt: t, updatedAt: t,
    strategy: strat ? { id: strat.strategyId, version: strat.version, name: strat.name } : null,
    regime: reg,
    universe,
    // Scan results only. Attach a filing as a `sec` source after actually reading it.
    secScan: sec.map((s) => ({ symbol: s.symbol, cik: s.cik, count: (s.filings || []).length, note: s.note || s.error || null, filings: (s.filings || []).map((f) => ({ ...f, label: describeFiling(f) })) })),
    sources,
    ideas: [],
    decision: { action: null, summary: "", reasoning: "", confidence: null },
    risks: [],
    orders: [],
    paperOnly: true,
  };
  writeJson(file, rec);
  console.log(`wrote ${path.relative(root, file)} — add X/web/SEC sources you read, ideas, decision; then validate`);
}

/**
 * Cheap market-watch scan for all traders (no X calls). Quotes holdings + watchlists,
 * checks live SPY/VIX, open order targets/stops, pending plan items, and fresh
 * 8-K/Form 4 filings for stock holdings. Prints triggers per trader; writes
 * data/trading/research/<date>/_scan-latest.json (not indexed).
 */
async function cmdScan() {
  const date = etToday();
  const out0 = () => ctHHMM();
  const ledger = ledgerNow();
  const dir = path.join(RESEARCH, date);
  const prevFile = path.join(dir, "_scan-latest.json");
  const prev = fs.existsSync(prevFile) ? readJson(prevFile) : null;
  const all = new Set(["SPY", "^VIX"]);
  for (const id of TRADER_IDS) for (const s of [...holdingsOf(ledger, id), ...PERSONAS[id].watchlist]) all.add(s);
  const quotes = {};
  for (const s of all) {
    try { const q = await latestQuote(s); quotes[s] = { price: q.price, prevClose: q.previousClose, chgPct: q.previousClose ? Math.round(((q.price - q.previousClose) / q.previousClose) * 10000) / 100 : null, time: q.quoteTime, open: q.marketOpenNow, kind: (q.instrumentType || "").toLowerCase() }; }
    catch (e) { quotes[s] = { error: String(e.message || e) }; }
  }
  const marketOpen = Object.values(quotes).some((q) => q.open);
  const regCache = path.join(dir, `_regime-${CHECK}.json`);
  const reg = fs.existsSync(regCache) ? readJson(regCache) : null;
  const global = [];
  const spy = quotes.SPY, vix = quotes["^VIX"];
  if (reg?.spy?.sma200 && spy?.price) {
    const wasAbove = reg.spy.last > reg.spy.sma200, isAbove = spy.price > reg.spy.sma200;
    if (wasAbove !== isAbove) global.push(`SPY crossed its 200-day (${reg.spy.sma200}) intraday: ${spy.price}`);
  }
  if (vix?.chgPct != null && Math.abs(vix.chgPct) >= 10) global.push(`VIX ${vix.chgPct > 0 ? "+" : ""}${vix.chgPct}% today (${vix.price})`);
  if (spy?.chgPct != null && Math.abs(spy.chgPct) >= 1.5) global.push(`SPY ${spy.chgPct > 0 ? "+" : ""}${spy.chgPct}% today`);
  // Fresh filings for stock holdings (8-K, Form 4) since yesterday.
  const since = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
  const stockHoldings = [...new Set(TRADER_IDS.flatMap((id) => holdingsOf(ledger, id)))].filter((s) => quotes[s]?.kind === "equity");
  const filings = {};
  for (const s of stockHoldings) {
    try { const r = await recentFilings(s, { sinceDate: since, forms: ["8-K", "4"] }); filings[s] = r.filings.map((f) => ({ ...f, label: describeFiling(f) })); }
    catch (e) { filings[s] = []; }
  }
  const todays = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_")).map((f) => readJson(path.join(dir, f))) : [];
  const traders = {};
  const sameDayPrev = prev && prev.date === date ? prev : null;
  for (const id of TRADER_IDS) {
    const p = PERSONAS[id];
    const held = holdingsOf(ledger, id);
    const trig = []; // {key, text}; key decides whether a trigger is new since the last scan
    for (const g of global) trig.push({ key: `global:${g.split(" ")[0]}:${g.includes("crossed") ? "x" : Math.floor(Math.abs(parseFloat(g.match(/-?[\d.]+%/)?.[0] || 0)))}`, text: g });
    for (const s of new Set([...held, ...p.watchlist])) {
      const q = quotes[s];
      if (!q || q.chgPct == null) continue;
      const big = q.kind === "equity" ? 2 : 1.25;
      if (Math.abs(q.chgPct) >= big) trig.push({ key: `move:${s}:${Math.sign(q.chgPct)}${Math.floor(Math.abs(q.chgPct) / big)}`, text: `${s} ${q.chgPct > 0 ? "+" : ""}${q.chgPct}% today${held.includes(s) ? " (held)" : ""}` });
      const pq = sameDayPrev?.quotes?.[s]?.price;
      if (pq && Math.abs((q.price - pq) / pq) >= 0.01) trig.push({ key: `jump:${s}:${out0()}`, text: `${s} moved ${(((q.price - pq) / pq) * 100).toFixed(2)}% since last scan` });
    }
    // Targets / stops on recent orders still held.
    for (const o of (ledger.decisions || []).filter((d) => d.paper && d.trader === id && d.edge && held.includes(d.symbol)).slice(0, 20)) {
      const q = quotes[o.symbol]; if (!q?.price) continue;
      const e = o.edge;
      if (o.side === "buy" && e.target && q.price >= e.target) trig.push({ key: `target:${o.id}`, text: `${o.symbol} hit target ${e.target} (${o.id})` });
      if (o.side === "buy" && e.stop && q.price <= e.stop) trig.push({ key: `stop:${o.id}`, text: `${o.symbol} hit stop ${e.stop} (${o.id})` });
    }
    for (const s of held) for (const f of filings[s] || []) trig.push({ key: `filing:${f.url}`, text: `${s} new ${f.label} filed ${f.filingDate}` });
    // Planned / selected items from today's research that have no fill yet.
    const filled = new Set((ledger.decisions || []).filter((d) => d.paper && d.trader === id && d.tradeDate === date).map((d) => `${d.side}:${d.symbol}`));
    const pending = [];
    for (const r of todays.filter((r) => r.trader === id)) {
      for (const it of r.decision?.plan || []) if (!filled.has(`${it.side}:${it.symbol}`)) pending.push({ ...it, from: r.id });
    }
    const uniq = [...new Map(pending.map((x) => [`${x.side}:${x.symbol}`, x])).values()];
    for (const it of uniq) trig.push({ key: `plan:${it.side}:${it.symbol}`, text: `plan pending: ${it.side} ${it.symbol} ${it.size || ""} (${it.trigger || "no trigger"}; from ${it.from})` });
    const seen = new Set(sameDayPrev?.traders?.[id]?.seenKeys || []);
    const fresh = trig.filter((t) => !seen.has(t.key));
    const nav = (() => { const sl = (ledger.sleeves || []).find((s) => s.id === id); if (!sl) return null; const mk = { ...(ledger.marks || {}) }; for (const [k, v] of Object.entries(quotes)) if (v.price) mk[k] = v.price; return sleeveNav(sl, mk); })();
    traders[id] = {
      name: p.name, held,
      escalate: fresh.length > 0, // only NEW triggers justify fresh X/web/SEC research
      newTriggers: fresh.map((t) => t.text),
      ongoing: trig.filter((t) => seen.has(t.key)).map((t) => t.text),
      seenKeys: [...new Set([...seen, ...trig.map((t) => t.key)])],
      pendingPlan: uniq,
      activity: activity(ledger.decisions, id, date, nav),
    };
  }
  const out = { at: nowIso(), date, marketOpen, quotes, filings, global, traders, xCalls: 0 };
  writeJson(prevFile, out);
  if (argv.includes("--quiet")) {
    for (const [id, t] of Object.entries(traders)) console.log(`${id}: ${t.escalate ? "ESCALATE" : "quiet"}${t.newTriggers.length ? " — new: " + t.newTriggers.join("; ") : ""}${t.ongoing.length ? ` (${t.ongoing.length} ongoing)` : ""}`);
  } else console.log(JSON.stringify({ at: out.at, marketOpen, global, traders: Object.fromEntries(Object.entries(traders).map(([k, { seenKeys, ...v }]) => [k, v])) }, null, 2));
}

function cmdAddSource() {
  const file = opt("file");
  const rec = readJson(file);
  const type = opt("type");
  if (!SOURCE_TYPES.includes(type)) throw new Error(`--type must be ${SOURCE_TYPES.join("|")}`);
  const id = `${type}${rec.sources.filter((s) => s.type === type).length + 1}`;
  const src = { id, type, title: opt("title"), url: opt("url"), retrievedAt: nowIso(), takeaway: opt("takeaway") };
  if (opt("author")) src.author = opt("author");
  if (opt("published")) src.publishedAt = opt("published");
  if (opt("symbols")) src.symbols = opt("symbols").split(",");
  rec.sources.push(src);
  rec.updatedAt = nowIso();
  writeJson(file, rec);
  console.log(`added ${id}`);
}

export function validateRecord(rec) {
  const errs = [], warns = [];
  for (const k of ["id", "date", "session", "trader", "regime", "sources", "ideas", "decision"]) if (rec[k] == null) errs.push(`missing ${k}`);
  if (!TRADER_IDS.includes(rec.trader)) errs.push(`bad trader ${rec.trader}`);
  if (rec.session === CHECK && !rec.checkAt) errs.push("check records need checkAt (ISO time of the check)");
  if (rec.session !== CHECK && !SESSIONS.includes(rec.session)) errs.push(`bad session ${rec.session} (use check)`);
  const types = new Set();
  for (const s of rec.sources || []) {
    if (!SOURCE_TYPES.includes(s.type)) errs.push(`source ${s.id}: bad type ${s.type}`);
    if (!s.url || !/^https?:\/\//.test(s.url)) errs.push(`source ${s.id}: url required`);
    if (!s.retrievedAt) errs.push(`source ${s.id}: retrievedAt required`);
    if (!s.takeaway) (s.auto ? warns : errs).push(`source ${s.id}: takeaway required${s.auto ? " (auto SEC source not yet read)" : ""}`);
    types.add(s.type);
  }
  for (const t of ["market", "x", "web"]) if (!types.has(t)) errs.push(`no ${t} source — research must cover X, web and market data`);
  if (!types.has("sec") && (rec.secScan || []).some((s) => s.cik)) warns.push("operating companies in universe but no SEC source attached");
  const ids = new Set((rec.sources || []).map((s) => s.id));
  for (const i of rec.ideas || []) {
    if (!["selected", "rejected", "watch"].includes(i.status)) errs.push(`idea ${i.symbol}: status must be selected|rejected|watch`);
    if (i.status === "rejected" && !i.whyRejected) errs.push(`idea ${i.symbol}: whyRejected required`);
    for (const sid of i.sourceIds || []) if (!ids.has(sid)) errs.push(`idea ${i.symbol}: unknown source ${sid}`);
  }
  if (!(rec.ideas || []).length) errs.push("no ideas considered");
  const d = rec.decision || {};
  if (!["trade", "hold", "plan"].includes(d.action)) errs.push("decision.action must be trade|hold|plan");
  if (!d.reasoning) errs.push("decision.reasoning required");
  if (d.action === "trade" && !(rec.orders || []).length) warns.push("trade decision without linked orders yet");
  if (!(rec.risks || []).length) warns.push("no risk notes");
  return { errs, warns };
}

function allRecordFiles() {
  if (!fs.existsSync(RESEARCH)) return [];
  const out = [];
  for (const d of fs.readdirSync(RESEARCH).sort()) {
    const dir = path.join(RESEARCH, d);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).sort()) if (f.endsWith(".json") && !f.startsWith("_")) out.push(path.join(dir, f));
  }
  return out;
}

function cmdValidate() {
  const files = positional().length ? positional() : allRecordFiles();
  let bad = 0;
  for (const f of files) {
    const { errs, warns } = validateRecord(readJson(f));
    const rel = path.relative(root, path.resolve(f));
    if (errs.length) { bad++; console.log(`✗ ${rel}\n  - ${errs.join("\n  - ")}`); } else console.log(`✓ ${rel}`);
    for (const w of warns) console.log(`  ! ${w}`);
  }
  if (bad) process.exit(1);
}

/** Bundle research + strategies + linked orders for the dashboard. */
export function buildIndex() {
  const ledgerPath = path.join(root, "data/finances-ledger.json");
  const ledger = fs.existsSync(ledgerPath) ? readJson(ledgerPath) : { decisions: [], marks: {} };
  const orders = Object.fromEntries((ledger.decisions || []).filter((d) => d.researchId).map((d) => [d.id, d]));
  const records = allRecordFiles().map((f) => {
    const r = readJson(f);
    delete r.universe; // keep payload small; full record stays in repo
    r.secScan = (r.secScan || []).map(({ filings, ...rest }) => rest);
    r.orderDetails = (r.orders || []).map((id) => orders[id]).filter(Boolean);
    r.path = path.relative(root, f);
    return r;
  }).sort((a, b) => (b.date + (b.checkAt || b.createdAt || "")).localeCompare(a.date + (a.checkAt || a.createdAt || "")));
  const strategies = {};
  if (fs.existsSync(STRATS)) for (const f of fs.readdirSync(STRATS)) if (f.endsWith(".json")) { const s = readJson(path.join(STRATS, f)); strategies[s.trader] = s; }
  const today = etToday();
  const activityBy = {};
  for (const id of TRADER_IDS) {
    const sl = (ledger.sleeves || []).find((s) => s.id === id);
    activityBy[id] = activity(ledger.decisions, id, today, sl ? sleeveNav(sl, ledger.marks || {}) : null);
  }
  const idx = {
    generatedAt: nowIso(),
    paperOnly: true,
    marks: ledger.marks || {},
    marksAsOf: ledger.meta?.marksAsOf || null,
    traders: TRADER_IDS.map((id) => ({ id, name: PERSONAS[id].name, style: PERSONAS[id].style, fit: PERSONAS[id].fit, watchlist: PERSONAS[id].watchlist, holdings: holdingsOf(ledger, id) })),
    activity: activityBy,
    frugality: FRUGALITY,
    strategies,
    records,
  };
  writeJson(path.join(TR, "index.json"), idx);
  return idx;
}

const cmds = {
  regime: async () => console.log(JSON.stringify(await regime(), null, 2)),
  symbols: async () => console.log(JSON.stringify(await symbolsIndicators(positional()), null, 2)),
  sec: async () => console.log(JSON.stringify(await secScan(positional(), Number(opt("days", 21))), null, 2)),
  quote: async () => { for (const s of positional()) console.log(JSON.stringify(await latestQuote(s))); },
  init: cmdInit,
  scan: cmdScan,
  "add-source": cmdAddSource,
  validate: cmdValidate,
  index: async () => { const i = buildIndex(); console.log(`index: ${i.records.length} records, ${Object.keys(i.strategies).length} strategies`); },
};

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("research-kit.mjs")) {
  if (!cmds[cmd]) { console.error(`usage: research-kit.mjs ${Object.keys(cmds).join("|")}`); process.exit(2); }
  await cmds[cmd]();
}
