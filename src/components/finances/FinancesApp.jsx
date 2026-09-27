import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import { loadTheme } from "../../storage";
import { useFinances } from "../../finances/useFinances.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Frame,
  FrameHeader,
  FrameTitle,
  FrameDescription,
  FramePanel,
  FrameFooter,
} from "@/components/ui/frame";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from "@/components/ui/accordion";
import FeedDock from "./FeedDock.jsx";
import EquityChart from "./EquityChart.jsx";
import { SleeveSummary, SleeveDetail } from "./SleeveCard.jsx";
import DecisionList from "./DecisionList.jsx";
import {
  dayPnlFromEquity,
  formatAsOf,
  money,
  signedMoney,
  signedPct,
} from "./financesFormat.js";

export default function FinancesApp() {
  const fin = useFinances();
  const [theme] = useState(loadTheme);
  const isDark = theme === "dark";

  const day = useMemo(
    () => dayPnlFromEquity(fin.ledger?.equity || [], fin.stats?.nav),
    [fin.ledger, fin.stats]
  );

  const markSrc = fin.ledger?.meta?.priceSource || "yahoo";
  const asOf = fin.ledger?.meta?.asOf;
  const sleeves = fin.ledger?.sleeves || [];

  return (
    <div
      className={`finances-root min-h-dvh pb-[calc(72px+env(safe-area-inset-bottom,0px))] ${
        isDark ? "dark" : ""
      }`}
    >
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-md">
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
            <Badge variant="outline" title="Simulated paper trading only">
              PAPER ONLY
            </Badge>
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

      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-4">
        {fin.isPreview ? (
          <Alert variant="warning" role="status">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>PAPER preview</AlertTitle>
            <AlertDescription>
              Not committed ledger. Download JSON for Firstmate to commit, or
              reset overlay in Admin.
            </AlertDescription>
          </Alert>
        ) : null}

        {fin.status === "loading" ? (
          <p className="text-muted-foreground text-sm">Loading ledger…</p>
        ) : fin.status === "error" ? (
          <Alert variant="error" role="alert">
            <AlertTitle>Could not load finances-ledger.json</AlertTitle>
          </Alert>
        ) : (
          <>
            <Alert variant="warning">
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>Paper capital · real EOD marks</AlertTitle>
              <AlertDescription>
                Firstmate issued $100/sleeve. Marks from stamped EOD feed — not
                live ACH.
              </AlertDescription>
            </Alert>

            <Frame aria-labelledby="sec-port">
              <FrameHeader>
                <FrameTitle id="sec-port">Portfolio</FrameTitle>
                <FrameDescription>
                  {fin.stats.enabledCount} sleeves · $100 start each · asOf EOD
                </FrameDescription>
              </FrameHeader>
              <FramePanel className="flex flex-col gap-3 p-4 sm:p-5">
                <p className="text-muted-foreground text-xs">Total NAV</p>
                <p className="font-semibold text-4xl tabular-nums tracking-tight">
                  {money(fin.stats.nav)}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <p className="text-muted-foreground text-xs">Day P&amp;L</p>
                    <p
                      className={`font-semibold tabular-nums text-sm ${
                        day.dayPnl >= 0
                          ? "text-success-foreground"
                          : "text-destructive-foreground"
                      }`}
                    >
                      {signedMoney(day.dayPnl)}{" "}
                      <span className="font-medium text-xs opacity-80">
                        ({signedPct(day.dayPnlPct)})
                      </span>
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <p className="text-muted-foreground text-xs">Total P&amp;L</p>
                    <p
                      className={`font-semibold tabular-nums text-sm ${
                        fin.stats.pnl >= 0
                          ? "text-success-foreground"
                          : "text-destructive-foreground"
                      }`}
                    >
                      {signedMoney(fin.stats.pnl)}{" "}
                      <span className="font-medium text-xs opacity-80">
                        ({signedPct(fin.stats.pnlPct)})
                      </span>
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">
                  Cash{" "}
                  <strong className="text-foreground">
                    {fin.stats.cashPct.toFixed(1)}%
                  </strong>{" "}
                  of portfolio
                </p>
                <EquityChart points={fin.ledger?.equity || []} />
              </FramePanel>
              <FrameFooter className="text-muted-foreground text-xs">
                asOf · {formatAsOf(asOf)} · {markSrc} · paper
              </FrameFooter>
            </Frame>

            <Frame aria-labelledby="sec-sleeves">
              <FrameHeader>
                <FrameTitle id="sec-sleeves">Sleeves</FrameTitle>
                <FrameDescription>
                  Accordion · Value open · Robinhood-class glance
                </FrameDescription>
              </FrameHeader>
              <Accordion defaultValue={["value"]} className="flex flex-col gap-1 px-1 pb-1">
                {sleeves.map((s) => {
                  const stats = fin.sleeveStats(s);
                  const weight =
                    fin.stats.nav > 0 ? stats.nav / fin.stats.nav : 0;
                  const sDayPnl =
                    Math.round(day.dayPnl * weight * 100) / 100;
                  const sDayPct =
                    stats.nav > 0
                      ? Math.round((sDayPnl / stats.nav) * 10000) / 100
                      : 0;
                  const sleeveDecisions = (fin.ledger?.decisions || [])
                    .filter((d) => d.agentId === s.id)
                    .slice(0, 8);
                  return (
                    <FramePanel key={s.id} className="p-0" data-sleeve={s.id}>
                      <AccordionItem value={s.id} className="border-0">
                        <AccordionTrigger className="min-h-12 items-start gap-3 px-4 py-3 hover:no-underline [&>svg]:mt-1.5">
                          <SleeveSummary
                            sleeve={s}
                            stats={stats}
                            marks={fin.marks}
                            dayPnl={sDayPnl}
                            dayPnlPct={sDayPct}
                          />
                        </AccordionTrigger>
                        <AccordionPanel className="px-4 pb-4">
                          <SleeveDetail
                            sleeve={s}
                            stats={stats}
                            marks={fin.marks}
                            decisions={sleeveDecisions}
                          />
                        </AccordionPanel>
                      </AccordionItem>
                    </FramePanel>
                  );
                })}
              </Accordion>
            </Frame>

            <Frame aria-labelledby="sec-activity">
              <FrameHeader>
                <FrameTitle id="sec-activity">Activity</FrameTitle>
                <FrameDescription>
                  Decision log · expand for signalSource badges
                </FrameDescription>
              </FrameHeader>
              <FramePanel className="p-4">
                <DecisionList
                  decisions={(fin.ledger?.decisions || []).slice(0, 12)}
                />
              </FramePanel>
            </Frame>

            <p className="pb-2 font-mono text-[0.6875rem] text-muted-foreground">
              {fin.ledger?.meta?.note ||
                "Firstmate issued paper capital · real EOD marks."}
            </p>
          </>
        )}
      </main>

      <FeedDock />
    </div>
  );
}
