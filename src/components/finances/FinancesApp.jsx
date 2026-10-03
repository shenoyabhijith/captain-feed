import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { TriangleAlert, X } from "lucide-react";
import { loadTheme } from "../../storage";
import { useFinances } from "../../finances/useFinances.js";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Menu,
  MenuTrigger,
  MenuPopup,
  MenuItem,
} from "@/components/ui/menu";
import {
  Meter,
  MeterLabel,
  MeterTrack,
  MeterIndicator,
  MeterValue,
} from "@/components/ui/meter";
import FeedDock from "./FeedDock.jsx";
import { HoldingsTable, outlineBadgeClass } from "./SleeveCard.jsx";
import DecisionList from "./DecisionList.jsx";
import {
  dayPnlFromEquity,
  investedPct,
  money,
  signedMoney,
  signedPct,
  sleeveHoldings,
} from "./financesFormat.js";
import {
  SLEEVE_SPRING,
  motionTransition,
  useMotionOn,
} from "../../lib/motion.js";

const SLEEVE_ORDER = ["value", "swing", "coresat", "mega", "riskoff"];

export default function FinancesApp() {
  const fin = useFinances();
  const navigate = useNavigate();
  const [theme] = useState(loadTheme);
  const isDark = theme === "dark";
  const [detailSleeveId, setDetailSleeveId] = useState(null);
  const motionOn = useMotionOn();

  const day = useMemo(
    () => dayPnlFromEquity(fin.ledger?.equity || [], fin.stats?.nav),
    [fin.ledger, fin.stats]
  );

  const sleevesById = useMemo(() => {
    const map = {};
    for (const s of fin.ledger?.sleeves || []) map[s.id] = s;
    return map;
  }, [fin.ledger]);

  const orderedSleeves = useMemo(
    () =>
      SLEEVE_ORDER.map((id) => sleevesById[id])
        .filter(Boolean)
        .concat(
          (fin.ledger?.sleeves || []).filter((s) => !SLEEVE_ORDER.includes(s.id))
        ),
    [sleevesById, fin.ledger]
  );

  const detailSleeve = detailSleeveId ? sleevesById[detailSleeveId] : null;
  const detailStats = detailSleeve ? fin.sleeveStats(detailSleeve) : null;
  const detailWeight =
    detailStats && fin.stats.nav > 0 ? detailStats.nav / fin.stats.nav : 0;
  const detailDayPnl = detailStats
    ? Math.round(day.dayPnl * detailWeight * 100) / 100
    : 0;
  const detailDayPct =
    detailStats && detailStats.nav > 0
      ? Math.round((detailDayPnl / detailStats.nav) * 10000) / 100
      : 0;
  const detailDecisions = useMemo(() => {
    if (!detailSleeveId) return [];
    return (fin.ledger?.decisions || []).filter(
      (d) => d.agentId === detailSleeveId
    );
  }, [fin.ledger, detailSleeveId]);
  const detailHoldings = useMemo(() => {
    if (!detailSleeve || !detailStats) return [];
    return sleeveHoldings(detailSleeve, fin.marks, detailStats);
  }, [detailSleeve, detailStats, fin.marks]);

  useEffect(() => {
    if (!detailSleeveId) return undefined;
    function onKey(e) {
      if (e.key === "Escape") setDetailSleeveId(null);
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [detailSleeveId]);

  return (
    <div
      className={`finances-root flex h-dvh flex-col ${isDark ? "dark" : ""}`}
    >
      <header className="app-header shrink-0 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md">
        <div className="brand-row mx-auto flex max-w-lg items-center gap-2.5">
          <img
            className="size-7 shrink-0 rounded-md"
            src={`${import.meta.env.BASE_URL}icons/${isDark ? "mark-28-dark.png" : "mark-28-light.png"}`}
            width={28}
            height={28}
            alt=""
          />
          <div className="brand-text min-w-0 flex-1">
            <div className="brand-title font-semibold text-[1.05rem] tracking-tight leading-tight">
              Finances
            </div>
            <div className="brand-sub text-muted-foreground text-[0.68rem]">
              Sleeves · tap for holdings
            </div>
          </div>
          <Badge
            variant="outline"
            className={`paper-badge ${outlineBadgeClass}`}
            title="Simulated paper trading only"
          >
            Paper only
          </Badge>
          <Menu>
            <MenuTrigger
              className="more-btn inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-transparent text-muted-foreground text-base font-semibold"
              aria-label="More"
            >
              ···
            </MenuTrigger>
            <MenuPopup align="end" sideOffset={6}>
              <MenuItem onClick={() => fin.reload()}>Refresh</MenuItem>
              <MenuItem onClick={() => navigate("/finances/admin")}>
                Admin
              </MenuItem>
            </MenuPopup>
          </Menu>
        </div>
      </header>

      {fin.isPreview ? (
        <div className="mx-auto w-full max-w-lg shrink-0 px-4 pt-2">
          <Alert variant="warning" role="status">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>PAPER preview</AlertTitle>
            <AlertDescription>
              Not committed ledger. Download JSON for Firstmate to commit, or
              reset overlay in Admin.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {fin.status === "loading" ? (
        <p className="px-4 py-6 text-muted-foreground text-sm">
          Loading ledger…
        </p>
      ) : fin.status === "error" ? (
        <div className="px-4 py-4">
          <Alert variant="error" role="alert">
            <AlertTitle>Could not load finances-ledger.json</AlertTitle>
          </Alert>
        </div>
      ) : (
        <div className="fin-body mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(72px+env(safe-area-inset-bottom,0px))]">
          <div
            className="nav-strip mx-3 mt-3"
            role="region"
            aria-label="Portfolio summary"
          >
            <div className="nav-label">
              Total NAV · {fin.stats.enabledCount} sleeves
            </div>
            <div className="nav-row">
              <div className="nav-value tabular-nums">{money(fin.stats.nav)}</div>
              <div
                className={`nav-day tabular-nums ${
                  day.dayPnl >= 0 ? "up" : "down"
                }`}
              >
                {signedMoney(day.dayPnl)} · {signedPct(day.dayPnlPct)}
              </div>
            </div>
            <div className="nav-sub">Paper trading · sleeve stack</div>
          </div>

          <div className="sleeve-stack">
            {orderedSleeves.map((s) => {
              const stats = fin.sleeveStats(s);
              const weight =
                fin.stats.nav > 0 ? stats.nav / fin.stats.nav : 0;
              const sDayPnl = Math.round(day.dayPnl * weight * 100) / 100;
              const sDayPct =
                stats.nav > 0
                  ? Math.round((sDayPnl / stats.nav) * 10000) / 100
                  : 0;
              const holdings = sleeveHoldings(s, fin.marks, stats).filter(
                (h) => !h.isCash || h.pct > 0
              );
              const dots = holdings.filter((h) => h.pct >= 4).slice(0, 4);
              return (
                <button
                  key={s.id}
                  type="button"
                  className="sleeve"
                  aria-label={`${s.name} sleeve, open detail`}
                  onClick={() => setDetailSleeveId(s.id)}
                >
                  <div className="sleeve-top">
                    <div>
                      <div className="sleeve-name">{s.name}</div>
                      <div className="sleeve-vibe">{s.persona}</div>
                    </div>
                    <span className="sleeve-chev" aria-hidden="true">
                      ›
                    </span>
                  </div>
                  <div className="sleeve-metrics">
                    <div className="sleeve-nav tabular-nums">
                      {money(stats.nav)}
                    </div>
                    <div
                      className={`sleeve-pnl tabular-nums ${
                        sDayPnl >= 0 ? "up" : "down"
                      }`}
                    >
                      {signedMoney(sDayPnl)} · {signedPct(sDayPct)}
                    </div>
                  </div>
                  <div className="alloc-dots">
                    {dots.map((h) => (
                      <span key={h.key} className="alloc-dot">
                        <i style={{ background: h.color }} aria-hidden="true" />
                        {h.symbol} {h.pct.toFixed(h.pct >= 10 ? 0 : 1)}%
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {detailSleeve && detailStats ? (
          <motion.div
            key={detailSleeveId}
            className="sleeve-detail-screen fixed inset-0 z-[110] flex flex-col bg-background text-foreground"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sleeve-detail-title"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={motionTransition(motionOn, SLEEVE_SPRING)}
          >
            <header
              className="shrink-0 flex items-start gap-3 px-4 pb-3"
              style={{
                paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
              }}
            >
              <div className="min-w-0 flex-1 pt-1">
                <h1
                  id="sleeve-detail-title"
                  className="m-0 font-semibold text-[1.15rem] tracking-tight leading-tight"
                >
                  {detailSleeve.name}
                </h1>
                <p className="m-0 mt-0.5 text-muted-foreground text-[0.75rem] leading-snug">
                  {detailSleeve.persona}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close sleeve detail"
                onClick={() => setDetailSleeveId(null)}
              >
                <X size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </header>

            <div
              className="mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4"
              style={{
                paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))",
              }}
            >
              <section aria-label="Summary" className="flex flex-col gap-3">
                <p className="m-0 text-muted-foreground text-[0.6875rem]">
                  Start {money(detailStats.starting)} · paper marks
                  {detailSleeve.intelAsymmetric ? " · intel-asymmetric" : ""}
                </p>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="m-0 font-semibold text-[1.35rem] tabular-nums tracking-tight">
                    {money(detailStats.nav)}
                  </p>
                  <div
                    className={`text-right text-[0.8125rem] tabular-nums font-semibold ${
                      detailDayPnl >= 0
                        ? "text-success-foreground"
                        : "text-destructive-foreground"
                    }`}
                  >
                    {signedMoney(detailDayPnl)}{" "}
                    <span className="text-[0.7rem] font-medium opacity-85">
                      {signedPct(detailDayPct)} day
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
                  <span>
                    Cash{" "}
                    <strong className="text-foreground">
                      {money(detailSleeve.cash)}
                    </strong>
                  </span>
                  <span>
                    Invested{" "}
                    <strong className="text-foreground">
                      {investedPct(detailStats).toFixed(1)}%
                    </strong>
                  </span>
                  <span>
                    Total{" "}
                    <strong
                      className={
                        detailStats.pnl >= 0
                          ? "text-success-foreground"
                          : "text-destructive-foreground"
                      }
                    >
                      {signedMoney(detailStats.pnl)}
                    </strong>
                  </span>
                  {detailSleeve.intelAsymmetric ? (
                    <Badge
                      variant="outline"
                      className={outlineBadgeClass}
                      title="Align Q2B — intel-asymmetric"
                    >
                      Intel-asym
                    </Badge>
                  ) : null}
                </div>
                <Meter
                  value={investedPct(detailStats)}
                  max={100}
                  className="gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <MeterLabel className="text-muted-foreground text-xs font-normal">
                      Allocation
                    </MeterLabel>
                    <MeterValue className="text-xs" />
                  </div>
                  <MeterTrack className="h-2 rounded-full bg-muted">
                    <MeterIndicator className="rounded-full bg-[var(--chart-2)]" />
                  </MeterTrack>
                </Meter>
              </section>

              <section aria-label="Holdings">
                <p className="mb-2 font-semibold text-muted-foreground text-xs">
                  Holdings
                </p>
                <HoldingsTable
                  sleeve={detailSleeve}
                  holdings={detailHoldings}
                />
              </section>

              <section aria-label="Decision log">
                <p className="mb-2 font-semibold text-muted-foreground text-xs">
                  Decision log · {detailSleeve.name}
                </p>
                <DecisionList
                  decisions={detailDecisions}
                  emptyLabel={`No decisions for ${detailSleeve.name}.`}
                />
              </section>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <FeedDock />
    </div>
  );
}
