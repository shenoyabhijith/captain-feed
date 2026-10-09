import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, ChevronDown, Check, X as XIcon, Eye, ShieldAlert, Receipt, Target, Gauge, Zap } from "lucide-react";
import { SOURCE_META, SESSION_LABEL, ACTION_LABEL, TRADER_HUE, fmtPct, fmtMoney, fmtTime, fmtX, hostOf, pnlSince, whenLabel } from "./useResearch.js";
import { SLEEVE_SPRING, motionTransition, useMotionOn } from "../../lib/motion.js";

export function RegimeCard({ regime, compact = false }) {
  if (!regime) return null;
  const stats = [
    { k: "SPY", v: regime.spy?.last, sub: `${fmtPct(regime.spy?.vsSma200Pct)} 200d`, up: regime.spy?.vsSma200Pct > 0 },
    { k: "QQQ", v: regime.qqq?.last, sub: `${fmtPct(regime.qqq?.vsSma50Pct)} 50d`, up: regime.qqq?.vsSma50Pct > 0 },
    { k: "VIX", v: regime.vix?.last, sub: `${fmtPct(regime.vix?.chg5dPct)} 5d`, up: regime.vix?.chg5dPct < 0 },
    { k: "10y", v: regime.rates?.us10y != null ? `${regime.rates.us10y}%` : "—", sub: `3m ${regime.rates?.us13w ?? "—"}%`, up: null },
  ];
  return (
    <section className={`rs-regime ${compact ? "rs-regime--compact" : ""}`} data-hue={regime.riskOn ? "emerald" : "pink"} aria-label="Market regime">
      <div className="rs-regime__top">
        <span className="rs-kicker">Market regime · close {regime.asOf}</span>
        <span className="rs-pill" data-hue={regime.riskOn ? "emerald" : "pink"}>{regime.riskOn ? "Risk-on" : "Risk-off"}</span>
      </div>
      <p className="rs-regime__label">{regime.label}</p>
      {compact ? <p className="rs-regime__sum">Leaders {regime.leaders?.join(", ")} · laggards {regime.laggards?.join(", ")} (5d)</p> : null}
      <div className="rs-stats">
        {stats.map((s) => (
          <div key={s.k} className="rs-stat">
            <span className="rs-stat__k">{s.k}</span>
            <span className="rs-stat__v tabular-nums">{s.v ?? "—"}</span>
            <span className={`rs-stat__sub ${s.up == null ? "" : s.up ? "up" : "down"}`}>{s.sub}</span>
          </div>
        ))}
      </div>
      {!compact ? (
        <div className="rs-sectors" aria-label="Sector 5-day moves">
          {(regime.sectors || []).map((s) => (
            <span key={s.symbol} className={`rs-sector ${s.chg5dPct >= 0 ? "up" : "down"}`} title={`${s.name}: ${fmtPct(s.chg1dPct)} 1d, ${fmtPct(s.chg5dPct)} 5d`}>
              <b>{s.symbol}</b> {fmtPct(s.chg5dPct)}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function SourceChips({ sources }) {
  const groups = ["x", "web", "sec", "market"].map((t) => ({ t, items: sources.filter((s) => s.type === t) })).filter((g) => g.items.length);
  const [open, setOpen] = useState(null);
  return (
    <div className="rs-sources">
      {groups.map((g) => (
        <div key={g.t} className="rs-srcgroup" data-hue={SOURCE_META[g.t].hue}>
          <div className="rs-srcgroup__head">
            <span className="rs-srcbadge">{SOURCE_META[g.t].label}</span>
            <span className="rs-srcgroup__title">{SOURCE_META[g.t].long}</span>
            <span className="rs-count">{g.items.length}</span>
          </div>
          <div className="rs-chiprow">
            {g.items.map((s) => {
              const isOpen = open === s.id;
              return (
                <div key={s.id} className={`rs-srcchip ${isOpen ? "is-open" : ""}`}>
                  <button type="button" className="rs-srcchip__btn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.id)}>
                    <span className="rs-srcchip__id">{s.id}</span>
                    <span className="rs-srcchip__label">{s.author || (s.type === "sec" && s.symbols ? `${s.symbols.join(",")} ${(s.title.match(/10-Q|10-K|8-K|Form 4/) || [""])[0]}` : hostOf(s.url))}</span>
                    <ChevronDown size={14} aria-hidden="true" className="rs-chev" />
                  </button>
                  {isOpen ? (
                    <div className="rs-srcchip__body">
                      <p className="rs-srcchip__title">{s.title}</p>
                      <p className="rs-srcchip__take">{s.takeaway}</p>
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="rs-link">
                        Open source <ExternalLink size={13} aria-hidden="true" />
                      </a>
                      <span className="rs-meta">read {fmtTime(s.retrievedAt)}</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const STATUS = {
  selected: { label: "Selected", hue: "emerald", Icon: Check },
  watch: { label: "Watch", hue: "blue", Icon: Eye },
  rejected: { label: "Rejected", hue: "pink", Icon: XIcon },
};

export function Ideas({ ideas }) {
  const order = ["selected", "watch", "rejected"];
  const sorted = [...ideas].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return (
    <ul className="rs-ideas">
      {sorted.map((i, n) => {
        const st = STATUS[i.status] || STATUS.watch;
        return (
          <li key={n} className="rs-idea" data-hue={st.hue}>
            <div className="rs-idea__head">
              <span className="rs-idea__icon"><st.Icon size={13} strokeWidth={2.6} aria-hidden="true" /></span>
              <span className="rs-idea__sym">{i.side === "sell" ? "Sell" : "Buy"} {i.symbol}</span>
              <span className="rs-idea__status">{st.label}</span>
              {i.size ? <span className="rs-idea__size">{i.size}</span> : null}
            </div>
            <p className="rs-idea__text">{i.status === "rejected" ? i.whyRejected : i.thesis}</p>
            {i.sourceIds?.length ? <p className="rs-idea__refs">Sources: {i.sourceIds.join(", ")}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function Orders({ orders, marks }) {
  if (!orders?.length) return <p className="rs-empty">No orders. This call ended as a plan or hold, so no fills and no fees.</p>;
  return (
    <div className="rs-orders">
      {orders.map((o) => {
        const pnl = pnlSince(o, marks);
        return (
          <div key={o.id} className="rs-order" data-hue={o.side === "buy" ? "emerald" : "pink"}>
            <div className="rs-order__top">
              <span className="rs-pill" data-hue={o.side === "buy" ? "emerald" : "pink"}>{o.side.toUpperCase()}</span>
              <b>{o.symbol}</b>
              <span className="tabular-nums">{o.qty} @ {fmtMoney(o.price)}</span>
              <span className="rs-order__notional tabular-nums">{fmtMoney(o.notional)}</span>
            </div>
            <div className="rs-order__grid tabular-nums">
              <span>Quote {fmtMoney(o.quote?.price)} · {fmtTime(o.quote?.time)}</span>
              <span>Slippage {o.slippage?.bps} bps · {fmtMoney(o.slippage?.cost)}</span>
              <span>SEC fee {fmtMoney(o.fees?.secFee)} · TAF {fmtMoney(o.fees?.finraTaf)}</span>
              <span>Fees total {fmtMoney(o.fees?.total)} · {o.broker}</span>
              {pnl != null ? <span className={pnl >= 0 ? "up" : "down"}>P&amp;L since {fmtMoney(pnl)}</span> : null}
              {o.check?.at ? <span>Placed {fmtTime(o.check.at)}</span> : o.session ? <span>{SESSION_LABEL[o.session] || o.session}</span> : null}
            </div>
            {o.edge ? <EdgeBox edge={o.edge} activity={o.activity} /> : null}
          </div>
        );
      })}
    </div>
  );
}

/** Edge vs cost for one order: the frugality rule made visible. */
export function EdgeBox({ edge, activity }) {
  const ok = edge.passed;
  const hue = ok ? "emerald" : edge.exempt ? "cyan" : "pink";
  return (
    <div className="rs-edge" data-hue={hue}>
      <div className="rs-edge__top">
        <span className="rs-edge__icon"><Gauge size={13} strokeWidth={2.5} aria-hidden="true" /></span>
        <b>Edge {fmtMoney(edge.expectedEdge)}</b>
        <span className="rs-edge__vs">vs round trip {fmtMoney(edge.roundTrip?.total)}</span>
        <span className="rs-pill" data-hue={hue}>{ok ? fmtX(edge.ratio) : edge.exempt ? "Cap trim" : fmtX(edge.ratio)}</span>
      </div>
      <div className="rs-order__grid tabular-nums">
        <span>Expected {edge.expectedMovePct != null ? fmtPct(edge.expectedMovePct) : "—"}{edge.target ? ` → ${fmtMoney(edge.target)}` : ""}</span>
        <span>Horizon {edge.horizon || "—"}</span>
        <span>{edge.stop ? `Stop ${fmtMoney(edge.stop)}` : "Invalidation"}{edge.invalidation ? ` · ${edge.invalidation}` : ""}</span>
        <span>Cost {edge.roundTrip?.pctOfNotional != null ? `${edge.roundTrip.pctOfNotional.toFixed(2)}%` : "—"} (slip {fmtMoney(edge.roundTrip?.slippage)} + fees {fmtMoney((edge.roundTrip?.buyFees || 0) + (edge.roundTrip?.sellFees || 0))})</span>
        {activity ? <span>Trade #{activity.tradesToday} today · #{activity.tradesWeek} this week</span> : null}
        {activity?.softWarning ? <span className="down">Over soft limit: {activity.frequencyReason}</span> : null}
      </div>
    </div>
  );
}

/** Per-trader trade count, turnover and costs, today and this week. */
export function ActivityCard({ traders, activity, frugality }) {
  if (!activity) return null;
  const soft = frugality || { softTradesPerDay: 3, softTradesPerWeek: 10, edgeMultiple: 3 };
  return (
    <section className="rs-activity" aria-label="Trading activity">
      <div className="rs-activity__head">
        <span className="rs-kicker"><Zap size={12} aria-hidden="true" /> Activity · frugal by design</span>
        <span className="rs-meta">soft limit {soft.softTradesPerDay}/day · {soft.softTradesPerWeek}/wk · edge ≥ {soft.edgeMultiple}× cost</span>
      </div>
      <div className="rs-activity__rows">
        {traders.map((t) => {
          const a = activity[t.id];
          if (!a) return null;
          const hot = a.tradesToday > soft.softTradesPerDay || a.tradesWeek > soft.softTradesPerWeek;
          return (
            <div key={t.id} className="rs-act" data-hue={TRADER_HUE[t.id]}>
              <span className="rs-avatar rs-avatar--sm" aria-hidden="true">{t.name[0]}</span>
              <span className="rs-act__name">{t.name}</span>
              <span className={`rs-act__n tabular-nums ${hot ? "down" : ""}`} title="Trades today / this week"><b>{a.tradesToday}</b> today · <b>{a.tradesWeek}</b> wk</span>
              <span className="rs-act__t tabular-nums" title="Turnover today / this week (share of NAV)">{fmtMoney(a.turnoverToday)}{a.turnoverTodayPct != null ? ` (${a.turnoverTodayPct}%)` : ""} · {fmtMoney(a.turnoverWeek)} wk</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Block({ hue, icon: Icon, title, children }) {
  return (
    <section className="rs-block" data-hue={hue}>
      <h4 className="rs-block__title">
        {Icon ? <span className="rs-block__icon"><Icon size={14} strokeWidth={2.4} aria-hidden="true" /></span> : null}
        {title}
      </h4>
      {children}
    </section>
  );
}

export function DecisionCard({ rec, marks, trader, defaultOpen = false, onStrategy }) {
  const [open, setOpen] = useState(defaultOpen);
  const motionOn = useMotionOn();
  const hue = TRADER_HUE[rec.trader] || "slate";
  const counts = ["x", "web", "sec", "market"].map((t) => [t, rec.sources.filter((s) => s.type === t).length]).filter(([, n]) => n);
  const d = rec.decision || {};
  return (
    <motion.article
      layout={motionOn ? "position" : false}
      className={`rs-card ${open ? "is-open" : ""}`}
      data-hue={hue}
      initial={motionOn ? { opacity: 0, y: 16 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={motionTransition(motionOn, SLEEVE_SPRING)}
    >
      <button type="button" className="rs-card__head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="rs-avatar" aria-hidden="true">{rec.traderName?.[0]}</span>
        <span className="rs-card__who">
          <span className="rs-card__name">{rec.traderName}</span>
          <span className="rs-card__sub">{whenLabel(rec)} · {rec.strategy?.name || "—"}{rec.strategy ? ` v${rec.strategy.version}` : ""}</span>
        </span>
        <span className="rs-action" data-action={d.action}>{ACTION_LABEL[d.action] || "—"}</span>
      </button>
      <p className="rs-card__summary">{d.summary}</p>
      <div className="rs-card__foot">
        {counts.map(([t, n]) => (
          <span key={t} className="rs-mini" data-hue={SOURCE_META[t].hue}>{SOURCE_META[t].label} {n}</span>
        ))}
        {d.confidence != null ? (
          <span className="rs-conf" title="Confidence">
            <span className="rs-conf__track"><span className="rs-conf__fill" style={{ width: `${Math.round(d.confidence * 100)}%` }} /></span>
            {Math.round(d.confidence * 100)}%
          </span>
        ) : null}
        <button type="button" className="rs-more" onClick={() => setOpen(!open)} aria-label={open ? "Collapse" : "Expand"}>
          {open ? "Less" : "Why?"} <ChevronDown size={14} className={open ? "rot" : ""} aria-hidden="true" />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            className="rs-card__body"
            initial={motionOn ? { opacity: 0, height: 0 } : false}
            animate={{ opacity: 1, height: "auto" }}
            exit={motionOn ? { opacity: 0, height: 0 } : { opacity: 0 }}
            transition={motionTransition(motionOn, { type: "spring", stiffness: 300, damping: 30 })}
          >
            <figure className="rs-why" data-hue={hue}>
              <span className="rs-why__mark" aria-hidden="true">“</span>
              <blockquote><p>{d.reasoning}</p></blockquote>
              <figcaption>{rec.traderName} · decision: {ACTION_LABEL[d.action]}</figcaption>
            </figure>
            {d.plan?.length ? (
              <Block hue="blue" icon={Target} title="Plan">
                <ol className="rs-plan">
                  {d.plan.map((p, i) => (
                    <li key={i}>
                      <span className="rs-plan__sess">{p.session ? SESSION_LABEL[p.session] || p.session : "When timing is right"}</span>
                      <b>{p.side === "sell" ? "Sell" : "Buy"} {p.symbol}</b> <span className="rs-plan__size">{p.size}</span>
                      <span className="rs-plan__trig">{p.trigger}</span>
                    </li>
                  ))}
                </ol>
              </Block>
            ) : null}
            {rec.trigger ? (
              <Block hue="blue" icon={Zap} title="Why this check escalated">
                <p className="rs-text">{rec.trigger}</p>
              </Block>
            ) : null}
            <Block hue="violet" title="Regime at decision">
              <p className="rs-text">{rec.regime?.summary}</p>
            </Block>
            <Block hue="slate" title={`Sources (${rec.sources.length})`}>
              <SourceChips sources={rec.sources} />
            </Block>
            <Block hue="emerald" title={`Ideas considered (${rec.ideas.length})`}>
              <Ideas ideas={rec.ideas} />
            </Block>
            <Block hue="pink" icon={ShieldAlert} title="Risk notes">
              <ul className="rs-risks">{(rec.risks || []).map((r, i) => <li key={i}>{r}</li>)}</ul>
            </Block>
            <Block hue="cyan" icon={Receipt} title="Orders, fees & P&L">
              <Orders orders={rec.orderDetails} marks={marks} />
            </Block>
            <div className="rs-card__links">
              {onStrategy ? <button type="button" className="rs-link" onClick={() => onStrategy(rec.trader)}>{trader?.name || rec.traderName} strategy →</button> : null}
              <a className="rs-link" href={`https://github.com/shenoyabhijith/captain-feed/blob/main/${rec.path}`} target="_blank" rel="noopener noreferrer">Raw record <ExternalLink size={13} aria-hidden="true" /></a>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}
