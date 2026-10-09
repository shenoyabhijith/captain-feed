// Persona guardrails enforced by scripts/paper-order.mjs (PAPER ONLY).
// Rules come from each trader agent's profile (/home/box/agent-data/agents/<id>/profile.json)
// plus the sleeve persona in data/finances-ledger.json. Strategy docs in
// data/trading/strategies/<id>.json may be stricter, never looser.

export const SESSIONS = Object.freeze(["premarket", "open", "midday", "preclose"]);
export const TRADING_SESSIONS = Object.freeze(["open", "midday", "preclose"]);
export const MIN_TICKET = 5;

export const PERSONAS = Object.freeze({
  mega: {
    agentId: "13448089-ec47-4cb6-a320-137295c59509",
    name: "Mega",
    style: "Mega-cap equal-weight; allowlisted mega-caps with concentration caps; monthly-rebalance temperament.",
    allowlist: ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA"],
    maxNamePct: 0.25,
    sessions: ["open", "midday", "preclose"],
    maxOrdersPerDay: 3,
  },
  value: {
    agentId: "1aa5cd22-a8ad-487a-9a73-e159126ef93d",
    name: "Value",
    style: "Bogle / long-term DCA; broad ETFs only (VOO, VTI, VXUS); buys, rarely sells.",
    allowlist: ["VOO", "VTI", "VXUS"],
    maxNamePct: 0.7, // broad index funds may be large; single-stock cap does not apply
    sessions: ["open", "midday", "preclose"],
    maxOrdersPerDay: 1,
    noSells: true, // Bogle: sells require --override-reason (e.g. rebalancing)
  },
  coresat: {
    agentId: "338c1b0c-651e-4410-85af-3de19edb43be",
    name: "CoreSat",
    style: "70–80% broad ETF core (VOO/VTI) + tech/semi ETF satellite.",
    allowlist: ["VOO", "VTI", "QQQ", "SMH", "SOXX", "VGT", "XLK"],
    core: ["VOO", "VTI"],
    maxNamePct: 0.85, // core may exceed 25%
    maxSatellitePct: 0.3,
    sessions: ["open", "midday", "preclose"],
    maxOrdersPerDay: 2,
  },
  riskoff: {
    agentId: "c5141b27-0d45-4443-8c0f-63005f605e84",
    name: "RiskOff",
    style: "Cash guardian. Flip to BND when SPY < 200-day; equity (VOO) only while SPY > 200-day; high skip rate.",
    allowlist: ["BND", "VOO"],
    maxNamePct: 1.0,
    equityNeedsSpyAbove200d: ["VOO"],
    maxEquityPct: 0.4,
    sessions: ["open", "midday", "preclose"],
    maxOrdersPerDay: 1,
  },
  swing: {
    agentId: "dd396072-87cc-4f88-900a-de8d8eb81dc7",
    name: "Swing",
    style: "3–15 day swings; rare, high-bar allowlist trades; acts at the pre-close batch only (no tick/after-hours).",
    allowlist: ["QQQ", "SMH", "SOXX", "XLK", "VGT", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "AVGO", "TSM"],
    maxNamePct: 0.25,
    sessions: ["preclose"],
    maxOrdersPerDay: 1,
    minConfidence: 0.65,
  },
});

export const TRADER_IDS = Object.freeze(Object.keys(PERSONAS));
