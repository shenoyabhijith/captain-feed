import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import { loadTheme } from "../../storage";
import { useFinances } from "../../finances/useFinances.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import FeedDock from "./FeedDock.jsx";
import SleevePanel, { outlineBadgeClass } from "./SleeveCard.jsx";
import DecisionList from "./DecisionList.jsx";
import {
  dayPnlFromEquity,
  money,
  signedMoney,
  signedPct,
} from "./financesFormat.js";

const SLIDE_ORDER = ["value", "swing", "coresat", "mega", "riskoff"];

export default function FinancesApp() {
  const fin = useFinances();
  const [theme] = useState(loadTheme);
  const isDark = theme === "dark";
  const carouselRef = useRef(null);
  const [slide, setSlide] = useState(0);

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
      SLIDE_ORDER.map((id) => sleevesById[id]).filter(Boolean).concat(
        (fin.ledger?.sleeves || []).filter((s) => !SLIDE_ORDER.includes(s.id))
      ),
    [sleevesById, fin.ledger]
  );

  const slideNames = useMemo(
    () => [...orderedSleeves.map((s) => s.name), "Activity"],
    [orderedSleeves]
  );
  const slideCount = slideNames.length;

  const syncSlide = useCallback(() => {
    const el = carouselRef.current;
    if (!el || !slideCount) return;
    const cards = el.querySelectorAll("[data-slide]");
    if (!cards.length) return;
    const left = el.scrollLeft;
    let best = 0;
    let bestDist = Infinity;
    cards.forEach((card, idx) => {
      const dist = Math.abs(card.offsetLeft - left);
      if (dist < bestDist) {
        bestDist = dist;
        best = idx;
      }
    });
    setSlide(best);
  }, [slideCount]);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return undefined;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        syncSlide();
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    syncSlide();
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [syncSlide, fin.status]);

  function goSlide(i) {
    const el = carouselRef.current;
    if (!el) return;
    const card = el.querySelector(`[data-slide="${i}"]`);
    if (card) {
      el.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
      setSlide(i);
    }
  }

  function onCarouselKey(e) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goSlide(Math.min(slide + 1, slideCount - 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goSlide(Math.max(slide - 1, 0));
    }
  }

  return (
    <div
      className={`finances-root fin-r4 flex h-dvh flex-col ${
        isDark ? "dark" : ""
      }`}
    >
      <header className="fin-r4-header shrink-0 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              className="size-7 rounded-md"
              src={`${import.meta.env.BASE_URL}icons/${isDark ? "mark-28-dark.png" : "mark-28-light.png"}`}
              width={28}
              height={28}
              alt=""
            />
            <div className="min-w-0">
              <h1 className="font-heading font-semibold text-base leading-tight">
                Finances
              </h1>
              <p className="text-muted-foreground text-xs">
                Captain Feed · paper desk
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="min-h-12 px-3 font-semibold"
              aria-current="page"
            >
              Finances
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-12 px-3"
              render={<Link to="/finances/admin" />}
            >
              Admin
            </Button>
          </div>
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
        <p className="px-4 py-6 text-muted-foreground text-sm">Loading ledger…</p>
      ) : fin.status === "error" ? (
        <div className="px-4 py-4">
          <Alert variant="error" role="alert">
            <AlertTitle>Could not load finances-ledger.json</AlertTitle>
          </Alert>
        </div>
      ) : (
        <>
          {/* Sticky Portfolio strip — short; stays while carousel swipes */}
          <div
            className="fin-portfolio-strip shrink-0"
            role="region"
            aria-label="Portfolio summary"
          >
            <div className="ps-left">
              <p className="ps-label">
                Total NAV · {fin.stats.enabledCount} sleeves
              </p>
              <p className="ps-nav tabular-nums">{money(fin.stats.nav)}</p>
            </div>
            <div className="ps-right">
              <Badge
                variant="outline"
                className={outlineBadgeClass}
                title="Simulated paper trading only"
              >
                PAPER ONLY
              </Badge>
              <p
                className={`ps-day tabular-nums ${
                  day.dayPnl >= 0
                    ? "text-success-foreground"
                    : "text-destructive-foreground"
                }`}
              >
                {signedMoney(day.dayPnl)}{" "}
                <span className="pct opacity-85">
                  {signedPct(day.dayPnlPct)} day
                </span>
              </p>
            </div>
          </div>

          <div className="fin-body mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col pb-[calc(72px+env(safe-area-inset-bottom,0px))]">
            <p className="swipe-hint shrink-0 px-3 pt-2 text-muted-foreground text-[0.6875rem]">
              Swipe cards · peek shows more bots
            </p>
            <div
              ref={carouselRef}
              className="fin-carousel"
              tabIndex={0}
              role="region"
              aria-roledescription="carousel"
              aria-label="Trading bots and activity"
              aria-describedby="fin-carousel-caption"
              onKeyDown={onCarouselKey}
            >
              {orderedSleeves.map((s, idx) => {
                const stats = fin.sleeveStats(s);
                const weight =
                  fin.stats.nav > 0 ? stats.nav / fin.stats.nav : 0;
                const sDayPnl =
                  Math.round(day.dayPnl * weight * 100) / 100;
                const sDayPct =
                  stats.nav > 0
                    ? Math.round((sDayPnl / stats.nav) * 10000) / 100
                    : 0;
                return (
                  <article
                    key={s.id}
                    className="fin-bot-card"
                    data-slide={idx}
                    data-name={s.name}
                    aria-label={`${s.name} sleeve`}
                  >
                    <SleevePanel
                      sleeve={s}
                      stats={stats}
                      marks={fin.marks}
                      dayPnl={sDayPnl}
                      dayPnlPct={sDayPct}
                      layout="carousel"
                    />
                  </article>
                );
              })}

              <article
                className="fin-bot-card"
                data-slide={orderedSleeves.length}
                data-name="Activity"
                aria-label="Activity decision log"
              >
                <div className="fin-bot-card-head">
                  <h3 className="m-0 font-semibold text-[0.9375rem] leading-tight">
                    Activity
                  </h3>
                  <p className="m-0 text-muted-foreground text-xs">
                    Decision log · expand for signalSource chips
                  </p>
                </div>
                <div className="fin-bot-card-body">
                  <DecisionList
                    decisions={(fin.ledger?.decisions || []).slice(0, 16)}
                  />
                  <p className="text-muted-foreground text-[0.6875rem]">
                    {fin.ledger?.meta?.note ||
                      "Firstmate issued paper capital · real EOD marks."}
                  </p>
                </div>
              </article>
            </div>

            <div className="fin-carousel-chrome shrink-0">
              <div
                className="fin-dots"
                role="tablist"
                aria-label="Bot cards"
              >
                {slideNames.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    role="tab"
                    aria-label={name}
                    aria-current={slide === i ? "true" : undefined}
                    data-dot={i}
                    onClick={() => goSlide(i)}
                  >
                    <i aria-hidden="true" />
                  </button>
                ))}
              </div>
              <p
                className="fin-carousel-caption"
                id="fin-carousel-caption"
                aria-live="polite"
              >
                <strong>
                  {slide + 1} / {slideCount}
                </strong>{" "}
                · {slideNames[slide] || ""}
              </p>
            </div>
          </div>
        </>
      )}

      <FeedDock />
    </div>
  );
}
