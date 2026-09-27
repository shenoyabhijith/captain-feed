import { useState } from "react";
import { Link } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import { loadTheme } from "../../storage";
import { useFinances } from "../../finances/useFinances.js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Frame,
  FrameHeader,
  FrameTitle,
  FrameDescription,
  FramePanel,
} from "@/components/ui/frame";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import FeedDock from "./FeedDock.jsx";
import DecisionList from "./DecisionList.jsx";
import { outlineBadgeClass } from "./SleeveCard.jsx";
import { money } from "./financesFormat.js";

export default function FinancesAdmin() {
  const fin = useFinances();
  const [theme] = useState(loadTheme);
  const isDark = theme === "dark";
  const [resetText, setResetText] = useState("");
  const [runMsg, setRunMsg] = useState("");

  function handleRun() {
    const next = fin.run("admin");
    if (next) {
      setRunMsg(
        `Run ${next.ops?.lastRunId || "ok"} — paper preview (not committed).`
      );
    }
  }

  function handleReset() {
    if (resetText !== "RESET") return;
    fin.resetOverlay();
    setResetText("");
    setRunMsg("Overlay cleared · displaying checked-in ledger.");
  }

  const ops = fin.ledger?.ops || {};
  const sleeves = fin.ledger?.sleeves || [];
  const promoteAny = sleeves.some((s) => s.promoteReady);

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
                Admin
              </h1>
              <p className="text-muted-foreground text-xs">Ops · Firstmate</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge
              variant="outline"
              className={outlineBadgeClass}
              title="Simulated paper trading only"
            >
              PAPER ONLY
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-12 px-3"
              render={<Link to="/finances" />}
            >
              Glance
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
              Not committed ledger. Use Download for Firstmate commit.
            </AlertDescription>
          </Alert>
        ) : null}

        <Alert variant="warning">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Firstmate issued paper capital · real EOD marks.</AlertTitle>
          <AlertDescription>
            Ledger: <code>docs/data/finances-ledger.json</code> on Pages
            (file-backed). Traders cannot edit balances in UI.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-2">
          <Button
            className="min-h-12"
            onClick={handleRun}
            disabled={fin.status !== "ready"}
          >
            Run today
          </Button>
          <Button
            variant="outline"
            className="min-h-12"
            onClick={fin.downloadLedger}
            disabled={!fin.ledger}
          >
            Download ledger
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          EOD · manual first · sim through engine only
        </p>
        {runMsg ? (
          <p className="text-sm text-foreground" role="status">
            {runMsg}
          </p>
        ) : null}

        {fin.status === "loading" ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : fin.status === "error" ? (
          <Alert variant="error" role="alert">
            <AlertTitle>Could not load finances-ledger.json.</AlertTitle>
          </Alert>
        ) : (
          <>
            <Frame aria-labelledby="admin-sleeves">
              <FrameHeader>
                <FrameTitle id="admin-sleeves">Sleeves</FrameTitle>
                <FrameDescription>Enable / disable for next Run</FrameDescription>
              </FrameHeader>
              <FramePanel className="flex flex-col gap-1 p-2 sm:p-3">
                {sleeves.map((s) => {
                  const on = s.enabled !== false;
                  return (
                    <div
                      key={s.id}
                      className="flex min-h-12 items-center justify-between gap-3 rounded-lg px-2 py-1"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="font-medium text-sm">{s.name}</span>
                        {s.intelAsymmetric ? (
                          <Badge
                            variant="outline"
                            className={outlineBadgeClass}
                            title="Align Q2B — intel-asymmetric"
                          >
                            Intel-asym
                          </Badge>
                        ) : null}
                      </div>
                      <span className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center">
                        <Switch
                          checked={on}
                          onCheckedChange={(next) =>
                            fin.setSleeveEnabled(s.id, next)
                          }
                          aria-label={`${s.name} sleeve ${on ? "on" : "off"}`}
                          className="min-h-12 min-w-[3.25rem] [--thumb-size:1.25rem] sm:[--thumb-size:1.25rem]"
                        />
                      </span>
                    </div>
                  );
                })}
              </FramePanel>
            </Frame>

            <Frame aria-labelledby="admin-fm">
              <FrameHeader>
                <FrameTitle id="admin-fm">Firstmate · ops</FrameTitle>
                <FrameDescription>
                  Not a sixth P&amp;L sleeve — Run / rank / promote-ready
                </FrameDescription>
              </FrameHeader>
              <FramePanel className="flex flex-col gap-3 p-4">
                <div
                  className="flex flex-wrap gap-2"
                  aria-label="Firstmate flags"
                >
                  <Badge variant={ops.lastRunId ? "success" : "outline"}>
                    run {ops.lastRunId ? "✓" : "—"}
                  </Badge>
                  <Badge
                    variant={(ops.rankOrder || []).length ? "success" : "outline"}
                  >
                    rank {(ops.rankOrder || []).length ? "✓" : "—"}
                  </Badge>
                  <Badge variant={promoteAny ? "warning" : "outline"}>
                    promote-ready{promoteAny ? "" : " off"}
                  </Badge>
                </div>
                {ops.lastRunId ? (
                  <p className="font-mono text-xs text-muted-foreground">
                    lastRunId · {ops.lastRunId}
                  </p>
                ) : null}
                {ops.notes ? (
                  <p className="text-muted-foreground text-xs">{ops.notes}</p>
                ) : null}
              </FramePanel>
            </Frame>

            <Frame aria-labelledby="admin-pos">
              <FrameHeader>
                <FrameTitle id="admin-pos">Positions</FrameTitle>
                <FrameDescription>Open lots across sleeves</FrameDescription>
              </FrameHeader>
              <FramePanel className="p-4">
                <Table variant="card" aria-label="Open positions">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Sleeve</TableHead>
                      <TableHead className="text-right">MTM</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fin.allPositions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4}>No open positions</TableCell>
                      </TableRow>
                    ) : (
                      fin.allPositions.map((r) => (
                        <TableRow key={`${r.sleeveId}-${r.symbol}`}>
                          <TableCell className="font-semibold tabular-nums">
                            {r.symbol}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {Number(r.qty).toFixed(4)}
                          </TableCell>
                          <TableCell>{r.sleeveName}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {money(r.mtm)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </FramePanel>
            </Frame>

            <Frame aria-labelledby="admin-log">
              <FrameHeader>
                <FrameTitle id="admin-log">Decision log</FrameTitle>
                <FrameDescription>Dense ops view</FrameDescription>
              </FrameHeader>
              <FramePanel className="p-4">
                <DecisionList
                  decisions={(fin.ledger?.decisions || []).slice(0, 24)}
                  dense
                />
              </FramePanel>
            </Frame>

            <Frame aria-labelledby="admin-reset">
              <FrameHeader>
                <FrameTitle id="admin-reset">Reset all</FrameTitle>
                <FrameDescription>
                  Ops only · typed confirm · clears session preview overlay
                </FrameDescription>
              </FrameHeader>
              <FramePanel className="flex flex-col gap-3 p-4">
                <Alert variant="warning">
                  <TriangleAlert aria-hidden="true" />
                  <AlertTitle>Destructive for session overlay</AlertTitle>
                  <AlertDescription>
                    Reloads the checked-in ledger. Type <code>RESET</code> to
                    enable.
                  </AlertDescription>
                </Alert>
                <Field>
                  <FieldLabel htmlFor="finances-reset-input">
                    Confirm reset
                  </FieldLabel>
                  <Input
                    id="finances-reset-input"
                    type="text"
                    placeholder="Type RESET"
                    autoComplete="off"
                    spellCheck={false}
                    value={resetText}
                    onChange={(e) => setResetText(e.target.value)}
                    className="min-h-12"
                  />
                  <FieldDescription>
                    Exact match required · traders cannot edit balances
                  </FieldDescription>
                </Field>
                <Button
                  variant="destructive"
                  className="min-h-12"
                  disabled={resetText !== "RESET"}
                  aria-disabled={resetText !== "RESET"}
                  onClick={handleReset}
                >
                  Reset all sleeves
                </Button>
              </FramePanel>
            </Frame>
          </>
        )}
      </main>

      <FeedDock />
    </div>
  );
}
