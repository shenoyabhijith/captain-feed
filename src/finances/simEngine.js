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
export const MARK_HISTORY_MAX = 12;

const ALLOW = new Set(ALLOWLIST);

const VALUE_UNIVERSE = ["VTI", "VOO", "VXUS"];
const SWING_BUY_UNIVERSE = ["SMH", "QQQ", "NVDA"];
const MEGA_UNIVERSE = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA"];

/** Persona plugins: (sleeve, marks, intel, markHistory) → proposal. */
const PLUGINS = {
  value(sleeve, marks, _intel, markHistory) {
    const signals = feedSignals();
    const nav = sleeveNav(sleeve, marks);
    const cashPct = nav > 0 ? sleeve.cash / nav : 1;
    const oldest = oldestMarks(markHistory);

    if (cashPct > 0.2 && sleeve.cash >= MIN_TICKET) {
      const scored = VALUE_UNIVERSE.filter((sym) => marks[sym] > 0).map((sym) => {
        const mark = marks[sym];
        const pos = getPos(sleeve, sym);
        let ref = null;
        let refLabel = "";
        if (pos && pos.avgPrice > 0) {
          ref = pos.avgPrice;
          refLabel = "avg cost";
        } else if (oldest && oldest[sym] > 0) {
          ref = oldest[sym];
          refLabel = "oldest mark";
        }
        const discount = ref != null ? (ref - mark) / ref : null;
        return { sym, mark, ref, refLabel, discount };
      });

      const cheap = scored
        .filter((s) => s.discount != null && s.discount > 0)
        .sort((a, b) => b.discount - a.discount);

      if (cheap.length) {
        const pick = cheap[0];
        const pct = (pick.discount * 100).toFixed(1);
        return {
          side: "buy",
          symbol: pick.sym,
          reason: `${pick.sym} mark $${pick.mark.toFixed(2)} is ${pct}% below ${pick.refLabel} $${pick.ref.toFixed(2)}; cash ${(cashPct * 100).toFixed(0)}% of NAV.`,
          signals,
        };
      }

      // Nothing cheap — scheduled refill of largest cash gap (smallest position value)
      const byGap = scored
        .map((s) => ({
          ...s,
          weight: nav > 0 ? positionValue(sleeve, s.sym, marks) / nav : 0,
        }))
        .sort((a, b) => a.weight - b.weight);
      const pick = byGap[0];
      if (pick) {
        return {
          side: "buy",
          symbol: pick.sym,
          reason: `Scheduled refill: ${pick.sym} at $${pick.mark.toFixed(2)} (not cheap vs avg/history); cash ${(cashPct * 100).toFixed(0)}% of NAV.`,
          signals,
          budgetFrac: 0.35,
        };
      }
    }

    // Cash already low — hold largest core position
    let best = null;
    let bestVal = -1;
    for (const sym of VALUE_UNIVERSE) {
      const v = positionValue(sleeve, sym, marks);
      if (v > bestVal) {
        bestVal = v;
        best = sym;
      }
    }
    if (best && bestVal > 0) {
      const pct = nav > 0 ? ((bestVal / nav) * 100).toFixed(0) : "0";
      return {
        side: "hold",
        symbol: best,
        reason: `Hold ${best} (${pct}% of NAV); cash ${(cashPct * 100).toFixed(0)}% already deployed.`,
        signals,
      };
    }
    return {
      side: "skip",
      symbol: "VTI",
      reason: `Skip: cash ${(cashPct * 100).toFixed(0)}% of NAV and no VTI/VOO/VXUS book to hold.`,
      signals,
    };
  },

  swing(sleeve, marks, intel, markHistory) {
    const signals = intelAsymSignals(intel);
    const prev = previousMarks(markHistory);
    const oldest = oldestMarks(markHistory);
    const nav = sleeveNav(sleeve, marks);

    // Trim strength first — high bar
    for (const p of sleeve.positions || []) {
      if (!ALLOW.has(p.symbol) || !(p.qty > 0) || !marks[p.symbol]) continue;
      const mark = marks[p.symbol];
      const vsAvg =
        p.avgPrice > 0 ? (mark - p.avgPrice) / p.avgPrice : null;
      const oldPx = oldest?.[p.symbol];
      const vsOldest =
        oldPx > 0 ? (mark - oldPx) / oldPx : null;

      if ((vsAvg != null && vsAvg > 0.06) || (vsOldest != null && vsOldest > 0.04)) {
        const parts = [];
        if (vsAvg != null && vsAvg > 0.06) {
          parts.push(
            `${(vsAvg * 100).toFixed(1)}% above avg $${p.avgPrice.toFixed(2)}`
          );
        }
        if (vsOldest != null && vsOldest > 0.04) {
          parts.push(
            `${(vsOldest * 100).toFixed(1)}% above oldest mark $${oldPx.toFixed(2)}`
          );
        }
        return {
          side: "sell",
          symbol: p.symbol,
          reason: `${p.symbol} extended (${parts.join("; ")}); trim half.`,
          signals,
          sellFrac: 0.5,
        };
      }
    }

    // Buy only on pullback vs previous snapshot, under cap
    if (sleeve.cash >= MIN_TICKET) {
      const candidates = [];
      for (const sym of SWING_BUY_UNIVERSE) {
        const mark = marks[sym];
        if (!(mark > 0)) continue;
        const heldVal = positionValue(sleeve, sym, marks);
        const heldPct = nav > 0 ? heldVal / nav : 0;
        if (heldPct >= MAX_NAV_PCT - 0.01) continue;

        const prevPx = prev?.[sym];
        if (!(prevPx > 0)) continue;
        const chg = (mark - prevPx) / prevPx;
        if (chg > 0) continue; // need flat-to-down
        candidates.push({ sym, mark, prevPx, chg, heldPct });
      }
      candidates.sort((a, b) => a.chg - b.chg); // deepest pullback first
      if (candidates.length) {
        const pick = candidates[0];
        const chgPct = (pick.chg * 100).toFixed(1);
        return {
          side: "buy",
          symbol: pick.sym,
          reason: `${pick.sym} pullback: mark $${pick.mark.toFixed(2)} vs prior $${pick.prevPx.toFixed(2)} (${chgPct}%); under ${(MAX_NAV_PCT * 100).toFixed(0)}% cap at ${(pick.heldPct * 100).toFixed(0)}%.`,
          signals,
        };
      }
    }

    return {
      side: "skip",
      symbol: SWING_BUY_UNIVERSE[0],
      reason: "No swing edge: nothing >6% above avg / >4% above oldest, and no SMH/QQQ/NVDA flat-to-down vs prior mark.",
      signals,
    };
  },

  coresat(sleeve, marks, intel, _markHistory) {
    const signals = intelAsymSignals(intel);
    const nav = sleeveNav(sleeve, marks);
    const coreVal = positionValue(sleeve, "VOO", marks);
    const corePct = nav > 0 ? coreVal / nav : 0;
    const satSym = pickSatellite(sleeve, marks);
    const satVal = positionValue(sleeve, satSym, marks);
    const satPct = nav > 0 ? satVal / nav : 0;

    // Trim overweight satellite or non-core names over ~25%.
    // VOO is the core target (~75%), so it is never trimmed for the 25% name cap.
    if (satPct > 0.22 && marks[satSym] && hasPos(sleeve, satSym)) {
      return {
        side: "sell",
        symbol: satSym,
        reason: `Trim satellite ${satSym}: ${(satPct * 100).toFixed(0)}% of NAV (soft cap ~22%). Core VOO ${(corePct * 100).toFixed(0)}%.`,
        signals,
        sellFrac: 0.25,
      };
    }
    for (const p of sleeve.positions || []) {
      if (p.symbol === "VOO" || p.symbol === satSym) continue;
      if (!(p.qty > 0) || !marks[p.symbol]) continue;
      const pct = nav > 0 ? positionValue(sleeve, p.symbol, marks) / nav : 0;
      if (pct > 0.25) {
        return {
          side: "sell",
          symbol: p.symbol,
          reason: `Trim ${p.symbol}: ${(pct * 100).toFixed(0)}% of NAV (non-core over ~25%). Core ${(corePct * 100).toFixed(0)}% / sat ${(satPct * 100).toFixed(0)}%.`,
          signals,
          sellFrac: 0.25,
        };
      }
    }

    if (corePct < 0.67 && sleeve.cash >= MIN_TICKET && marks.VOO) {
      return {
        side: "buy",
        symbol: "VOO",
        reason: `Core VOO at ${(corePct * 100).toFixed(0)}% of NAV (target ~75%, refill below 67%).`,
        signals,
      };
    }

    if (
      corePct >= 0.67 &&
      satPct < 0.08 &&
      sleeve.cash >= MIN_TICKET &&
      marks[satSym]
    ) {
      return {
        side: "buy",
        symbol: satSym,
        reason: `Satellite ${satSym} at ${(satPct * 100).toFixed(0)}% of NAV (target ~15%, add below 8%); core OK at ${(corePct * 100).toFixed(0)}%.`,
        signals,
      };
    }

    return {
      side: "hold",
      symbol: "VOO",
      reason: `Hold mix: VOO ${(corePct * 100).toFixed(0)}% / ${satSym} ${(satPct * 100).toFixed(0)}% of NAV (targets ~75% / ~15%).`,
      signals,
    };
  },

  mega(sleeve, marks, intel, _markHistory) {
    const signals = intelAsymSignals(intel);
    const nav = sleeveNav(sleeve, marks);
    const target = 1 / MEGA_UNIVERSE.length;

    const rows = MEGA_UNIVERSE.map((sym) => {
      const pos = getPos(sleeve, sym);
      const mark = marks[sym];
      const val = positionValue(sleeve, sym, marks);
      const pct = nav > 0 ? val / nav : 0;
      const gap = target - pct;
      let extended = false;
      let extGap = null;
      if (pos && pos.avgPrice > 0 && mark > 0) {
        extGap = (mark - pos.avgPrice) / pos.avgPrice;
        extended = extGap > 0.05;
      }
      return { sym, mark, pos, val, pct, gap, extended, extGap };
    });

    // Trim largest if above ~22%
    const largest = [...rows].sort((a, b) => b.pct - a.pct)[0];
    if (largest && largest.pct > 0.22 && largest.mark > 0) {
      return {
        side: "sell",
        symbol: largest.sym,
        reason: `${largest.sym} at ${(largest.pct * 100).toFixed(0)}% of NAV (above ~22% equal-weight soft cap); trim slightly.`,
        signals,
        sellFrac: 0.25,
      };
    }

    // Buy most underweight that is not extended
    if (sleeve.cash >= MIN_TICKET) {
      const buys = rows
        .filter((r) => r.mark > 0 && !r.extended && r.gap > 0.02)
        .filter((r) => r.pct < MAX_NAV_PCT - 0.01)
        .sort((a, b) => b.gap - a.gap);

      if (buys.length) {
        const pick = buys[0];
        const hasPos = Boolean(pick.pos);
        return {
          side: "buy",
          symbol: pick.sym,
          reason: `${pick.sym} most underweight at ${(pick.pct * 100).toFixed(0)}% of NAV (equal-weight target ~${(target * 100).toFixed(0)}%)${hasPos ? `; mark within 5% of avg $${pick.pos.avgPrice.toFixed(2)}` : "; no position yet"}.`,
          signals,
        };
      }

      // Skip META-style only when that name is the extended underweight
      const extendedUnder = rows
        .filter((r) => r.extended && r.gap > 0.02)
        .sort((a, b) => b.gap - a.gap);
      if (extendedUnder.length && !buys.length) {
        const pick = extendedUnder[0];
        const gapPct = ((pick.extGap || 0) * 100).toFixed(1);
        return {
          side: "skip",
          symbol: pick.sym,
          reason: `No edge: ${pick.sym} is underweight at ${(pick.pct * 100).toFixed(0)}% but extended ${gapPct}% above avg $${pick.pos.avgPrice.toFixed(2)}.`,
          signals,
        };
      }
    }

    const spread = Math.max(...rows.map((r) => r.pct)) - Math.min(...rows.map((r) => r.pct));
    return {
      side: "hold",
      symbol: largest?.sym || "AAPL",
      reason: `Book roughly even (max−min weight ${(spread * 100).toFixed(0)} pp); hold equal-weight mega set.`,
      signals,
    };
  },

  riskoff(sleeve, marks, _intel, _markHistory) {
    const signals = feedSignals();
    const nav = sleeveNav(sleeve, marks);
    const cashPct = nav > 0 ? sleeve.cash / nav : 1;

    // Flatten any non-BND equity/ETF
    const rogue = (sleeve.positions || []).find(
      (p) => p.symbol !== "BND" && p.qty > 0
    );
    if (rogue && marks[rogue.symbol]) {
      return {
        side: "sell",
        symbol: rogue.symbol,
        reason: `Risk-off: sell non-BND ${rogue.symbol} in full; sleeve is cash + BND only.`,
        signals,
        sellFrac: 1,
      };
    }

    if (cashPct > 0.45 && marks.BND && sleeve.cash >= MIN_TICKET) {
      return {
        side: "buy",
        symbol: "BND",
        reason: `Cash ${(cashPct * 100).toFixed(0)}% of NAV above ~45% ballast; buy BND at $${marks.BND.toFixed(2)}.`,
        signals,
      };
    }

    if (hasPos(sleeve, "BND")) {
      return {
        side: "hold",
        symbol: "BND",
        reason: `Hold BND; cash ${(cashPct * 100).toFixed(0)}% of NAV already the ballast (≤45% deploy threshold).`,
        signals,
      };
    }

    return {
      side: "skip",
      symbol: "BND",
      reason: `Skip: cash ${(cashPct * 100).toFixed(0)}% of NAV is already the ballast; no BND add.`,
      signals,
    };
  },
};

function feedSignals() {
  return [{ source: "feed", org: "Captain Feed" }];
}

function intelAsymSignals(intel) {
  if (Array.isArray(intel) && intel.length) return intel;
  return [
    { source: "feed", org: "Captain Feed" },
    { source: "web", org: "Yahoo Finance" },
  ];
}

function getPos(sleeve, symbol) {
  return (sleeve.positions || []).find((p) => p.symbol === symbol && p.qty > 0);
}

function pickSatellite(sleeve, marks) {
  const qqq = positionValue(sleeve, "QQQ", marks);
  const smh = positionValue(sleeve, "SMH", marks);
  if (qqq > 0 && qqq >= smh) return "QQQ";
  if (smh > 0) return "SMH";
  return "QQQ";
}

function oldestMarks(markHistory) {
  if (!Array.isArray(markHistory) || !markHistory.length) return null;
  return markHistory[0]?.marks || null;
}

function previousMarks(markHistory) {
  if (!Array.isArray(markHistory) || markHistory.length < 1) return null;
  const date = new Date().toISOString().slice(0, 10);
  // Prefer last snapshot strictly before today; else second-to-last if today is last
  for (let i = markHistory.length - 1; i >= 0; i--) {
    const row = markHistory[i];
    if (row?.date && row.date < date && row.marks) return row.marks;
  }
  if (markHistory.length >= 2) {
    const row = markHistory[markHistory.length - 2];
    return row?.marks || null;
  }
  // Only one snapshot (possibly today) — no prior to compare
  if (markHistory.length === 1 && markHistory[0]?.date !== date) {
    return markHistory[0].marks || null;
  }
  return null;
}

/** Append / replace today's marks snapshot; keep last 12. */
export function appendMarkHistory(markHistory, date, marks) {
  const next = Array.isArray(markHistory) ? [...markHistory] : [];
  const snap = { date, marks: { ...marks } };
  const idx = next.findIndex((r) => r?.date === date);
  if (idx >= 0) next[idx] = snap;
  else next.push(snap);
  // Stable chronological order
  next.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return next.slice(-MARK_HISTORY_MAX);
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
 * Honors optional proposal.budgetFrac (0–1 of buy budget); default ~0.4.
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
    const frac =
      proposal.budgetFrac != null &&
      proposal.budgetFrac > 0 &&
      proposal.budgetFrac <= 1
        ? proposal.budgetFrac
        : 0.4;
    // Target frac of available budget, floor at min ticket
    let notional = Math.max(MIN_TICKET, Math.min(budget, budget * frac));
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
 * Appends { date, marks } to ledger.markHistory (last 12, dedupe same date).
 * @param {object} ledger
 * @param {{ authorizedBy?: 'firstmate'|'admin', enabledOverride?: Record<string,boolean> }} opts
 */
export function runToday(ledger, opts = {}) {
  const authorizedBy = opts.authorizedBy || "admin";
  const marks = { ...(ledger.marks || {}) };
  const runId = `run-${todayStamp()}-${Date.now().toString(36)}`;
  const date = new Date().toISOString().slice(0, 10);

  // Plugins read existing history; today's snapshot is appended after the run.
  const historyForPlugins = Array.isArray(ledger.markHistory)
    ? [...ledger.markHistory]
    : [];

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

    const proposal = plugin(sleeve, marks, null, historyForPlugins);
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
  const equity = [...(ledger.equity || [])];
  const last = equity[equity.length - 1];
  if (last && last.date === date) {
    equity[equity.length - 1] = { date, nav: totalNav };
  } else {
    equity.push({ date, nav: totalNav });
  }

  const markHistory = appendMarkHistory(ledger.markHistory, date, marks);

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
    markHistory,
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
