/**
 * Deterministic paper sim engine for FEED-FINANCES-1.
 * Sole mutation path for sleeve cash/positions (Firstmate/admin authorized).
 * Caps: fractionals OK, min ticket $5, max 25% NAV per name, allowlist only.
 */

export const ALLOWLIST = Object.freeze([
  "VOO", "VTI", "VXUS", "BND",
  "QQQ", "VGT", "SMH", "SOXX", "XLK",
  "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "AVGO", "TSM",
]);

export const MIN_TICKET = 5;
export const MAX_NAV_PCT = 0.25;
export const STARTING_CASH = 100;

const ALLOW = new Set(ALLOWLIST);

/** Persona plugins: return { side, symbol?, reason, signals? } using ledger marks only. */
const PLUGINS = {
  value(sleeve, marks, _intel) {
    const nav = sleeveNav(sleeve, marks);
    const cashPct = nav > 0 ? sleeve.cash / nav : 1;
    if (cashPct > 0.35 && marks.VTI) {
      return {
        side: "buy",
        symbol: "VTI",
        reason: "Cash heavy; refill broad quality at stamped mark.",
        signals: [{ source: "feed", org: "Captain Feed" }],
      };
    }
    if (hasPos(sleeve, "VOO") || hasPos(sleeve, "VTI")) {
      return {
        side: "hold",
        symbol: hasPos(sleeve, "VTI") ? "VTI" : "VOO",
        reason: "Hold core; no margin-of-safety add today.",
        signals: [{ source: "feed", org: "Captain Feed" }],
      };
    }
    return {
      side: "skip",
      symbol: "VOO",
      reason: "No value setup vs allowlist at current marks.",
      signals: [{ source: "feed", org: "Captain Feed" }],
    };
  },

  swing(sleeve, marks, intel) {
    const signals = intelAsymSignals(intel);
    if (hasPos(sleeve, "NVDA") && marks.NVDA) {
      const pos = sleeve.positions.find((p) => p.symbol === "NVDA");
      if (pos && pos.qty > 0.1) {
        return {
          side: "sell",
          symbol: "NVDA",
          reason: "Swing trim: catalyst aged; take partial off.",
          signals,
          sellFrac: 0.5,
        };
      }
    }
    if (sleeve.cash >= MIN_TICKET && marks.SMH) {
      return {
        side: "buy",
        symbol: "SMH",
        reason: "Semi basket bounce off support; 3–15 day hold.",
        signals,
      };
    }
    return {
      side: "skip",
      symbol: "SMH",
      reason: "No swing edge; skip.",
      signals,
    };
  },

  coresat(sleeve, marks, intel) {
    const signals = intelAsymSignals(intel);
    const nav = sleeveNav(sleeve, marks);
    const core = positionValue(sleeve, "VOO", marks);
    const corePct = nav > 0 ? core / nav : 0;
    if (corePct < 0.5 && sleeve.cash >= MIN_TICKET && marks.VOO) {
      return {
        side: "buy",
        symbol: "VOO",
        reason: "Rebalance: refill core below 50% NAV.",
        signals,
      };
    }
    if (sleeve.cash >= MIN_TICKET && marks.QQQ && !hasPos(sleeve, "QQQ")) {
      return {
        side: "buy",
        symbol: "QQQ",
        reason: "Satellite tilt: add QQQ within 25% name cap.",
        signals,
      };
    }
    return {
      side: "hold",
      symbol: "VOO",
      reason: "Core/satellite mix OK; hold.",
      signals,
    };
  },

  mega(sleeve, marks, intel) {
    const signals = intelAsymSignals(intel);
    if (sleeve.cash >= MIN_TICKET && marks.AAPL && !hasPos(sleeve, "AAPL")) {
      return {
        side: "buy",
        symbol: "AAPL",
        reason: "Mega momentum: open AAPL under concentration cap.",
        signals,
      };
    }
    if (hasPos(sleeve, "META") || marks.META) {
      const metaVal = positionValue(sleeve, "META", marks);
      if (metaVal === 0) {
        return {
          side: "skip",
          symbol: "META",
          reason: "No edge vs last entry; wait for pullback.",
          signals,
        };
      }
    }
    if (hasPos(sleeve, "MSFT") || hasPos(sleeve, "AAPL")) {
      return {
        side: "hold",
        symbol: hasPos(sleeve, "AAPL") ? "AAPL" : "MSFT",
        reason: "Momentum intact; hold mega names.",
        signals,
      };
    }
    return {
      side: "skip",
      symbol: "MSFT",
      reason: "No mega add; cash reserved.",
      signals,
    };
  },

  riskoff(sleeve, marks, _intel) {
    const nav = sleeveNav(sleeve, marks);
    const cashPct = nav > 0 ? sleeve.cash / nav : 1;
    if (cashPct > 0.5 && marks.BND && sleeve.cash >= MIN_TICKET) {
      return {
        side: "buy",
        symbol: "BND",
        reason: "Deploy idle cash into quality bonds.",
        signals: [{ source: "feed", org: "Captain Feed" }],
      };
    }
    if (hasPos(sleeve, "BND")) {
      return {
        side: "hold",
        symbol: "BND",
        reason: "Hold ballast; equity sleeves lean long.",
        signals: [{ source: "feed", org: "Captain Feed" }],
      };
    }
    return {
      side: "skip",
      symbol: "BND",
      reason: "Cash already adequate ballast.",
      signals: [{ source: "feed", org: "Captain Feed" }],
    };
  },
};

function intelAsymSignals(intel) {
  if (Array.isArray(intel) && intel.length) return intel;
  return [
    { source: "feed", org: "Captain Feed" },
    { source: "web", org: "Yahoo Finance" },
  ];
}

export function sleeveNav(sleeve, marks = {}) {
  let pos = 0;
  for (const p of sleeve.positions || []) {
    const px = marks[p.symbol] ?? p.avgPrice ?? 0;
    pos += (p.qty || 0) * px;
  }
  return round2((sleeve.cash || 0) + pos);
}

export function positionValue(sleeve, symbol, marks = {}) {
  const p = (sleeve.positions || []).find((x) => x.symbol === symbol);
  if (!p) return 0;
  const px = marks[symbol] ?? p.avgPrice ?? 0;
  return (p.qty || 0) * px;
}

function hasPos(sleeve, symbol) {
  return (sleeve.positions || []).some((p) => p.symbol === symbol && p.qty > 0);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function todayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function isoNow() {
  return new Date().toISOString();
}

/**
 * Apply a single proposal under caps. Returns decision + mutated sleeve copy.
 */
export function applyProposal(sleeve, proposal, marks, runId, authorizedBy) {
  const next = {
    ...sleeve,
    positions: (sleeve.positions || []).map((p) => ({ ...p })),
    lastAction: { ...sleeve.lastAction },
  };
  const ts = isoNow();
  const side = proposal.side;
  const symbol = proposal.symbol;
  const base = {
    id: `d-${runId}-${sleeve.id}-${side}-${symbol || "na"}`,
    ts,
    agentId: sleeve.id,
    strategy: sleeve.name,
    side,
    symbol: symbol || undefined,
    reason: proposal.reason || "",
    signals: proposal.signals || [],
    runId,
    authorizedBy,
  };

  if (side === "hold" || side === "skip") {
    next.lastAction = { side, symbol, reason: proposal.reason, ts };
    return {
      sleeve: next,
      decision: {
        ...base,
        qty: 0,
        price: symbol ? marks[symbol] : undefined,
        notional: 0,
        cashAfter: round2(next.cash),
      },
    };
  }

  if (!symbol || !ALLOW.has(symbol)) {
    next.lastAction = {
      side: "skip",
      symbol,
      reason: `Reject: ${symbol || "?"} not on allowlist.`,
      ts,
    };
    return {
      sleeve: next,
      decision: {
        ...base,
        side: "skip",
        qty: 0,
        notional: 0,
        cashAfter: round2(next.cash),
        reason: next.lastAction.reason,
      },
    };
  }

  const price = marks[symbol];
  if (price == null || !(price > 0)) {
    next.lastAction = {
      side: "skip",
      symbol,
      reason: `Skip: no stamped mark for ${symbol}.`,
      ts,
    };
    return {
      sleeve: next,
      decision: {
        ...base,
        side: "skip",
        qty: 0,
        notional: 0,
        cashAfter: round2(next.cash),
        reason: next.lastAction.reason,
      },
    };
  }

  const nav = sleeveNav(next, marks);
  const maxNotional = nav * MAX_NAV_PCT;

  if (side === "buy") {
    const budget = Math.min(next.cash, maxNotional);
    if (budget < MIN_TICKET) {
      next.lastAction = {
        side: "skip",
        symbol,
        reason: `Skip: ticket below $${MIN_TICKET} or cash/cap.`,
        ts,
      };
      return {
        sleeve: next,
        decision: {
          ...base,
          side: "skip",
          qty: 0,
          price,
          notional: 0,
          cashAfter: round2(next.cash),
          reason: next.lastAction.reason,
        },
      };
    }
    // Target ~40% of available budget, floor at min ticket
    let notional = Math.max(MIN_TICKET, Math.min(budget, budget * 0.4));
    notional = round2(notional);
    const qty = round4(notional / price);
    notional = round2(qty * price);
    if (notional > next.cash) {
      next.lastAction = {
        side: "skip",
        symbol,
        reason: "Skip: insufficient cash after sizing.",
        ts,
      };
      return {
        sleeve: next,
        decision: {
          ...base,
          side: "skip",
          qty: 0,
          price,
          notional: 0,
          cashAfter: round2(next.cash),
          reason: next.lastAction.reason,
        },
      };
    }
    const existing = next.positions.find((p) => p.symbol === symbol);
    if (existing) {
      const newQty = existing.qty + qty;
      existing.avgPrice = round2(
        (existing.avgPrice * existing.qty + price * qty) / newQty
      );
      existing.qty = round4(newQty);
    } else {
      next.positions.push({ symbol, qty, avgPrice: price });
    }
    next.cash = round2(next.cash - notional);
    next.lastAction = { side: "buy", symbol, reason: proposal.reason, ts };
    return {
      sleeve: next,
      decision: {
        ...base,
        qty,
        price,
        notional,
        cashAfter: next.cash,
      },
    };
  }

  if (side === "sell") {
    const existing = next.positions.find((p) => p.symbol === symbol);
    if (!existing || existing.qty <= 0) {
      next.lastAction = {
        side: "skip",
        symbol,
        reason: `Skip: no ${symbol} to sell.`,
        ts,
      };
      return {
        sleeve: next,
        decision: {
          ...base,
          side: "skip",
          qty: 0,
          price,
          notional: 0,
          cashAfter: round2(next.cash),
          reason: next.lastAction.reason,
        },
      };
    }
    const frac = proposal.sellFrac && proposal.sellFrac > 0 && proposal.sellFrac <= 1
      ? proposal.sellFrac
      : 1;
    const qty = round4(existing.qty * frac);
    const notional = round2(qty * price);
    existing.qty = round4(existing.qty - qty);
    if (existing.qty < 0.0001) {
      next.positions = next.positions.filter((p) => p.symbol !== symbol);
    }
    next.cash = round2(next.cash + notional);
    next.lastAction = { side: "sell", symbol, reason: proposal.reason, ts };
    return {
      sleeve: next,
      decision: {
        ...base,
        qty,
        price,
        notional,
        cashAfter: next.cash,
      },
    };
  }

  next.lastAction = { side: "skip", symbol, reason: "Unknown side.", ts };
  return {
    sleeve: next,
    decision: {
      ...base,
      side: "skip",
      qty: 0,
      notional: 0,
      cashAfter: round2(next.cash),
      reason: next.lastAction.reason,
    },
  };
}

/**
 * Run today: one batch across enabled sleeves. Mutates a deep copy of ledger.
 * @param {object} ledger
 * @param {{ authorizedBy?: 'firstmate'|'admin', enabledOverride?: Record<string,boolean> }} opts
 */
export function runToday(ledger, opts = {}) {
  const authorizedBy = opts.authorizedBy || "admin";
  const marks = { ...(ledger.marks || {}) };
  const runId = `run-${todayStamp()}-${Date.now().toString(36)}`;
  const sleeves = (ledger.sleeves || []).map((s) => ({
    ...s,
    positions: (s.positions || []).map((p) => ({ ...p })),
  }));
  const decisions = [...(ledger.decisions || [])];
  const newDecisions = [];

  for (let i = 0; i < sleeves.length; i++) {
    const sleeve = sleeves[i];
    const enabled =
      opts.enabledOverride && sleeve.id in opts.enabledOverride
        ? opts.enabledOverride[sleeve.id]
        : sleeve.enabled !== false;
    if (!enabled) continue;

    const plugin = PLUGINS[sleeve.id];
    if (!plugin) {
      const { sleeve: next, decision } = applyProposal(
        sleeve,
        { side: "skip", reason: "No persona plugin.", signals: [] },
        marks,
        runId,
        authorizedBy
      );
      sleeves[i] = next;
      newDecisions.push(decision);
      continue;
    }

    const proposal = plugin(sleeve, marks, null);
    const { sleeve: next, decision } = applyProposal(
      sleeve,
      proposal,
      marks,
      runId,
      authorizedBy
    );
    sleeves[i] = next;
    newDecisions.push(decision);
  }

  // Prepend newest decisions
  const allDecisions = [...newDecisions, ...decisions];

  // MTM portfolio NAV for equity curve
  const totalNav = round2(
    sleeves.reduce((sum, s) => sum + sleeveNav(s, marks), 0)
  );
  const date = new Date().toISOString().slice(0, 10);
  const equity = [...(ledger.equity || [])];
  const last = equity[equity.length - 1];
  if (last && last.date === date) {
    equity[equity.length - 1] = { date, nav: totalNav };
  } else {
    equity.push({ date, nav: totalNav });
  }

  return {
    ...ledger,
    meta: {
      ...ledger.meta,
      asOf: isoNow(),
      paperOnly: true,
    },
    sleeves,
    decisions: allDecisions,
    equity,
    marks,
    ops: {
      ...(ledger.ops || {}),
      lastRunId: runId,
      notes:
        ledger.ops?.notes ||
        "Firstmate issued paper capital · real EOD marks.",
    },
    _previewRunId: runId,
  };
}

/** Deep-clone ledger for in-memory mutation. */
export function cloneLedger(ledger) {
  return JSON.parse(JSON.stringify(ledger));
}

export function portfolioStats(ledger) {
  const marks = ledger.marks || {};
  const sleeves = ledger.sleeves || [];
  const starting = sleeves.reduce(
    (s, x) => s + (x.startingCash ?? STARTING_CASH),
    0
  );
  const nav = round2(sleeves.reduce((s, x) => s + sleeveNav(x, marks), 0));
  const cash = round2(sleeves.reduce((s, x) => s + (x.cash || 0), 0));
  const pnl = round2(nav - starting);
  const pnlPct = starting > 0 ? round2((pnl / starting) * 100) : 0;
  const cashPct = nav > 0 ? round2((cash / nav) * 100) : 0;
  const enabledCount = sleeves.filter((x) => x.enabled !== false).length;
  return { nav, cash, starting, pnl, pnlPct, cashPct, enabledCount, total: sleeves.length };
}

export function sleeveStats(sleeve, marks = {}) {
  const starting = sleeve.startingCash ?? STARTING_CASH;
  const nav = sleeveNav(sleeve, marks);
  const pnl = round2(nav - starting);
  const pnlPct = starting > 0 ? round2((pnl / starting) * 100) : 0;
  const cashPct = nav > 0 ? round2(((sleeve.cash || 0) / nav) * 100) : 0;
  return { nav, pnl, pnlPct, cashPct, starting };
}
