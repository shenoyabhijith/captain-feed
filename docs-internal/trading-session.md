# Market watch check runbook (PAPER ONLY)

Traders pick their own timing. There are no fixed trading sessions any more: a
scheduled **market watch check** runs about every 20 minutes during regular US
market hours, and each trader decides for itself whether anything is worth doing.
Paper money only: **never connect a brokerage, never place a real order, never touch
real cash.** `scripts/paper-order.mjs` is the only thing that may change sleeve cash or
positions during market hours. `scripts/eod-mark.mjs` only marks positions to market.

Rule of thumb: **holding is the default.** A trade needs a real, written edge that beats
its costs by 3×. Frugal beats busy; ~1–3 trades a day per trader is plenty, and many
days should have none.

## Schedule (America/Chicago, market days only)

| Job               | Time (CT)                   | What it does |
|-------------------|-----------------------------|--------------|
| Pre-market plan   | ~8:00 (optional)            | Full research per trader, `decision.action = plan`. Plan items say *what* and *under which conditions*, not a clock time. |
| Market watch check| every ~20 min, 8:30–3:00    | Cheap scan → escalate only the traders with something new → research → decide (usually hold). Last check that may open a position ~2:50 CT. |
| EOD mark          | 4:34                        | `node scripts/firstmate-run.mjs` → `eod-mark.mjs` (marks + daily P&L, no trades). |

Holidays and half-days: `paper-order.mjs` rejects any fill outside Yahoo's
`currentTradingPeriod.regular` window, so a check on a closed market turns into nothing.
Pre-check: if `scan` reports `marketOpen: false`, stop.

## Each check

### 1. Cheap scan (no X calls)

```bash
node scripts/research-kit.mjs scan --quiet     # or without --quiet for full JSON
```

The scan quotes every holding and watchlist symbol (Yahoo, ~15 min delayed), live SPY
and VIX, checks open order targets and stops, today's pending plan items, and new
8-K / Form 4 filings (last 2 days) for stock holdings. It writes
`data/trading/research/<date>/_scan-latest.json` (git-ignored) and remembers which
triggers it has already seen today, so a trigger escalates **once**, not every 20 min.

Triggers (per trader):
- price hits a recorded `target` or `stop` on an open position;
- big move today: |Δ| ≥ 2% for a stock, ≥ 1.25% for an ETF (re-fires at each further step);
- a ≥ 1% move since the previous scan;
- market-wide: SPY ±1.5% on the day, VIX ±10%, SPY crossing its 200-day intraday;
- a new 8-K or Form 4 for a holding;
- a pending plan item from today's research that has not been filled.

`ESCALATE` = at least one **new** trigger. `quiet` traders do nothing this check.

### 2. Pending plan items (still cheap)

`pendingPlan` lists today's planned items without a fill (e.g. Mega's AAPL trim, Value's
VXUS buy). Each check, judge their **timing** from the scan data alone: is the plan's
condition met, and is now a reasonable moment (not chasing a spike, not into a gap, quote
not stale)? If yes, execute against the **same-day research record that planned it**
(its `selected` idea is the rationale; no new X reads needed), adding a one-line timing
note to that record's `decision.reasoning`. If the plan's premise looks broken by news,
escalate to step 3 instead. Don't wait for a specific clock time, and don't force it:
an unfilled plan simply expires at the close.

### 3. Fresh research — only for escalated traders

```bash
node scripts/research-kit.mjs init --trader mega --check now --trigger "AAPL -3.1% on supplier report" [--symbols AMD,ORCL]
# → data/trading/research/<YYYY-MM-DD>/mega-check-HHMM.json   (HHMM = Central time)
```

The record covers holdings + watchlist + any `--symbols`, with indicators, regime (20-min
shared cache `_regime-check.json`) and an EDGAR scan for operating companies. Then:

1. **X** (`search_posts_all`, `get_posts_by_id`): focused on the trigger: cashtags,
   `from:` lists of credible accounts, `is:verified`. Attach only posts you actually read:
   `research-kit.mjs add-source --file <record> --type x --title … --url … --author @… --published … --takeaway …`
2. **Web** (WebSearch, then WebFetch what you cite) with `--type web`. Prefer primary or
   wire reporting (Reuters, CNBC, company IR, agencies) over aggregators.
3. **SEC** filings that could matter (8-K items 2.02/1.01/5.02/8.01, 10-Q/10-K, unusual
   Form 4s, *not* routine 10b5-1 sales). Fetch with `SEC_USER_AGENT` and attach as `--type sec`.
4. **Reasoning** in the record: `ideas[]` (`selected|watch|rejected`, `thesis` or
   `whyRejected`, `sourceIds`), `decision` (`trade|hold|plan`, summary, reasoning,
   confidence), `risks[]`. Plan items: `{symbol, side, size, trigger}` with a
   *condition*, not a time.
5. `node scripts/research-kit.mjs validate <record>`.

### 4. Decide (hold is the default)

Trade only when **all** hold:
- the setup fits the persona (style guidance below);
- expected edge ≥ **3×** the estimated round-trip cost (below);
- you can name a target, a stop or invalidation, and a horizon;
- it is not a repeat of something already done today without new information.

```bash
node scripts/paper-order.mjs --trader mega --side sell --symbol AAPL --notional 10 \
  --research <date>-mega-check-1115 --confidence 0.66 \
  --rationale "Trim AAPL toward the 25% cap; see research ideas[AAPL]" \
  --target 320 --stop 352 --horizon "1-2 weeks" [--invalidation "…"]
# buys: --notional or --qty; sells: --frac 0.3, --qty or --notional
```

Always `--dry` first, read the edge block, then run for real. A rejection is final for
that check: record why in `decision.reasoning` and set `action` to `hold`.

### 5. Build, commit, push (only when a record or fill changed)

```bash
npm run build          # prebuild runs research-kit index → public/data/trading-index.json
git add data docs scripts && git commit -m "TRADING: <date> check HHMM (paper)" && git push
```

Quiet checks commit nothing. Confirm the Research view on
https://shenoyabhijith.github.io/captain-feed/#/finances/research.

## What `paper-order.mjs` enforces

**Freedom (2026-10-09, user granted timing freedom):**
- Any time during regular US market hours. No sessions, no Swing pre-close rule.
- Any **US-listed stock or ETF** (Nasdaq/NYSE/NYSE American/NYSE Arca/Cboe, USD).
  Watchlists are only the default scan universe. Buying outside a trader's watchlist or
  usual instrument type needs `--persona-fit "…"`.
- No hard order-count cap.

**Hard guardrails (unchanged in spirit):**
- Long-only, cash-only: no margin, shorting, options, or leveraged/inverse ETFs; sells are
  capped at the position held; cash may never go negative.
- Concentration caps: Mega 25%/name, Swing 25%/name, Value 70%/fund, CoreSat 85% core with
  satellites ≤ 30% combined, RiskOff equity ≤ 40% and only while SPY > 200-day. **Any single
  stock is capped at 25% in every sleeve.**
- Same-day research record for this trader with X, web and market sources and a
  `selected` idea for the symbol and side, with a thesis.
- Swing confidence ≥ 0.65; Value sells need `--override-reason`.

**Frugality / edge rule:**
- Required on every order: `--target <price>` or `--expected-move-pct <n>`;
  `--stop <price>` and/or `--invalidation "…"`; `--horizon "…"`.
- Round-trip cost = slippage on entry and exit (5 bps each) + fees on both legs (buy $0;
  sell = SEC Section 31 + FINRA TAF, each rounded up to the cent).
- Expected edge = notional × expected move. **Reject if edge < 3 × round-trip cost.**
  With ~$10 tickets the $0.01 fee floor makes the round trip ≈ 0.2%, so you need ≥ ~0.6%
  expected. Bigger tickets are cheaper in % terms; tiny trades rarely pay.
- Exemption: a sell that only brings an over-cap position back toward its cap (risk
  control) is allowed with a recorded warning.
- Frequency: daily/weekly trade counts, turnover and costs per trader are recorded on each
  order and shown in the Research desk. Above **3 trades/day or 10/week** a trader gets a
  soft warning and must add `--frequency-reason "…"` (≥ 20 chars), otherwise rejected.

## Persona style guidance

| Trader  | Fits | Leans |
|---------|------|-------|
| Mega    | US mega-caps (largest ~10) | equal-weight, patient, trims to caps |
| Value   | broad low-cost index ETFs  | DCA, buys, rarely sells; years-long horizon |
| CoreSat | VOO/VTI core + tech/semi satellite | 70–80% core |
| RiskOff | bond/T-bill ETFs; broad equity only above SPY 200-day | high skip rate |
| Swing   | liquid US tech/semis, 3–15 days | rare, high-bar, conf ≥ 0.65 |

## Budgets and rate limits

- **X tools: 1,000 reads/day and 30/min, shared with the Builders job and every other
  agent.** Trading budget: **≤ 40 X reads per check, ≤ 600 per day** across all checks.
  The scan itself uses **0**. Typical escalation: 2–3 searches + a few `get_posts_by_id`
  per escalated trader. Keep a running count in the check (sum of X calls) and stop X
  research for the day at 600; trade only from existing same-day research after that.
  Run escalated traders one after another, not in parallel.
- **SEC EDGAR:** ≤ 10 requests/second with a declared User-Agent (kit sleeps 150 ms between calls).
- **Yahoo chart API:** unofficial; one quote per symbol per scan (~25 symbols). Retries 3×. Do not hammer it.
- Never invent a source. If a fetch fails, leave it out and note the gap in `risks`.

## Backward compatibility

Records from before this change use `session: premarket|open|midday|preclose` and file
names `<trader>-<session>.json`; they still validate, still back orders as same-day
research, and still render (labelled by session). New records use `session: "check"`,
`checkAt` (ISO) and `<trader>-check-HHMM.json`. `--session` on `paper-order.mjs` is
accepted but only recorded as `legacySession`.

## Fees (sources cited in `scripts/lib/broker.mjs`)

- Commission: $0 for online US stocks and ETFs (Schwab pricing page).
- SEC Section 31: $20.60 per $1M of sells since 2026-04-04 (SEC fee rate advisory FY2026).
- FINRA TAF: $0.000195/share, max $9.79, **paused to $0 from 2026-10-01 to 2026-12-31**
  (SR-FINRA-2026-021). The 2027 schedule is $0.000232/share, max $11.61.
- Each regulatory fee is rounded up to the cent per trade; slippage defaults to 5 bps.
