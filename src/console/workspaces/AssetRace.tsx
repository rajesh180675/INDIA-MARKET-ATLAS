import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import {
  ASSET_RACE_BASE_YEAR,
  MAX_YEAR,
  assetRace,
} from "@/domain/atlas";
import { alignSeries, cagr } from "@/domain/series";
import { downloadCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/format";
import PlotFigure from "../PlotFigure";
import Provenance from "../Provenance";
import { atlasColors } from "../theme-colors";
import { FieldLabel, Segmented } from "../controls";
import { readList, readString, useAtlasState } from "../url-state";

const scaleOptions = [
  { id: "linear", label: "Linear" },
  { id: "log", label: "Log" },
] as const;

export default function AssetRace({ theme }: { theme: string }) {
  const { state, setParam } = useAtlasState();
  const scale = readString(state.params, "scale", "log") as "linear" | "log";

  // Track selection: URL stores comma-separated ids; default = all visible.
  const visibleParam = readList(state.params, "tracks");
  const visible = useMemo(
    () =>
      visibleParam.length > 0
        ? new Set(visibleParam)
        : new Set(assetRace.map((t) => t.id)),
    [visibleParam],
  );

  const c = useMemo(() => atlasColors(), [theme]);

  // Long-format rows for Plot's color/series channel
  const rows = useMemo(() => {
    const out: { year: number; value: number; track: string }[] = [];
    for (const t of assetRace) {
      if (!visible.has(t.id)) continue;
      for (const p of t.series.window(ASSET_RACE_BASE_YEAR, MAX_YEAR).points) {
        out.push({ year: p.year, value: p.value, track: t.label });
      }
    }
    return out;
  }, [visible]);

  const visibleTracks = assetRace.filter((t) => visible.has(t.id));
  const palette = useMemo(
    () => visibleTracks.map((_, i) => c.cat[i % c.cat.length]),
    [visibleTracks, c],
  );

  // Final-year values & CAGRs for the readouts table
  const summary = useMemo(
    () =>
      assetRace.map((t) => {
        const end = t.series.at(MAX_YEAR);
        const cagrPct = cagr(t.series, ASSET_RACE_BASE_YEAR, MAX_YEAR);
        return { ...t, end, cagrPct };
      }),
    [],
  );

  const figureOptions = useMemo<Plot.PlotOptions>(
    () => ({
      height: 380,
      marginLeft: 64,
      marginRight: 16,
      marginBottom: 32,
      style: { background: "transparent", color: c.inkSoft },
      color: {
        domain: visibleTracks.map((t) => t.label),
        range: palette,
        legend: true,
      },
      x: { label: null, tickFormat: "d" },
      y: {
        label: `Value (1979=100${scale === "log" ? ", log" : ""})`,
        type: scale === "log" ? "log" : "linear",
        grid: true,
        tickFormat: "~s",
      },
      marks: [
        Plot.ruleY([100], { stroke: c.rule, strokeDasharray: "3,3" }),
        Plot.lineY(rows, {
          x: "year",
          y: "value",
          stroke: "track",
          strokeWidth: 1.75,
        }),
        Plot.tip(
          rows,
          Plot.pointer({
            x: "year",
            y: "value",
            stroke: c.ruleStrong,
            fill: "var(--surface)",
          }),
        ),
      ],
    }),
    [rows, visibleTracks, palette, scale, c],
  );

  function toggleTrack(id: string) {
    const next = new Set(visible);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    // Don't allow deselecting all
    if (next.size === 0) return;
    setParam("tracks", Array.from(next).join(","));
  }

  function exportCsv() {
    const aligned = alignSeries(
      assetRace.map((t) => t.series),
      "union",
    );
    downloadCsv(
      `india-asset-race-${ASSET_RACE_BASE_YEAR}-${MAX_YEAR}.csv`,
      aligned.map((r) => {
        const row: Record<string, number | string> = { year: r.year };
        for (const t of assetRace) {
          const v = r[t.series.id];
          row[t.id] = v != null ? Number(Number(v).toFixed(2)) : "";
        }
        return row;
      }),
    );
  }

  return (
    <div className="space-y-6">
      <div className="surface flex flex-wrap items-end justify-between gap-5 p-4">
        <div>
          <FieldLabel>Tracks</FieldLabel>
          <div className="mt-1 flex flex-wrap gap-2">
            {assetRace.map((t) => {
              const on = visible.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTrack(t.id)}
                  aria-pressed={on}
                  title={t.blurb}
                  className="px-3 py-1.5 text-[12px]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    border: "1px solid var(--rule-strong)",
                    background: on ? "var(--signal)" : "transparent",
                    color: on ? "var(--surface)" : "var(--ink-soft)",
                    cursor: "pointer",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <FieldLabel>Scale</FieldLabel>
          <Segmented
            ariaLabel="Y-axis scale"
            value={scale}
            options={scaleOptions}
            onChange={(id) => setParam("scale", id)}
          />
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="segmented px-3 py-2 text-[12px]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
        >
          Export CSV
        </button>
      </div>

      <figure className="surface p-5">
        <figcaption className="mb-3 flex items-baseline justify-between">
          <h3 className="display text-lg">₹100 in 1979 across asset classes</h3>
          <span className="eyebrow">all rebased to 100 · click legend to toggle</span>
        </figcaption>
        <PlotFigure
          options={figureOptions}
          ariaLabel={`Asset race showing ${visibleTracks
            .map((t) => t.label)
            .join(", ")} from 1979 to ${MAX_YEAR}`}
        />
        <div className="rule-t mt-4 pt-3"><Provenance id="asset-race" /></div>
      </figure>

      {/* Race results ledger */}
      <div className="surface overflow-x-auto p-0">
        <div className="px-4 pt-3">
          <h3 className="display text-lg">Race results ({ASSET_RACE_BASE_YEAR}–{MAX_YEAR})</h3>
        </div>
        <table className="ledger mt-2">
          <thead>
            <tr>
              <th>Track</th>
              <th>Final value</th>
              <th>Multiple</th>
              <th>CAGR</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {summary
              .slice()
              .sort((a, b) => (b.end ?? 0) - (a.end ?? 0))
              .map((t) => (
                <tr key={t.id}>
                  <td style={{ color: "var(--ink)", fontWeight: 600 }}>{t.label}</td>
                  <td style={{ color: "var(--signal)" }}>
                    {t.end != null ? `₹${formatNumber(t.end, 0)}` : "—"}
                  </td>
                  <td>
                    {t.end != null ? `${formatNumber(t.end / 100, 1)}×` : "—"}
                  </td>
                  <td style={{ color: t.cagrPct != null && t.cagrPct >= 0 ? "var(--pos)" : "var(--neg)" }}>
                    {t.cagrPct != null ? `${formatNumber(t.cagrPct, 1)}%` : "—"}
                  </td>
                  <td style={{ whiteSpace: "normal", maxWidth: 360, color: "var(--ink-soft)" }}>
                    {t.blurb}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
