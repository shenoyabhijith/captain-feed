#!/usr/bin/env node
// Firstmate Run (PAPER ONLY) — kept as the 4:34 PM CT entry point for the
// existing schedule. Since 2026-10-09 it ONLY marks to market and records daily
// P&L; the old rule-engine trades were removed. Trading happens in research-driven
// market-watch checks (see docs-internal/trading-session.md, scripts/paper-order.mjs).
// Usage: node scripts/firstmate-run.mjs [--date YYYY-MM-DD] [--dry]
await import("./eod-mark.mjs");
