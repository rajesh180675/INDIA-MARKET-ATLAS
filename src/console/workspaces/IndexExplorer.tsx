import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import {
  DENOMINATIONS,
  MAX_YEAR,
  MIN_YEAR,
  type Denomination,
  indexInDenomination,
  sensexOHLCData,
} from "@/domain/atlas";
import {
  cagr,
  drawdownSeries,
  rollingCagr,
  totalReturn,
} from "@/domain/series";
import { downloadCsv } from "@/lib/csv";
import PlotFigure from "../PlotFigure";
import Provenance from "../Provenance";
import { atlasColors } from "../theme-colors";
import { Readout, Segmented } from "../controls";
import { readInt, readString, useAtlasState } from "../url-state";

const denomOptions = DENOMINATIONS.map((d) => ({
  id: d.id,
  label: d.label,
  title: d.blurb,
}));

const styleOptions = [
  { id: "line", label: "Line", title: "Year-end index path on a log scale" },
  { id: "candle", label: "Candle", title: "Sensex annual OHLC bars (nominal only, 1979+)" },
] as const;

export default function IndexExplorer({ theme }: { theme: string }) {
  const { state, setParam } = useAtlasState();
  const denom = readString(state.params, "denom", "nominal") as Denomination;
  const from = readInt(state.params, "from", MIN_YEAR);
  const to = readInt(state.params, "to", MAX_YEAR);
  const style = readString(state.params, "style", "line") as "line" | "candle";

  // Candle is only meaningful in nominal terms (OHLC is raw Sensex points)
  // and only available from 1979. Force back to line otherwise.
  const candleAvailable = denom === "nominal" && to >= 1979;
  const effectiveStyle = candleAvailable && style === "candle" ? "candle" : "line";

  const view = useMemo(() => {
    const full = indexInDenomination(denom);
    const windowed = full.window(from, to);
    const dd = drawdownSeries(windowed);
    const roll = rollingCagr(full, 10).window(from, to);
    const maxDd = dd.reduce((m, p) => Math.min(m, p.drawdownPct), 0);
    const worstYear = dd.find((p) => p.drawdownPct === maxDd)?.year ?? null;
    return {
      full,
      windowed,
      dd,
      roll,
      mult: totalReturn(windowed, from, to),
      cagrPct: cagr(windowed, from, to),
      maxDd,
      worstYear,
    };
  }, [denom, from, to]);

  const c = useMemo(() => atlasColors(), [theme]);

  const pathOptions = useMemo<Plot.PlotOptions>(
    () => ({
      height: 300,
      marginLeft: 56,
      marginRight: 16,
      style: { background: "transparent", color: c.inkSoft },
      x: { label: null, tickFormat: "d", grid: false },
      y: {
        label: `Index (${from}=100, log)`,
        type: "log",
        grid: true,
        tickFormat: "~s",
      },
      marks: [
        Plot.ruleY([100], { stroke: c.rule, strokeDasharray: "3,3" }),
        Plot.lineY(view.windowed.points, {
          x: "year",
          y: "value",
          stroke: c.signal,
          strokeWidth: 1.75,
        }),
        Plot.dot(
          view.windowed.points.filter(
            (p) => p.year === from || p.year === to,
          ),
          { x: "year", y: "value", fill: c.signal, r: 3 },
        ),
        Plot.tip(
          view.windowed.points,
          Plot.pointerX({
            x: "year",
            y: "value",
            fill: "var(--surface)",
            stroke: c.ruleStrong,
          }),
        ),
      ],
    }),
    [view.windowed, from, to, c],
  );

  // Annual OHLC candle chart (Sensex points, log scale).
  // Wick: ruleX from low to high. Body: rectY from open to close, colored by direction.
  const candleData = useMemo(
    () =>
      sensexOHLCData
        .filter((d) => d.year >= Math.max(from, 1979) && d.year <= to)
        .map((d) => ({
          ...d,
          up: d.close >= d.open,
          bodyLo: Math.min(d.open, d.close),
          bodyHi: Math.max(d.open, d.close),
        })),
    [from, to],
  );

  const candleOptions = useMemo<Plot.PlotOptions>(
    () => ({
      height: 300,
      marginLeft: 56,
      marginRight: 16,
      style: { background: "transparent", color: c.inkSoft },
      x: { label: null, tickFormat: "d", grid: false },
      y: {
        label: "Sensex (points, log)",
        type: "log",
        grid: true,
        tickFormat: "~s",
      },
      color: { domain: [true, false], range: [c.pos, c.neg] },
      marks: [
        // Wick: high-low rule
        Plot.ruleX(candleData, {
          x: "year",
          y1: "low",
          y2: "high",
          stroke: (d: { up: boolean }) => (d.up ? c.pos : c.neg),
          strokeWidth: 1,
        }),
        // Body: open-close rectangle
        Plot.rectY(candleData, {
          x1: (d: { year: number }) => d.year - 0.35,
          x2: (d: { year: number }) => d.year + 0.35,
          y1: "bodyLo",
          y2: "bodyHi",
          fill: (d: { up: boolean }) => (d.up ? c.pos : c.neg),
          stroke: (d: { up: boolean }) => (d.up ? c.pos : c.neg),
        }),
        Plot.tip(
          candleData,
          Plot.pointerX({
            x: "year",
            y: "close",
            title: (d: { year: number; open: number; high: number; low: number; close: number }) =>
              `${d.year}\nOpen ${d.open.toFixed(0)}  Close ${d.close.toFixed(0)}\nHigh ${d.high.toFixed(0)}  Low ${d.low.toFixed(0)}`,
            fill: "var(--surface)",
            stroke: c.ruleStrong,
          }),
        ),
      ],
    }),
    [candleData, c],
  );

  const ddOptions = useMemo<Plot.PlotOptions>(
    () => ({
      height: 170,
      marginLeft: 56,
      marginRight: 16,
      style: { background: "transparent", color: c.inkSoft },
      x: { label: null, tickFormat: "d" },
      y: { label: "Drawdown %", grid: true, domain: [Math.min(-5, view.maxDd * 1.1), 0] },
      marks: [
        Plot.areaY(view.dd, {
          x: "year",
          y: "drawdownPct",
          fill: c.negWash,
        }),
        Plot.lineY(view.dd, {
          x: "year",
          y: "drawdownPct",
          stroke: c.neg,
          strokeWidth: 1.25,
        }),
        Plot.ruleY([0], { stroke: c.rule }),
      ],
    }),
    [view.dd, view.maxDd, c],
  );

  const rollOptions = useMemo<Plot.PlotOptions>(
    () => ({
      height: 170,
      marginLeft: 56,
      marginRight: 16,
      style: { background: "transparent", color: c.inkSoft },
      x: { label: null, tickFormat: "d" },
      y: { label: "10Y rolling CAGR %", grid: true },
      marks: [
        Plot.ruleY([0], { stroke: c.rule }),
        Plot.lineY(view.roll.points, {
          x: "year",
          y: "value",
          stroke: c.cat[2],
          strokeWidth: 1.5,
        }),
      ],
    }),
    [view.roll, c],
  );

  function exportView() {
    const rows = view.dd.map((p) => ({
      year: p.year,
      denomination: denom,
      index_value: Number(p.value.toFixed(2)),
      drawdown_pct: Number(p.drawdownPct.toFixed(2)),
      rolling10y_cagr_pct:
        view.roll.at(p.year) != null ? Number(view.roll.at(p.year)!.toFixed(2)) : "",
    }));
    downloadCsv(`india-index-${denom}-${from}-${to}.csv`, rows);
  }

  return (
    <div className="space-y-6">
      {/* Control strip */}
      <div className="surface flex flex-wrap items-end justify-between gap-5 p-4">
        <div>
          <div className="eyebrow mb-1.5">Denomination</div>
          <Segmented
            ariaLabel="Index denomination"
            value={denom}
            options={denomOptions}
            onChange={(id) => setParam("denom", id)}
          />
        </div>
        <div>
          <div className="eyebrow mb-1.5">Style</div>
          <Segmented
            ariaLabel="Chart style"
            value={effectiveStyle}
            options={styleOptions}
            onChange={(id) => {
              if (id === "candle" && !candleAvailable) return;
              setParam("style", id);
            }}
          />
          {!candleAvailable ? (
            <div className="num mt-1 text-[11px]" style={{ color: "var(--ink-faint)" }}>
              candle: nominal, 1979+ only
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={exportView}
          className="segmented px-3 py-2 text-[12px]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
        >
          Export view CSV
        </button>
      </div>

      {/* Readouts */}
      <div className="surface grid grid-cols-2 gap-6 p-5 sm:grid-cols-4">
        <Readout
          label="Total return"
          value={view.mult}
          decimals={1}
          unit="×"
          tone="signal"
          caption={`${from} → ${to}`}
        />
        <Readout
          label="CAGR"
          value={view.cagrPct}
          decimals={1}
          unit="%"
          tone={view.cagrPct != null && view.cagrPct >= 0 ? "pos" : "neg"}
          caption="annualized"
        />
        <Readout
          label="Max drawdown"
          value={view.maxDd}
          decimals={1}
          unit="%"
          tone="neg"
          caption={view.worstYear ? `trough ${view.worstYear}` : undefined}
        />
        <Readout
          label="Years"
          value={to - from}
          unit="yr"
          caption={DENOMINATIONS.find((d) => d.id === denom)?.label}
        />
      </div>

      {/* Index path or Candle */}
      <figure className="surface p-5">
        <figcaption className="mb-3 flex items-baseline justify-between">
          <h3 className="display text-lg">
            {effectiveStyle === "candle" ? "Sensex annual OHLC" : "Index path"}
          </h3>
          <span className="eyebrow">
            {effectiveStyle === "candle"
              ? "wick = high/low · body = open→close · log"
              : `log scale · ${from}=100`}
          </span>
        </figcaption>
        {effectiveStyle === "candle" ? (
          <PlotFigure
            options={candleOptions}
            ariaLabel={`Sensex annual OHLC candles from ${Math.max(from, 1979)} to ${to}`}
          />
        ) : (
          <PlotFigure
            options={pathOptions}
            ariaLabel={`Equity index in ${denom} terms, ${from} to ${to}, log scale`}
          />
        )}
        <div className="rule-t mt-4 pt-3">
          <Provenance id={`index-${denom}`} />
        </div>
      </figure>

      {/* Drawdown + rolling CAGR side by side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <figure className="surface p-5">
          <figcaption className="mb-3">
            <h3 className="display text-lg">Drawdowns</h3>
          </figcaption>
          <PlotFigure options={ddOptions} ariaLabel="Drawdown from running peak" />
        </figure>
        <figure className="surface p-5">
          <figcaption className="mb-3">
            <h3 className="display text-lg">Rolling 10-year CAGR</h3>
          </figcaption>
          <PlotFigure options={rollOptions} ariaLabel="Rolling ten year CAGR" />
        </figure>
      </div>
    </div>
  );
}
