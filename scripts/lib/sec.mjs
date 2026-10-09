// SEC EDGAR helpers. Uses the free JSON APIs on data.sec.gov with a declared
// User-Agent as SEC fair-access rules require (<=10 requests/sec, identify yourself):
// https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data
// Set SEC_USER_AGENT="Name contact@email" to override the default.
export const SEC_UA = process.env.SEC_USER_AGENT || "CaptainFeed paper-research firstmate@captain.local";
const H = { "User-Agent": SEC_UA, "Accept-Encoding": "gzip, deflate" };
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
let tickerMap = null;

export async function cikFor(symbol) {
  if (!tickerMap) {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", { headers: H });
    if (!res.ok) throw new Error(`company_tickers.json HTTP ${res.status}`);
    tickerMap = {};
    for (const v of Object.values(await res.json())) tickerMap[v.ticker.toUpperCase()] = { cik: v.cik_str, name: v.title };
  }
  return tickerMap[symbol.toUpperCase()] || null;
}

export const WATCH_FORMS = ["8-K", "10-Q", "10-K", "4", "6-K", "20-F", "SC 13D", "SC 13G"];

/** Recent filings for a ticker since `sinceDate` (YYYY-MM-DD). ETFs usually return null (not operating companies). */
export async function recentFilings(symbol, { sinceDate, forms = WATCH_FORMS, limit = 12 } = {}) {
  const hit = await cikFor(symbol);
  if (!hit) return { symbol, cik: null, note: "No operating-company CIK (ETF or unmapped ticker); no EDGAR company filings.", filings: [] };
  const cik10 = String(hit.cik).padStart(10, "0");
  const url = `https://data.sec.gov/submissions/CIK${cik10}.json`;
  await sleep(150); // stay well under 10 req/s
  const res = await fetch(url, { headers: H });
  if (!res.ok) throw new Error(`${symbol} submissions HTTP ${res.status}`);
  const j = await res.json();
  const r = j.filings?.recent || {};
  const out = [];
  for (let i = 0; i < (r.form || []).length; i++) {
    if (sinceDate && r.filingDate[i] < sinceDate) break; // newest-first
    if (!forms.includes(r.form[i])) continue;
    const acc = r.accessionNumber[i].replaceAll("-", "");
    out.push({
      form: r.form[i],
      filingDate: r.filingDate[i],
      reportDate: r.reportDate[i] || null,
      items: r.items?.[i] || "",
      description: r.primaryDocDescription?.[i] || "",
      url: `https://www.sec.gov/Archives/edgar/data/${hit.cik}/${acc}/${r.primaryDocument[i]}`,
    });
    if (out.length >= limit) break;
  }
  return { symbol, cik: hit.cik, name: j.name || hit.name, submissionsUrl: url, filings: out };
}

export const EIGHT_K_ITEMS = {
  "1.01": "Material agreement", "2.02": "Results of operations", "2.05": "Exit/restructuring costs",
  "5.02": "Officer/director change", "5.07": "Shareholder vote", "7.01": "Reg FD disclosure",
  "8.01": "Other events", "9.01": "Exhibits", "2.01": "Acquisition/disposition", "1.05": "Cybersecurity incident",
};
