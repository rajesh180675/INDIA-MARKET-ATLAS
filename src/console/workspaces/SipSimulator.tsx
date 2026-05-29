import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import {
  DENOMINATIONS,
  MAX_YEAR,
  MIN_YEAR,
  type Denomination,
  indexInDenomination,
} from "@/domain/atlas";
import { sipReturns } from "@/domain/series";
import { downloadCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/format";
import PlotFigure from "../PlotFigure";
import { atlasColors } from "../theme-colors";
import { FieldLabel, Readout, Segmented } from "../controls";
import { readInt, readString, useAtlasState } from "../url-state";

const denomOptions = DENOMINATIONS.map((d) => ({
  id: d.id,
  label: d.label,
  title: d.blurb,
}));

export default function SipSimulator({ theme }: { theme: string }) {
  const { state, setParam, setParams } = useAtlasState();
  const denom = readString(state.params, "denom", "nominal") as Denomination;
  const start = readInt(state.params, "sipStart", 1995);
  const end = readInt(state.params, "sipEnd", MAX_YEAR);

  const c = useMemo(() => atlasColors(), [theme]);

  const series = useMemo(() => indexInDenomination(denom), [denom]);

  // Single-scenario detail
  const detail = useMemo(() => sipReturns(series, start, end), [series, start, end]);

  // Heatmap: every (startYear, endYear) pair where end > start.
  // Cell color = SIP advantage % vs lumpsum (green = SIP won).
  const heatmap = useMemo(() => {
    const out: Array<{
      start: number;
      end: number;
      sipMultiple: number;
      lumpsumMultiple: number;
      sipAdvantagePct: number;
      sipIrrPct: number | null;
    }> = [];
    const minS = Math.max(MIN_YEAR, series.firstYear ?? MIN_YEAR);
    const maxE = Math.min(MAX_YEAR, series.lastYear ?? MAX_YEAR);
    for (let s = minS; s < maxE; s++) {
      for (let e = s + 1; e <= maxE; e++) {
        const r = sipReturns(series, s, e);
        if (r) {
          out.push({
            start: s,
            end: e,
            sipMultiple: r.sipMultiple,
            lumpsumMultiple: r.lumpsumMultiple,
            sipAdvantagePct: r.sipAdvantagePct,
            sipIrrPct: r.sipIrrPct,
          });
        }
      }
    }
    return out;
  }, [series]);

  // Path comparison: SIP rolling balance vs lumpsum rolling balance over the
  // selected window. Both shown alongside contributed capital.
  const pathData = useMemo(() => {
    if (!detail) return [];
    const rows: Array<{ year: number; value: number; track: string }> = [];
    let sipBalance = 0;
    for (let y = start; y <= end; y++) {
      const py = series.at(y);
      const ey = series.at(y);
      if (py == null || ey == null) continue;
      // Each year invest 1, all units re-valued at current price
      sipBalance += 1;
      // Re-value previous units to today: scale by py/prev. Simpler: track as
      // cumulative units, then multiply by current price each year.
      // Cleaner: track as contribution at each year y_i with units = 1 / price[y_i]
      // and value at year y = units_total * price[y]. We compute fresh each year:
      let units = 0;
      for (let i = start; i <= y; i++) {
        const pi = series.at(i);
        if (pi != null && pi > 0) units += 1 / pi;
      }
      const sipValue = units * ey;
      const startPrice = series.at(start)!;
      const lumpsumValue = (y - start + 1) * (ey / startPrice);
      const contributed = y - start + 1;
      rows.push({ year: y, value: sipValue, track: "SIP balance" });
      rows.push({ year: y, value: lumpsumValue, track: "Lumpsum (same total)" });
      rows.push({ year: y, value: contributed, track: "Capital contributed" });
    }
    return rows;
  }, [detail, series, start, end]);

  const heatmapOptions = useMemo<Plot.PlotOptions>(
    () => ({
      height: 420,
      marginLeft: 56,
      marginBottom: 40,
      marginRight: 16,
      style: { background: "transparent", color: c.inkSoft },
      x: { label: "Start year →", tickFormat: "d", grid: false },
      y: { label: "↑ End year", tickFormat: "d", grid: false },
      color: {
        type: "diverging",
        scheme: "PiYG",
        domain: [-50, 50],
        legend: true,
        label: "SIP advantage % (vs lumpsum)",
      },
      marks: [
        Plot.cell(heatmap, {
          x: "start",
          y: "end",
          fill: "sipAdvantagePct",
          stroke: c.rule,
          strokeWidth: 0.25,
        }),
        // Crosshair for the currently selected scenario
        Plot.dot([{ start, end }], {
          x: "start",
          y: "end",
          stroke: c.signal,
          fill: "none",
          strokeWidth: 2,
          r: 6,
        }),
        Plot.tip(
          heatmap,
          Plot.pointer({
            x: "start",
            y: "end",
            title: (d: {
              start: number;
              end: number;
              sipMultiple: number;
              lumpsumMultiple: number;
              sipAdvantagePct: number;
              sipIrrPct: number | null;
            }) =>
              `${d.start}–${d.end}\nSIP ${d.sipMultiple.toFixed(2)}× · IRR ${
                d.sipIrrPct != null ? d.sipIrrPct.toFixed(1) + "%" : "n/a"
              }\nLumpsum ${d.lumpsumMultiple.toFixed(2)}×\nAdvantage ${d.sipAdvantagePct.toFixed(1)}%`,
            fill: "var(--surface)",
            stroke: c.ruleStrong,
          }),
        ),
      ],
    }),
    [heatmap, start, end, c],
  );

  const pathOptions = useMemo<Plot.PlotOptions>(
    () => ({
      height: 280,
      marginLeft: 56,
      marginRight: 16,
      style: { background: "transparent", color: c.inkSoft },
      color: {
        domain: ["SIP balance", "Lumpsum (same total)", "Capital contributed"],
        range: [c.signal, c.cat[1], c.inkFaint],
        legend: true,
      },
      x: { label: null, tickFormat: "d" },
      y: { label: "Value (₹ per ₹1/year)", grid: true },
      marks: [
        // Dashed line for capital contributed
        Plot.lineY(
          pathData.filter((d) => d.track === "Capital contributed"),
          {
            x: "year",
            y: "value",
            stroke: "track",
            strokeWidth: 1,
            strokeDasharray: "3,3",
          },
        ),
        // Solid lines for SIP and Lumpsum balances
        Plot.lineY(
          pathData.filter((d) => d.track !== "Capital contributed"),
          {
            x: "year",
            y: "value",
            stroke: "track",
            strokeWidth: 1.75,
          },
        ),
      ],
    }),
    [pathData, c],
  );

  function exportHeatmap() {
    downloadCsv(
      `india-sip-heatmap-${denom}.csv`,
      heatmap.map((h) => ({
        start_year: h.start,
        end_year: h.end,
        sip_multiple: Number(h.sipMultiple.toFixed(3)),
        lumpsum_multiple: Number(h.lumpsumMultiple.toFixed(3)),
        sip_advantage_pct: Number(h.sipAdvantagePct.toFixed(2)),
        sip_irr_pct: h.sipIrrPct != null ? Number(h.sipIrrPct.toFixed(2)) : "",
      })),
    );
  }

  return (
    <div className="space-y-6">
      <div className="surface flex flex-wrap items-end justify-between gap-5 p-4">
        <div>
          <FieldLabel>Denomination</FieldLabel>
          <Segmented
            ariaLabel="Index denomination"
            value={denom}
            options={denomOptions}
            onChange={(id) => setParam("denom", id)}
          />
        </div>
        <div className="min-w-[260px] flex-1 max-w-md">
          <div className="flex items-baseline justify-between">
            <FieldLabel>Scenario window</FieldLabel>
            <span className="num text-[13px]" style={{ color: "var(--ink)" }}>
              {start} → {end}
            </span>
          </div>
          <div className="mt-2 space-y-1.5">
            <input
              type="range"
              aria-label="SIP start year"
              className="w-full"
              min={MIN_YEAR}
              max={MAX_YEAR - 1}
              value={start}
              onChange={(e) => {
                const v = Math.min(Number(e.target.value), end - 1);
                setParams({ sipStart: String(v) });
              }}
            />
            <input
              type="range"
              aria-label="SIP end year"
              className="w-full"
              min={MIN_YEAR + 1}
              max={MAX_YEAR}
              value={end}
              onChange={(e) => {
                const v = Math.max(Number(e.target.value), start + 1);
                setParams({ sipEnd: String(v) });
              }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={exportHeatmap}
          className="segmented px-3 py-2 text-[12px]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
        >
          Export heatmap CSV
        </button>
      </div>

      {/* Detail readouts for the currently selected scenario */}
      <div className="surface grid grid-cols-2 gap-6 p-5 sm:grid-cols-4">
        <Readout
          label="SIP IRR"
          value={detail?.sipIrrPct ?? null}
          decimals={1}
          unit="%"
          tone={detail && detail.sipIrrPct != null && detail.sipIrrPct >= 0 ? "pos" : "neg"}
          caption={`${start}–${end}`}
        />
        <Readout
          label="Lumpsum CAGR"
          value={detail?.lumpsumCagrPct ?? null}
          decimals={1}
          unit="%"
          tone={detail && detail.lumpsumCagrPct != null && detail.lumpsumCagrPct >= 0 ? "pos" : "neg"}
          caption="alternative"
        />
        <Readout
          label="SIP advantage"
          value={detail?.sipAdvantagePct ?? null}
          decimals={1}
          unit="%"
          tone={detail && detail.sipAdvantagePct >= 0 ? "pos" : "neg"}
          caption={detail && detail.sipAdvantagePct >= 0 ? "SIP won" : "Lumpsum won"}
        />
        <Readout
          label="Final wealth"
          value={detail?.sipFinalValue ?? null}
          decimals={2}
          unit="× capital"
          tone="signal"
          caption={detail ? `₹${formatNumber(detail.sipFinalValue, 2)} per ₹${formatNumber(detail.totalContributed, 0)} invested` : undefined}
        />
      </div>

      {/* Path comparison */}
      <figure className="surface p-5">
        <figcaption className="mb-3 flex items-baseline justify-between">
          <h3 className="display text-lg">SIP vs lumpsum balance over time</h3>
          <span className="eyebrow">₹1 invested at start of each year</span>
        </figcaption>
        <PlotFigure
          options={pathOptions}
          ariaLabel={`SIP versus lumpsum balance from ${start} to ${end} in ${denom} terms`}
        />
      </figure>

      {/* Heatmap */}
      <figure className="surface p-5">
        <figcaption className="mb-3 flex items-baseline justify-between">
          <h3 className="display text-lg">SIP advantage by start × end year</h3>
          <span className="eyebrow">green = SIP wins · pink = lumpsum wins · circle = current</span>
        </figcaption>
        <PlotFigure
          options={heatmapOptions}
          ariaLabel={`Heatmap of SIP advantage versus lumpsum across all start and end year combinations in ${denom} terms`}
        />
        <p className="mt-3 text-[12px]" style={{ color: "var(--ink-faint)" }}>
          Each cell is one start–end pair. SIP advantage % = (SIP final value − lumpsum final value) ÷ lumpsum final value × 100,
          for equal total capital. Hover any cell to see exact multiples and IRR. The circled cell tracks the scenario above —
          drag the sliders to move it.
        </p>
      </figure>
    </div>
  );
}
