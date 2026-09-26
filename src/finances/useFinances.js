import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cloneLedger,
  runToday,
  portfolioStats,
  sleeveStats,
  sleeveNav,
} from "./simEngine.js";

const OVERLAY_KEY = "captain-feed-finances-overlay";

function readOverlay() {
  try {
    const raw = sessionStorage.getItem(OVERLAY_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeOverlay(payload) {
  try {
    if (!payload) {
      sessionStorage.removeItem(OVERLAY_KEY);
      return;
    }
    sessionStorage.setItem(OVERLAY_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

/**
 * Fetch checked-in ledger; overlay is session-only preview (not primary book).
 */
export function useFinances() {
  const [fileLedger, setFileLedger] = useState(null);
  const [overlay, setOverlay] = useState(() => readOverlay());
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}data/finances-ledger.json`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("finances-ledger.json missing");
      const data = await res.json();
      setFileLedger(data);
      setStatus("ready");
    } catch (e) {
      console.error(e);
      setError(e?.message || "load failed");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const ledger = useMemo(() => {
    if (!fileLedger) return null;
    if (overlay?.ledger) return overlay.ledger;
    return fileLedger;
  }, [fileLedger, overlay]);

  const isPreview = Boolean(overlay?.ledger);
  const enabledOverride = overlay?.enabledOverride || null;

  const displayLedger = useMemo(() => {
    if (!ledger) return null;
    if (!enabledOverride) return ledger;
    return {
      ...ledger,
      sleeves: ledger.sleeves.map((s) => ({
        ...s,
        enabled:
          s.id in enabledOverride ? enabledOverride[s.id] : s.enabled !== false,
      })),
    };
  }, [ledger, enabledOverride]);

  const stats = useMemo(
    () => (displayLedger ? portfolioStats(displayLedger) : null),
    [displayLedger]
  );

  const run = useCallback(
    (authorizedBy = "admin") => {
      if (!fileLedger) return null;
      const base = cloneLedger(overlay?.ledger || fileLedger);
      // Apply enabled override onto base before run
      if (enabledOverride) {
        base.sleeves = base.sleeves.map((s) => ({
          ...s,
          enabled:
            s.id in enabledOverride ? enabledOverride[s.id] : s.enabled !== false,
        }));
      }
      const next = runToday(base, {
        authorizedBy,
        enabledOverride: enabledOverride || undefined,
      });
      const payload = {
        ledger: next,
        enabledOverride: enabledOverride || undefined,
        previewAt: new Date().toISOString(),
        source: "run-today",
      };
      setOverlay(payload);
      writeOverlay(payload);
      return next;
    },
    [fileLedger, overlay, enabledOverride]
  );

  const setSleeveEnabled = useCallback(
    (id, enabled) => {
      const nextOverride = {
        ...(enabledOverride || {}),
        [id]: enabled,
      };
      // Also stamp onto in-memory overlay ledger if present
      let nextLedger = overlay?.ledger || null;
      if (nextLedger) {
        nextLedger = {
          ...nextLedger,
          sleeves: nextLedger.sleeves.map((s) =>
            s.id === id ? { ...s, enabled } : s
          ),
        };
      }
      const payload = {
        ledger: nextLedger,
        enabledOverride: nextOverride,
        previewAt: new Date().toISOString(),
        source: overlay?.source || "toggle",
      };
      // If no mutative ledger yet, keep file as display base with override only
      if (!nextLedger) {
        payload.ledger = null;
      }
      setOverlay(payload);
      writeOverlay(payload);
    },
    [enabledOverride, overlay]
  );

  const resetOverlay = useCallback(() => {
    setOverlay(null);
    writeOverlay(null);
  }, []);

  /** Download current effective ledger JSON for Firstmate to commit. */
  const downloadLedger = useCallback(() => {
    const data = displayLedger || fileLedger;
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "finances-ledger.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [displayLedger, fileLedger]);

  const allPositions = useMemo(() => {
    if (!displayLedger) return [];
    const marks = displayLedger.marks || {};
    const rows = [];
    for (const s of displayLedger.sleeves || []) {
      for (const p of s.positions || []) {
        const px = marks[p.symbol] ?? p.avgPrice ?? 0;
        rows.push({
          symbol: p.symbol,
          qty: p.qty,
          avgPrice: p.avgPrice,
          sleeveId: s.id,
          sleeveName: s.name,
          mtm: Math.round(p.qty * px * 100) / 100,
        });
      }
    }
    return rows;
  }, [displayLedger]);

  return {
    status,
    error,
    fileLedger,
    ledger: displayLedger,
    isPreview,
    stats,
    marks: displayLedger?.marks || {},
    reload,
    run,
    resetOverlay,
    setSleeveEnabled,
    downloadLedger,
    allPositions,
    sleeveStats: (sleeve) =>
      sleeveStats(sleeve, displayLedger?.marks || {}),
    sleeveNav: (sleeve) => sleeveNav(sleeve, displayLedger?.marks || {}),
    overlayMeta: overlay
      ? { previewAt: overlay.previewAt, source: overlay.source }
      : null,
  };
}
