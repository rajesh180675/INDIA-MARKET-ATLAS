import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import {
  SENSEX_MONTHLY_FIRST,
  SENSEX_MONTHLY_LAST,
  sensexMonthly,
} from "@/domain/atlas";
import {
  addMonths,
  annualizedSharpe,
  annualizedVolatility,
  fromMonthKey,
  monthKey,
  monthlyCagr,
  monthlyDrawdownSeries,
  monthlyTotalReturn,
  rollingMonthlyCagr,
  type MonthKey,
} from "@/domain/monthly";
import { downloadCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/format";
import PlotFigure from "../PlotFigure";
import Provenance from "../Provenance";
import { atlasColors } from "../theme-colors";
import { Readout, Segmented } from "../controls";
import { readInt, useAtlasState } from "../url-state";

// Pre-compute rolling vol on the full series once. Rolling vol is the
// trailing 12M annualized standard deviation of log returns; we compute it
// here rather than in the domain layer to keep monthly.ts narrow.
function rollingAnnualizedVol(
  series = sensexMonthly,
  windowMonths = 12,
): Array<{ key: MonthKey; vol: number }> {
  const pts = series.points;
  const out: Array<{ key: MonthKey; vol: number }> = [];
  // log returns first
  const rets: Array<{ key: MonthKey; r: number }> = [];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i - 1].value > 0 && pts[i].value > 0) {
      rets.push({
        key: pts[i].key,
        r: Math.log(pts[i].value / pts[i - 1].value),
      });
    }
  }
  // trailing window stdev × √12
  for (let i = windowMonths - 1; i < rets.length; i++) {
    const slice = rets.slice(i - windowMonths + 1, i + 1).map((p) => p.r);
    const mean = slice.reduce((s, x) => s + x, 0) / slice.length;
    const variance =
      slice.reduce((s, x) => s + (x - mean) ** 2, 0) / (slice.length - 1);
    out.push({ key: rets[i].key, vol: Math.sqrt(variance) * Math.sqrt(12) * 100 });
  }
  return out;
}

const windowOptions = [
  { id: "all", label: "Full" },
  { id: "10y", label: "10Y" },
  { id: "5y", label: "5Y" },
  { id: "post-gfc", label: "Post-GFC" },
] as const;
type WindowOpt = (typeof windowOptions)[number]["id"];

function resolveWindow(opt: WindowOpt): { from: MonthKey; to: MonthKey } {
  const last = SENSEX_MONTHLY_LAST;
  switch (opt) {
    case "10y":
      return { from: addMonths(last, -120 + 1), to: last };
    case "5y":
      return { from: addMonths(last, -60 + 1), to: last };
    case "post-gfc":
      return { from: monthKey(2009, 7), to: last };
    default:
      return { from: SENSEX_MONTHLY_FIRST, to: last };
  }
}

function fmtMonth(k: MonthKey): string {
  const { year, month } = fromMonthKey(k);
  const m = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month];
  return `${m} ${year}`;
}

// Plot expects Date objects on a time scale; convert MonthKey → Date
function keyToDate(k: MonthKey): Date {
  const { year, month } = fromMonthKey(k);
  return new Date(Date.UTC(year, month - 1, 1));
}

export default function VolatilityRisk({ theme }: { theme: string }) {
  // theme parameter triggers re-render on theme switch so colors refresh
  void theme;
  const { state, setParam } = useAtlasState();
  const c = atlasColors();

  const windowChoice = (state.params.get("vw") ?? "post-gfc") as WindowOpt;
  const window = useMemo(() => resolveWindow(windowChoice), [windowChoice]);

  // Rolling window length for the rolling-CAGR / rolling-Sharpe charts
  const rollMonthsRaw = readInt(state.params, "roll", 36);
  const rollMonths = Math.min(120, Math.max(12, rollMonthsRaw));

  const sliced = useMemo(
    () => sensexMonthly.window(window.from, window.to),
    [window.from, window.to],
  );

  // Headline metrics for the active window
  const sharpe = annualizedSharpe(sliced, 6);
  const vol = annualizedVolatility(sliced);
  const cagrPct = monthlyCagr(sensexMonthly, window.from, window.to);
  const totalReturnPct = monthlyTotalReturn(
    sensexMonthly,
    window.from,
    window.to,
  );

  // Drawdown series (always full data — drawdowns need running peak from origin)
  const drawdowns = useMemo(() => monthlyDrawdownSeries(sliced), [sliced]);
  const maxDD = drawdowns.reduce(
    (m, p) => (p.drawdown < m.drawdown ? p : m),
    drawdowns[0] ?? { key: window.from, drawdown: 0 },
  );

  // Rolling CAGR series
  const rollingCagr = useMemo(
    () => rollingMonthlyCagr(sliced, rollMonths),
    [sliced, rollMonths],
  );

  // Rolling vol series (computed locally — see helper at top of file)
  const rollingVol = useMemo(
    () => rollingAnnualizedVol(sliced, rollMonths),
    [sliced, rollMonths],
  );

  // ─── Plots ─────────────────────────────────────────────────────────────

  const drawdownData = useMemo(
    () => drawdowns.map((p) => ({ date: keyToDate(p.key), drawdown: p.drawdown })),
    [drawdowns],
  );

  const drawdownOptions: Plot.PlotOptions = {
    width: 880,
    height: 240,
    marginLeft: 56,
    marginRight: 16,
    marginBottom: 32,
    style: { background: "transparent", color: c.inkSoft, fontSize: "12px" },
    x: { type: "time", label: null, grid: false },
    y: {
      label: "↑ Drawdown %",
      grid: true,
      tickFormat: (d: number) => `${d.toFixed(0)}`,
    },
    marks: [
      Plot.areaY(drawdownData, {
        x: "date",
        y: "drawdown",
        y2: 0,
        fill: c.negWash,
      }),
      Plot.lineY(drawdownData, {
        x: "date",
        y: "drawdown",
        stroke: c.neg,
        strokeWidth: 1.25,
      }),
      Plot.ruleY([0], { stroke: c.rule, strokeDasharray: "3,3" }),
    ],
  };

  const rollingCagrData = useMemo(
    () =>
      rollingCagr.points.map((p) => ({
        date: keyToDate(p.key),
        value: p.value,
      })),
    [rollingCagr],
  );

  const rollingCagrOptions: Plot.PlotOptions = {
    width: 880,
    height: 220,
    marginLeft: 56,
    marginRight: 16,
    marginBottom: 32,
    style: { background: "transparent", color: c.inkSoft, fontSize: "12px" },
    x: { type: "time", label: null, grid: false },
    y: {
      label: `↑ Rolling ${rollMonths}M CAGR %`,
      grid: true,
      tickFormat: (d: number) => `${d.toFixed(0)}`,
    },
    marks: [
      Plot.lineY(rollingCagrData, {
        x: "date",
        y: "value",
        stroke: c.signal,
        strokeWidth: 1.5,
      }),
      Plot.ruleY([0], { stroke: c.rule, strokeDasharray: "3,3" }),
    ],
  };

  const rollingVolData = useMemo(
    () =>
      rollingVol.map((p) => ({
        date: keyToDate(p.key),
        vol: p.vol,
      })),
    [rollingVol],
  );

  const rollingVolOptions: Plot.PlotOptions = {
    width: 880,
    height: 220,
    marginLeft: 56,
    marginRight: 16,
    marginBottom: 32,
    style: { background: "transparent", color: c.inkSoft, fontSize: "12px" },
    x: { type: "time", label: null, grid: false },
    y: {
      label: `↑ Rolling ${rollMonths}M annualized vol %`,
      grid: true,
      tickFormat: (d: number) => `${d.toFixed(0)}`,
    },
    marks: [
      Plot.lineY(rollingVolData, {
        x: "date",
        y: "vol",
        stroke: c.cat[1],
        strokeWidth: 1.5,
      }),
    ],
  };

  // CSV export
  const handleExport = () => {
    downloadCsv(
      `sensex-volatility-${windowChoice}.csv`,
      drawdowns.map((p) => {
        const { year, month } = fromMonthKey(p.key);
        return {
          year,
          month,
          close: sensexMonthly.at(p.key) ?? "",
          drawdown_pct: p.drawdown.toFixed(3),
        };
      }),
    );
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="surface flex flex-wrap items-end gap-5 p-5">
        <div>
          <div className="eyebrow mb-1.5">Window</div>
          <Segmented
            ariaLabel="Time window"
            value={windowChoice}
            options={windowOptions.map((o) => ({ id: o.id, label: o.label }))}
            onChange={(v) => setParam("vw", v === "post-gfc" ? null : v)}
          />
        </div>
        <div>
          <div className="eyebrow mb-1.5">Rolling window</div>
          <Segmented
            ariaLabel="Rolling window length"
            value={String(rollMonths)}
            options={[
              { id: "12", label: "12M" },
              { id: "36", label: "36M" },
              { id: "60", label: "60M" },
            ]}
            onChange={(v) =>
              setParam("roll", v === "36" ? null : v)
            }
          />
        </div>
        <div className="ml-auto">
          <button
            type="button"
            onClick={handleExport}
            className="segmented px-3 py-1.5 text-[12px]"
            aria-label="Export drawdown series as CSV"
          >
            Export drawdowns CSV
          </button>
        </div>
      </div>

      {/* Headline readouts */}
      <div className="surface grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Readout
          label="Sharpe (rf=6%)"
          value={sharpe == null ? null : Number(sharpe.toFixed(2))}
          decimals={2}
          tone="signal"
        />
        <Readout
          label="Annualized vol"
          value={vol == null ? null : Number((vol * 100).toFixed(1))}
          unit="%"
          decimals={1}
          tone="ink"
        />
        <Readout
          label="Max drawdown"
          value={Number(maxDD.drawdown.toFixed(1))}
          unit="%"
          decimals={1}
          tone="neg"
          caption={`trough ${fmtMonth(maxDD.key)}`}
        />
        <Readout
          label="CAGR"
          value={cagrPct == null ? null : Number(cagrPct.toFixed(1))}
          unit="%"
          decimals={1}
          tone="signal"
          caption={`${fmtMonth(window.from)} → ${fmtMonth(window.to)}`}
        />
      </div>

      {/* Drawdown chart */}
      <figure className="surface p-5">
        <figcaption className="mb-3 flex items-baseline justify-between">
          <h3 className="display text-lg">Monthly drawdown from running peak</h3>
          <span className="num text-[12px]" style={{ color: "var(--ink-faint)" }}>
            total return {totalReturnPct == null ? "—" : `${formatNumber(totalReturnPct)}%`}
          </span>
        </figcaption>
        <PlotFigure
          options={drawdownOptions}
          ariaLabel={`Monthly Sensex drawdown from running peak, ${fmtMonth(window.from)} to ${fmtMonth(window.to)}`}
        />
        <p className="mt-3 text-[12px]" style={{ color: "var(--ink-faint)" }}>
          Annual data smooths intra-year troughs. The {Math.abs(maxDD.drawdown).toFixed(0)}% trough at {fmtMonth(maxDD.key)}
          {" "}is invisible to year-end series — and represents the actual lived experience of a buy-and-hold investor.
        </p>
        <div className="rule-t mt-4 pt-3">
          <Provenance id="sensex-monthly" />
        </div>
      </figure>

      {/* Rolling charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <figure className="surface p-5">
          <figcaption className="mb-3">
            <h3 className="display text-lg">Rolling {rollMonths}M CAGR</h3>
            <span className="num text-[12px]" style={{ color: "var(--ink-faint)" }}>
              annualized return over a moving {rollMonths}-month window
            </span>
          </figcaption>
          <PlotFigure
            options={rollingCagrOptions}
            ariaLabel={`Rolling ${rollMonths} month annualized return for Sensex`}
          />
        </figure>

        <figure className="surface p-5">
          <figcaption className="mb-3">
            <h3 className="display text-lg">Rolling {rollMonths}M volatility</h3>
            <span className="num text-[12px]" style={{ color: "var(--ink-faint)" }}>
              annualized stdev of monthly log returns
            </span>
          </figcaption>
          <PlotFigure
            options={rollingVolOptions}
            ariaLabel={`Rolling ${rollMonths} month annualized volatility for Sensex`}
          />
        </figure>
      </div>
    </div>
  );
}
