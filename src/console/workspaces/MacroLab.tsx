import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import {
  MAX_YEAR,
  MIN_YEAR,
  macroById,
  macroCatalog,
  macroCategories,
  nominalIndex,
} from "@/domain/atlas";
import { Series, alignSeries, cagr, correlationMatrix, yoy } from "@/domain/series";
import { downloadCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/format";
import PlotFigure from "../PlotFigure";
import Provenance from "../Provenance";
import { atlasColors } from "../theme-colors";
import { FieldLabel, Readout, Segmented } from "../controls";
import { readInt, readString, useAtlasState } from "../url-state";

const modeOptions = [
  { id: "time", label: "Time series", title: "Two indicators over time" },
  { id: "scatter", label: "Cross-plot", title: "One indicator against the other" },
  { id: "matrix", label: "Matrix", title: "Pearson correlation across all indicators + equity" },
] as const;

function Select({
  value,
  onChange,
  label,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  ariaLabel: string;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="surface w-full px-3 py-2 text-[13px]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--ink)", background: "var(--surface)" }}
      >
        {macroCategories.map((cat) => (
          <optgroup key={cat} label={cat}>
            {macroCatalog
              .filter((m) => m.category === cat)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export default function MacroLab({ theme }: { theme: string }) {
  const { state, setParam } = useAtlasState();
  const mode = readString(state.params, "mmode", "time") as "time" | "scatter" | "matrix";
  const aId = readString(state.params, "a", "usd-inr");
  const bId = readString(state.params, "b", "forex-reserves");
  const from = readInt(state.params, "from", MIN_YEAR);
  const to = readInt(state.params, "to", MAX_YEAR);

  const a = macroById(aId) ?? macroCatalog[0];
  const b = macroById(bId) ?? macroCatalog[1];

  const c = useMemo(() => atlasColors(), [theme]);

  const aWin = useMemo(() => a.series.window(from, to), [a, from, to]);
  const bWin = useMemo(() => b.series.window(from, to), [b, from, to]);

  const aCagr = useMemo(() => {
    const ys = aWin.years;
    return ys.length > 1 ? cagr(aWin, ys[0], ys[ys.length - 1]) : null;
  }, [aWin]);
  const bCagr = useMemo(() => {
    const ys = bWin.years;
    return ys.length > 1 ? cagr(bWin, ys[0], ys[ys.length - 1]) : null;
  }, [bWin]);

  const paired = useMemo(() => {
    const rows = alignSeries([aWin, bWin], "intersection");
    return rows
      .filter((r) => r[a.series.id] != null && r[b.series.id] != null)
      .map((r) => ({
        year: r.year,
        x: r[a.series.id] as number,
        y: r[b.series.id] as number,
      }));
  }, [aWin, bWin, a.series.id, b.series.id]);

  // Correlation matrix: 16 indicators + the equity index, computed on YoY %
  // changes (level series correlate spuriously due to common time trend).
  const matrixData = useMemo(() => {
    const yoyAll: Series[] = [
      ...macroCatalog.map((m) => {
        const y = yoy(m.series);
        // Re-id so the matrix labels match the catalog
        return new Series(m.id, m.label, "% YoY", y.points);
      }),
      (() => {
        const y = yoy(nominalIndex);
        return new Series("equity", "Equity Index", "% YoY", y.points);
      })(),
    ];
    return correlationMatrix(yoyAll, from, to);
  }, [from, to]);

  const labels = useMemo(
    () => [...macroCatalog.map((m) => m.label), "Equity Index"],
    [],
  );

  const timeOptions = useMemo<Plot.PlotOptions>(() => {
    const norm = (vals: { year: number; value: number }[]) => {
      const xs = vals.map((v) => v.value);
      const lo = Math.min(...xs);
      const hi = Math.max(...xs);
      const span = hi - lo || 1;
      return vals.map((v) => ({ year: v.year, value: ((v.value - lo) / span) * 100 }));
    };
    const aN = norm(aWin.points).map((p) => ({ ...p, series: a.label }));
    const bN = norm(bWin.points).map((p) => ({ ...p, series: b.label }));
    return {
      height: 320,
      marginLeft: 48,
      marginRight: 16,
      marginBottom: 32,
      style: { background: "transparent", color: c.inkSoft },
      color: { domain: [a.label, b.label], range: [c.cat[0], c.cat[1]], legend: true },
      x: { label: null, tickFormat: "d" },
      y: { label: "normalized to window range (0–100)", grid: true },
      marks: [
        Plot.lineY(aN, { x: "year", y: "value", stroke: "series", strokeWidth: 1.75 }),
        Plot.lineY(bN, { x: "year", y: "value", stroke: "series", strokeWidth: 1.75 }),
      ],
    };
  }, [aWin, bWin, a.label, b.label, c]);

  const scatterOptions = useMemo<Plot.PlotOptions>(
    () => ({
      height: 340,
      marginLeft: 56,
      marginBottom: 40,
      style: { background: "transparent", color: c.inkSoft },
      x: { label: `${a.label} (${a.unit}) →`, grid: true },
      y: { label: `↑ ${b.label} (${b.unit})`, grid: true },
      marks: [
        Plot.dot(paired, {
          x: "x",
          y: "y",
          fill: c.signal,
          fillOpacity: 0.55,
          r: 3.5,
        }),
        Plot.linearRegressionY(paired, { x: "x", y: "y", stroke: c.neg, strokeWidth: 1.25 }),
        Plot.tip(
          paired,
          Plot.pointer({ x: "x", y: "y", title: (d) => `${d.year}`, fill: "var(--surface)", stroke: c.ruleStrong }),
        ),
      ],
    }),
    [paired, a.label, a.unit, b.label, b.unit, c],
  );

  const matrixOptions = useMemo<Plot.PlotOptions>(
    () => ({
      height: Math.max(480, labels.length * 22),
      marginLeft: 150,
      marginTop: 110,
      marginRight: 16,
      marginBottom: 16,
      style: { background: "transparent", color: c.inkSoft, fontSize: "11px" },
      x: { label: null, domain: labels, tickRotate: -50 },
      y: { label: null, domain: labels },
      color: {
        type: "diverging",
        scheme: "RdBu",
        domain: [-1, 1],
        legend: true,
        label: "correlation r",
      },
      marks: [
        Plot.cell(matrixData, {
          x: "aLabel",
          y: "bLabel",
          fill: "r",
          stroke: c.rule,
          strokeWidth: 0.5,
        }),
        Plot.text(matrixData, {
          x: "aLabel",
          y: "bLabel",
          text: (d: { r: number | null }) =>
            d.r == null ? "" : Math.abs(d.r) < 0.3 ? "" : d.r.toFixed(2),
          fontSize: 9,
          fill: (d: { r: number | null }) =>
            d.r != null && Math.abs(d.r) > 0.6 ? "white" : c.ink,
        }),
        Plot.tip(
          matrixData,
          Plot.pointer({
            x: "aLabel",
            y: "bLabel",
            title: (d: { aLabel: string; bLabel: string; r: number | null }) =>
              `${d.aLabel} × ${d.bLabel}\nr = ${d.r != null ? d.r.toFixed(3) : "n/a"}`,
            fill: "var(--surface)",
            stroke: c.ruleStrong,
          }),
        ),
      ],
    }),
    [matrixData, labels, c],
  );

  function exportPair() {
    const rows = alignSeries([aWin, bWin], "union").map((r) => ({
      year: r.year,
      [a.id]: r[a.series.id] ?? "",
      [b.id]: r[b.series.id] ?? "",
    }));
    downloadCsv(`india-macro-${a.id}-vs-${b.id}-${from}-${to}.csv`, rows);
  }

  function exportMatrix() {
    downloadCsv(
      `india-macro-correlation-${from}-${to}.csv`,
      matrixData.map((d) => ({
        a: d.aLabel,
        b: d.bLabel,
        r: d.r != null ? Number(d.r.toFixed(4)) : "",
      })),
    );
  }

  return (
    <div className="space-y-6">
      <div className="surface grid gap-5 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
        {mode !== "matrix" ? (
          <>
            <Select label="Series A" ariaLabel="Indicator A" value={a.id} onChange={(v) => setParam("a", v)} />
            <Select label="Series B" ariaLabel="Indicator B" value={b.id} onChange={(v) => setParam("b", v)} />
          </>
        ) : (
          <div className="sm:col-span-2">
            <FieldLabel>Matrix</FieldLabel>
            <p className="text-[13px]" style={{ color: "var(--ink-soft)" }}>
              Pearson correlation of YoY % changes across all 16 indicators plus the equity
              index. Click a cell tooltip to see the exact r value. Window:{" "}
              <span className="num">{from}–{to}</span>.
            </p>
          </div>
        )}
        <div className="flex items-end gap-3">
          <div>
            <FieldLabel>View</FieldLabel>
            <Segmented ariaLabel="Macro view mode" value={mode} options={modeOptions} onChange={(id) => setParam("mmode", id)} />
          </div>
          <button
            type="button"
            onClick={mode === "matrix" ? exportMatrix : exportPair}
            className="segmented px-3 py-2 text-[12px]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {mode !== "matrix" ? (
        <div className="surface grid grid-cols-2 gap-6 p-5 sm:grid-cols-4">
          <Readout label={`${a.label} — start`} value={aWin.at(aWin.firstYear ?? from) ?? null} decimals={1} caption={`${a.unit} · ${from}`} tone="signal" />
          <Readout label={`${a.label} — CAGR`} value={aCagr} decimals={1} unit="%" tone={aCagr != null && aCagr >= 0 ? "pos" : "neg"} />
          <Readout label={`${b.label} — start`} value={bWin.at(bWin.firstYear ?? from) ?? null} decimals={1} caption={`${b.unit} · ${from}`} tone="signal" />
          <Readout label={`${b.label} — CAGR`} value={bCagr} decimals={1} unit="%" tone={bCagr != null && bCagr >= 0 ? "pos" : "neg"} />
        </div>
      ) : (
        <div className="surface grid grid-cols-2 gap-6 p-5 sm:grid-cols-4">
          <Readout
            label="Indicators"
            value={macroCatalog.length + 1}
            caption="incl. equity index"
            tone="signal"
          />
          <Readout
            label="Window"
            value={to - from}
            unit="yr"
            caption={`${from}–${to}`}
          />
          <Readout
            label="Strongest +r"
            value={Math.max(...matrixData.filter((d) => d.a !== d.b && d.r != null).map((d) => d.r!))}
            decimals={2}
            tone="pos"
            caption={(() => {
              const off = matrixData.filter((d) => d.a !== d.b && d.r != null);
              const top = off.reduce((m, d) => (d.r! > (m.r ?? -Infinity) ? d : m), off[0]);
              return top ? `${top.aLabel.split(" ")[0]} × ${top.bLabel.split(" ")[0]}` : undefined;
            })()}
          />
          <Readout
            label="Strongest −r"
            value={Math.min(...matrixData.filter((d) => d.a !== d.b && d.r != null).map((d) => d.r!))}
            decimals={2}
            tone="neg"
            caption={(() => {
              const off = matrixData.filter((d) => d.a !== d.b && d.r != null);
              const bot = off.reduce((m, d) => (d.r! < (m.r ?? Infinity) ? d : m), off[0]);
              return bot ? `${bot.aLabel.split(" ")[0]} × ${bot.bLabel.split(" ")[0]}` : undefined;
            })()}
          />
        </div>
      )}

      <figure className="surface p-5">
        <figcaption className="mb-3 flex items-baseline justify-between">
          <h3 className="display text-lg">
            {mode === "time" ? "Overlay" : mode === "scatter" ? "Cross-plot" : "Correlation matrix (YoY changes)"}
          </h3>
          <span className="eyebrow">
            {mode === "scatter"
              ? "regression line · point = year"
              : mode === "matrix"
                ? "blue = positive · red = negative · |r|<0.3 unlabeled"
                : "each line normalized to its own range"}
          </span>
        </figcaption>
        {mode === "time" ? (
          <PlotFigure options={timeOptions} ariaLabel={`${a.label} and ${b.label} over time`} />
        ) : mode === "scatter" ? (
          <PlotFigure options={scatterOptions} ariaLabel={`${b.label} against ${a.label}`} />
        ) : (
          <PlotFigure options={matrixOptions} ariaLabel="Correlation matrix of macro indicators and equity index YoY returns" />
        )}
        {mode !== "matrix" ? (
          <div className="rule-t mt-4 grid gap-3 pt-3 sm:grid-cols-2">
            <Provenance id={a.id} label={`${a.label} — sources`} />
            <Provenance id={b.id} label={`${b.label} — sources`} />
          </div>
        ) : (
          <p className="mt-3 text-[12px]" style={{ color: "var(--ink-faint)" }}>
            Note: correlations on YoY % changes (not levels) to avoid spurious
            time-trend correlation. Hover any cell for the exact r value, including pairs where
            |r|&lt;0.3 was hidden for legibility. Top correlations summarized as readouts above:{" "}
            {formatNumber(matrixData.length, 0)} cells computed.
          </p>
        )}
      </figure>
    </div>
  );
}
