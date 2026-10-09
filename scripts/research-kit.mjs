#!/usr/bin/env node
// Research kit for paper traders (PAPER ONLY). Gathers market data + SEC filings,
// scaffolds and validates research records, and builds the dashboard index.
//
//   node scripts/research-kit.mjs regime                       # market regime JSON
//   node scripts/research-kit.mjs symbols NVDA SMH ...          # indicators
//   node scripts/research-kit.mjs sec AAPL MSFT --days 21       # EDGAR filings
//   node scripts/research-kit.mjs init --trader mega --session open [--date YYYY-MM-DD]
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
import { PERSONAS, SESSIONS, TRADER_IDS } from "./lib/personas.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TR = path.join(root, "data/trading");
const RESEARCH = path.join(TR, "research");
const STRATS = path.join(TR, "strategies");
const SOURCE_TYPES = ["x", "web", "sec", "market"];

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k, d = null) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const positional = () => argv.slice(1).filter((a, i, all) => !a.startsWith("--") && !(all[i - 1] || "").startsWith("--"));
const etToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
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
  const session = opt("session");
  const date = opt("date", etToday());
  if (!TRADER_IDS.includes(trader)) throw new Error(`--trader must be one of ${TRADER_IDS.join(", ")}`);
  if (!SESSIONS.includes(session)) throw new Error(`--session must be one of ${SESSIONS.join(", ")}`);
  const file = path.join(RESEARCH, date, `${trader}-${session}.json`);
  if (fs.existsSync(file) && !argv.includes("--force")) { console.log(`exists: ${path.relative(root, file)}`); return; }
  // Shared per-date/session regime cache (one fetch for all five traders).
  const cache = path.join(RESEARCH, date, `_regime-${session}.json`);
  let reg;
  if (fs.existsSync(cache) && Date.now() - fs.statSync(cache).mtimeMs < 30 * 60e3) reg = readJson(cache);
  else { reg = await regime(); writeJson(cache, reg); }
  const p = PERSONAS[trader];
  const universe = await symbolsIndicators(p.allowlist);
  const sec = await secScan(p.allowlist.filter((s) => !["VOO", "VTI", "VXUS", "BND", "QQQ", "SMH", "SOXX", "VGT", "XLK"].includes(s)), Number(opt("days", 21)));
  const stratFile = path.join(STRATS, `${trader}.json`);
  const strat = fs.existsSync(stratFile) ? readJson(stratFile) : null;
  const t = nowIso();
  const sources = [{
    id: "m1", type: "market", title: `Yahoo Finance daily history: SPY, QQQ, ^VIX, ^TNX, sector ETFs, ${p.allowlist.join(", ")}`,
    url: "https://finance.yahoo.com/quote/SPY/history/", retrievedAt: t,
    takeaway: reg.summary,
  }];
  const rec = {
    schema: 1,
    id: `${date}-${trader}-${session}`,
    date, session, trader, traderName: p.name, agentId: p.agentId,
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
  }).sort((a, b) => (b.date + (b.updatedAt || "")).localeCompare(a.date + (a.updatedAt || "")));
  const strategies = {};
  if (fs.existsSync(STRATS)) for (const f of fs.readdirSync(STRATS)) if (f.endsWith(".json")) { const s = readJson(path.join(STRATS, f)); strategies[s.trader] = s; }
  const idx = {
    generatedAt: nowIso(),
    paperOnly: true,
    marks: ledger.marks || {},
    marksAsOf: ledger.meta?.marksAsOf || null,
    traders: TRADER_IDS.map((id) => ({ id, name: PERSONAS[id].name, style: PERSONAS[id].style, allowlist: PERSONAS[id].allowlist, sessions: PERSONAS[id].sessions })),
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
  "add-source": cmdAddSource,
  validate: cmdValidate,
  index: async () => { const i = buildIndex(); console.log(`index: ${i.records.length} records, ${Object.keys(i.strategies).length} strategies`); },
};

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("research-kit.mjs")) {
  if (!cmds[cmd]) { console.error(`usage: research-kit.mjs ${Object.keys(cmds).join("|")}`); process.exit(2); }
  await cmds[cmd]();
}
