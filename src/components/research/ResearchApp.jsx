import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, RefreshCw, BookOpen } from "lucide-react";
import FeedDock from "../finances/FeedDock.jsx";
import { useResearch, TRADER_HUE, fmtDate } from "./useResearch.js";
import { RegimeCard, DecisionCard } from "./ResearchParts.jsx";
import { SLEEVE_SPRING, motionTransition, useMotionOn } from "../../lib/motion.js";

function Header({ title, sub, onBack, onReload }) {
  return (
    <header className="rs-header">
      <div className="rs-header__row">
        <button type="button" className="rs-iconbtn" aria-label="Back" onClick={onBack}><ArrowLeft size={20} aria-hidden="true" /></button>
        <div className="rs-header__text">
          <h1 className="rs-title">{title}</h1>
          <p className="rs-subtitle">{sub}</p>
        </div>
        {onReload ? <button type="button" className="rs-iconbtn" aria-label="Refresh" onClick={onReload}><RefreshCw size={18} aria-hidden="true" /></button> : null}
      </div>
    </header>
  );
}

export default function ResearchApp() {
  const { data, status, reload } = useResearch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [who, setWho] = useState(params.get("trader") || "all");
  const openId = params.get("open");
  const motionOn = useMotionOn();
  const traders = data?.traders || [];
  const byId = useMemo(() => Object.fromEntries(traders.map((t) => [t.id, t])), [traders]);
  const records = useMemo(() => (data?.records || []).filter((r) => who === "all" || r.trader === who), [data, who]);
  const days = useMemo(() => {
    const m = new Map();
    for (const r of records) { if (!m.has(r.date)) m.set(r.date, []); m.get(r.date).push(r); }
    return [...m.entries()];
  }, [records]);
  const latestRegime = data?.records?.[0]?.regime;
  const totals = useMemo(() => {
    const rs = data?.records || [];
    return {
      sessions: rs.length,
      sources: rs.reduce((n, r) => n + r.sources.length, 0),
      orders: rs.reduce((n, r) => n + (r.orderDetails?.length || 0), 0),
      fees: rs.reduce((n, r) => n + (r.orderDetails || []).reduce((f, o) => f + (o.fees?.total || 0), 0), 0),
    };
  }, [data]);

  return (
    <div className="rs-root">
      <Header title="Research" sub="Every call, the research behind it, and why · paper only" onBack={() => navigate("/finances")} onReload={reload} />
      {status === "loading" ? <p className="rs-empty rs-pad">Loading research…</p> : null}
      {status === "error" ? <p className="rs-empty rs-pad">Could not load trading-index.json.</p> : null}
      {status === "ready" ? (
        <div className="rs-layout">
          <aside className="rs-side rs-side--dash">
            <div className="rs-desktop-only"><RegimeCard regime={latestRegime} /></div>
            <div className="rs-totals" aria-label="Research totals">
              <div><b className="tabular-nums">{totals.sessions}</b><span>sessions</span></div>
              <div><b className="tabular-nums">{totals.sources}</b><span>sources read</span></div>
              <div><b className="tabular-nums">{totals.orders}</b><span>orders</span></div>
              <div><b className="tabular-nums">${totals.fees.toFixed(2)}</b><span>fees</span></div>
            </div>
            <nav className="rs-strats" aria-label="Strategies">
              <p className="rs-kicker">Strategies</p>
              {traders.map((t) => {
                const s = data.strategies?.[t.id];
                return (
                  <button key={t.id} type="button" className="rs-stratlink" data-hue={TRADER_HUE[t.id]} onClick={() => navigate(`/finances/research/${t.id}`)}>
                    <span className="rs-avatar rs-avatar--sm" aria-hidden="true">{t.name[0]}</span>
                    <span className="rs-stratlink__text"><b>{t.name}</b><span>{s ? `${s.name} · v${s.version}` : "No strategy yet"}</span></span>
                    <BookOpen size={16} aria-hidden="true" />
                  </button>
                );
              })}
            </nav>
          </aside>
          <main className="rs-main">
            <div className="rs-mobile-only"><RegimeCard regime={latestRegime} compact /></div>
            <div className="rs-rail" role="tablist" aria-label="Filter by trader">
              {[{ id: "all", name: "All traders" }, ...traders].map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={who === t.id} className="rs-railchip" data-hue={TRADER_HUE[t.id] || "slate"} onClick={() => setWho(t.id)}>
                  {t.id !== "all" ? <i aria-hidden="true" /> : null}{t.name}
                </button>
              ))}
            </div>
            {days.map(([date, recs]) => (
              <section key={date} className="rs-day" aria-label={date}>
                <h2 className="rs-day__title"><span>{fmtDate(date)}</span><span className="rs-count">{recs.length} decision{recs.length === 1 ? "" : "s"}</span></h2>
                <div className="rs-timeline">
                  {recs.map((r) => (
                    <DecisionCard key={r.id} rec={r} marks={data.marks} trader={byId[r.trader]} defaultOpen={r.id === openId} onStrategy={(id) => navigate(`/finances/research/${id}`)} />
                  ))}
                </div>
              </section>
            ))}
            {!days.length ? <p className="rs-empty">No research records yet.</p> : null}
            <motion.p className="rs-caught" initial={motionOn ? { opacity: 0, scale: 0.96 } : false} animate={{ opacity: 1, scale: 1 }} transition={motionTransition(motionOn, SLEEVE_SPRING)}>
              You're caught up. Sessions run at 9:05, 12:35 and 2:35 CT on market days.
            </motion.p>
          </main>
        </div>
      ) : null}
      <FeedDock />
    </div>
  );
}

const RULES = [
  ["entryRules", "Entry", "emerald"],
  ["exitRules", "Exit", "pink"],
  ["sizingRules", "Sizing", "blue"],
  ["riskRules", "Risk", "violet"],
  ["personaConstraints", "Guardrails", "slate"],
];

export function StrategyPage() {
  const { trader } = useParams();
  const { data, status } = useResearch();
  const navigate = useNavigate();
  const s = data?.strategies?.[trader];
  const t = data?.traders?.find((x) => x.id === trader);
  const recent = (data?.records || []).filter((r) => r.trader === trader).slice(0, 5);
  const hue = TRADER_HUE[trader] || "slate";
  return (
    <div className="rs-root">
      <Header title={t ? `${t.name} strategy` : "Strategy"} sub={t?.style || ""} onBack={() => navigate("/finances/research")} />
      {status === "ready" && !s ? <p className="rs-empty rs-pad">No strategy doc for {trader}.</p> : null}
      {s ? (
        <div className="rs-layout rs-layout--strategy">
          <main className="rs-main">
            <section className="rs-hero" data-hue={hue}>
              <span className="rs-kicker">Current strategy · v{s.version} · updated {fmtDate(s.updatedAt.slice(0, 10))}</span>
              <h2 className="rs-hero__title">{s.name}</h2>
              <p className="rs-hero__thesis">{s.thesis}</p>
              <div className="rs-chiprow">
                {(t?.allowlist || []).map((sym) => <span key={sym} className="rs-mini" data-hue={hue}>{sym}</span>)}
              </div>
            </section>
            <section className="rs-block" data-hue="cyan">
              <h4 className="rs-block__title">Regime fit</h4>
              <p className="rs-text">{s.regimeFit}</p>
            </section>
            {RULES.map(([k, label, h]) => (
              <section key={k} className="rs-block" data-hue={h}>
                <h4 className="rs-block__title">{label}</h4>
                <ul className="rs-rules">{(s[k] || []).map((x, i) => <li key={i}>{x}</li>)}</ul>
              </section>
            ))}
          </main>
          <aside className="rs-side">
            <section className="rs-block" data-hue={hue}>
              <h4 className="rs-block__title">Version history</h4>
              <ol className="rs-history">
                {[...s.history].reverse().map((h) => (
                  <li key={h.version}>
                    <span className="rs-history__v">v{h.version} · {fmtDate(h.date)}</span>
                    <b>{h.change}</b>
                    <span className="rs-text">{h.reason}</span>
                  </li>
                ))}
              </ol>
            </section>
            <section className="rs-block" data-hue="slate">
              <h4 className="rs-block__title">Recent decisions</h4>
              <div className="rs-timeline">
                {recent.map((r) => <DecisionCard key={r.id} rec={r} marks={data.marks} trader={t} />)}
              </div>
            </section>
          </aside>
        </div>
      ) : null}
      <FeedDock />
    </div>
  );
}
