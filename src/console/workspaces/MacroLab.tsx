import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import {
  MAX_YEAR,
  MIN_YEAR,
  macroById,
  macroCatalog,
  macroCategories,
} from "@/domain/atlas";
import { alignSeries, cagr } from "@/domain/series";
import { downloadCsv } from "@/lib/csv";
import PlotFigure from "../PlotFigure";
import { atlasColors } from "../theme-colors";
import { FieldLabel, Readout, Segmented } from "../controls";
import { readInt, readString, useAtlasState } from "../url-state";

const modeOptions = [
  { id: "time", label: "Time series", title: "Two indicators over time" },
  { id: "scatter", label: "Cross-plot", title: "One indicator against the other" },
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
  const mode = readString(state.params, "mmode", "time") as "time" | "scatter";
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

  // Scatter: align both onto shared years (intersection) and pair the values.
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

  const timeOptions = useMemo<Plot.PlotOptions>(() => {
    // Normalize both to 0..100 of their own windowed range so a dual scale reads
    // on one axis without misleading shared units.
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

  function exportPair() {
    const rows = alignSeries([aWin, bWin], "union").map((r) => ({
      year: r.year,
      [a.id]: r[a.series.id] ?? "",
      [b.id]: r[b.series.id] ?? "",
    }));
    downloadCsv(`india-macro-${a.id}-vs-${b.id}-${from}-${to}.csv`, rows);
  }

  return (
    <div className="space-y-6">
      <div className="surface grid gap-5 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
        <Select label="Series A" ariaLabel="Indicator A" value={a.id} onChange={(v) => setParam("a", v)} />
        <Select label="Series B" ariaLabel="Indicator B" value={b.id} onChange={(v) => setParam("b", v)} />
        <div className="flex items-end gap-3">
          <div>
            <FieldLabel>View</FieldLabel>
            <Segmented ariaLabel="Macro view mode" value={mode} options={modeOptions} onChange={(id) => setParam("mmode", id)} />
          </div>
          <button
            type="button"
            onClick={exportPair}
            className="segmented px-3 py-2 text-[12px]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="surface grid grid-cols-2 gap-6 p-5 sm:grid-cols-4">
        <Readout label={`${a.label} — start`} value={aWin.at(aWin.firstYear ?? from) ?? null} decimals={1} caption={`${a.unit} · ${from}`} tone="signal" />
        <Readout label={`${a.label} — CAGR`} value={aCagr} decimals={1} unit="%" tone={aCagr != null && aCagr >= 0 ? "pos" : "neg"} />
        <Readout label={`${b.label} — start`} value={bWin.at(bWin.firstYear ?? from) ?? null} decimals={1} caption={`${b.unit} · ${from}`} tone="signal" />
        <Readout label={`${b.label} — CAGR`} value={bCagr} decimals={1} unit="%" tone={bCagr != null && bCagr >= 0 ? "pos" : "neg"} />
      </div>

      <figure className="surface p-5">
        <figcaption className="mb-3 flex items-baseline justify-between">
          <h3 className="display text-lg">{mode === "time" ? "Overlay" : "Cross-plot"}</h3>
          <span className="eyebrow">
            {mode === "scatter" ? "regression line · point = year" : "each line normalized to its own range"}
          </span>
        </figcaption>
        {mode === "time" ? (
          <PlotFigure options={timeOptions} ariaLabel={`${a.label} and ${b.label} over time`} />
        ) : (
          <PlotFigure options={scatterOptions} ariaLabel={`${b.label} against ${a.label}`} />
        )}
        <p className="mt-3 text-[12px]" style={{ color: "var(--ink-faint)" }}>
          Source: {a.source}; {b.source}.
        </p>
      </figure>
    </div>
  );
}
