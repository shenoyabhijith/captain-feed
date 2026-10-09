# Trading session runbook (PAPER ONLY)

This is what a scheduled run does for each trader in each session. Paper money only:
**never connect a brokerage, never place a real order, never touch real cash.**
`scripts/paper-order.mjs` is the only thing that may change sleeve cash or positions
during market hours. `scripts/eod-mark.mjs` only marks positions to market.

## Schedule (America/Chicago, market days only)

| Session     | Time (CT) | Who trades                  | Notes |
|-------------|-----------|-----------------------------|-------|
| `premarket` | ~8:00     | nobody (research + plan)    | Optional. Decision must be `plan`. |
| `open`      | 9:05      | Mega, Value, CoreSat, RiskOff | 35 min after the open, once opening auction prices settle. |
| `midday`    | 12:35     | Mega, Value, CoreSat, RiskOff | |
| `preclose`  | 2:35      | all, **Swing only trades here** | Swing is a pre-close batch persona (no tick or after-hours trading). |
| EOD mark    | 4:34      | none                        | `node scripts/firstmate-run.mjs` → `eod-mark.mjs` (marks + daily P&L, no trades). |

Holidays and half-days: `paper-order.mjs` rejects any fill outside Yahoo's
`currentTradingPeriod.regular` window, so a run on a closed day turns into research only.

## Per trader, per session

Traders: `mega`, `value`, `coresat`, `riskoff`, `swing`. Read the trader's strategy first:
`data/trading/strategies/<trader>.json`. Persona guardrails live in `scripts/lib/personas.mjs`.

1. **Scaffold and gather kit data** (Yahoo history and indicators, regime, EDGAR scan):
   ```bash
   node scripts/research-kit.mjs init --trader mega --session open
   # → data/trading/research/<YYYY-MM-DD>/mega-open.json
   ```
   The regime snapshot is cached per date and session (`_regime-<session>.json`, 30 min),
   so the five traders share one fetch. `secScan` lists recent 8-K/10-Q/10-K/Form 4 filings
   for operating companies in the allowlist (ETFs have none).
2. **Research X** with the `x` tools (`search_posts_all`; `min_faves` is not available,
   so use `from:` lists of credible accounts, cashtags, and `is:verified`). Open the posts that
   matter and attach only what you actually read:
   ```bash
   node scripts/research-kit.mjs add-source --file <record> --type x \
     --title "…" --url https://x.com/… --author @handle --published <ISO> --takeaway "…"
   ```
3. **Research the web** (WebSearch, then WebFetch the articles you cite). Attach each one
   with `--type web`. Prefer primary or wire reporting (Reuters, CNBC, the agencies) over aggregators.
4. **Read SEC filings** from `secScan` that could matter (8-K items 2.02/1.01/5.02/8.01,
   10-Q/10-K, unusual Form 4s, meaning *not* routine 10b5-1 sales). Fetch with a User-Agent
   (`SEC_USER_AGENT`, default `CaptainFeed paper-research firstmate@captain.local`) and attach with `--type sec`.
5. **Write the reasoning** into the record (edit the JSON):
   - `ideas[]`: every candidate considered: `{symbol, side, status: selected|watch|rejected, thesis | whyRejected, size?, sourceIds[]}`.
   - `decision`: `{action: trade|hold|plan, summary, reasoning, confidence 0..1, plan?[]}`.
   - `risks[]`: what would make this wrong.
   - If the conditions call for a different playbook, bump the strategy doc: increment
     `version`, edit the rules, and append to `history[]` with `{version, date, change, reason, researchId}`.
6. **Validate** (fails without X, web and market sources, without ideas, or without reasoning):
   ```bash
   node scripts/research-kit.mjs validate data/trading/research/<date>/mega-open.json
   ```
7. **Decide and execute.** For `trade`, one call per order:
   ```bash
   node scripts/paper-order.mjs --trader mega --session open --side sell --symbol AAPL \
     --notional 21 --research <date>-mega-open --confidence 0.66 \
     --rationale "Trim AAPL to the 25% cap; see research ideas[AAPL]"
   # sells may use --frac 0.3 (fraction of position) or --qty
   ```
   The executor fills at the latest Yahoo quote (records quote time and age; the free feed
   can lag ~15 min), adds 5 bps slippage, and applies the Schwab fee model
   (`scripts/lib/broker.mjs`). It enforces the allowlist, session, per-day order count,
   name/satellite/equity caps, the SPY 200-day rule for RiskOff equity, Swing's confidence bar,
   Value's no-sell rule, and available cash. It refuses if the research record is missing
   or has no `selected` idea for that symbol. A rejection is final for that session;
   record why in `decision.reasoning` and set `action` to `hold`.
   Use `--dry` to preview. `--allow-closed` only works together with `--dry`.
8. **Build, commit, push**:
   ```bash
   npm run build          # prebuild runs research-kit index → public/data/trading-index.json
   git add data docs scripts && git commit -m "TRADING: <date> <session> research (paper)" && git push
   ```
   Then confirm the Research view on https://shenoyabhijith.github.io/captain-feed/#/finances/research.

## Rate limits and etiquette

- **X tools:** 30 reads/min and 1,000/day, **shared across all agents and jobs**. Budget about
  2–3 searches per trader per session (5 traders × 3 sessions × 3 ≈ 45/day), plus a few
  `get_posts_by_id` reads. Run the traders one after another, not in parallel.
- **SEC EDGAR:** ≤ 10 requests/second with a declared User-Agent (kit sleeps 150 ms between calls).
- **Yahoo chart API:** unofficial; the kit retries 3× with backoff. Do not hammer it.
- Never invent a source. If a fetch fails, leave it out and note the gap in `risks`.

## Fees (sources cited in `scripts/lib/broker.mjs`)

- Commission: $0 for online US stocks and ETFs (Schwab pricing page).
- SEC Section 31: $20.60 per $1M of sells since 2026-04-04 (SEC fee rate advisory FY2026).
- FINRA TAF: $0.000195/share, max $9.79, **paused to $0 from 2026-10-01 to 2026-12-31**
  (SR-FINRA-2026-021). The 2027 schedule is $0.000232/share, max $11.61.
- Each regulatory fee is rounded up to the cent per trade; slippage defaults to 5 bps.
