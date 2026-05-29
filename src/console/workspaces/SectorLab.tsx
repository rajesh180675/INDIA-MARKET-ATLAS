import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import {
  SECTOR_IDS,
  SECTOR_INDICES,
  SECTOR_META,
} from "@/domain/atlas";
import {
  addMonths,
  fromMonthKey,
  monthKey,
  monthsBetween,
  monthlyCagr,
  periodReturnPct,
  rebaseTo100,
  relativeStrength,
  type MonthKey,
} from "@/domain/monthly";
import { downloadCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/format";
import PlotFigure from "../PlotFigure";
import Provenance from "../Provenance";
import { atlasColors } from "../theme-colors";
import { Readout, Segmented } from "../controls";
import { useAtlasState } from "../url-state";

// Composite + sectors — composite is always SECTOR_IDS[0] ("nifty")
const COMPOSITE_ID = "nifty";
const SECTOR_ONLY_IDS = SECTOR_IDS.filter((id) => id !== COMPOSITE_ID);

// View modes
const viewOptions = [
  { id: "rebased", label: "Rebased" },
  { id: "rs", label: "Relative strength" },
  { id: "table", label: "Period returns" },
] as const;
type View = (typeof viewOptions)[number]["id"];

// Window presets — based on data availability (composite & sectors start 2010-12)
const windowOptions = [
  { id: "all", label: "Since 2011" },
  { id: "10y", label: "10Y" },
  { id: "5y", label: "5Y" },
  { id: "post-covid", label: "Post-COVID" },
] as const;
type WindowOpt = (typeof windowOptions)[number]["id"];

function resolveWindow(opt: WindowOpt): { from: MonthKey; to: MonthKey } {
  // Use the latest month present in the composite series as anchor
  const composite = SECTOR_INDICES.get(COMPOSITE_ID)!;
  const last = composite.points[composite.points.length - 1].key;
  const all_first = monthKey(2010, 12);
  switch (opt) {
    case "10y":
      return { from: addMonths(last, -120 + 1), to: last };
    case "5y":
      return { from: addMonths(last, -60 + 1), to: last };
    case "post-covid":
      return { from: monthKey(2020, 3), to: last };
    default:
      return { from: all_first, to: last };
  }
}

function fmtMonth(k: MonthKey): string {
  const { year, month } = fromMonthKey(k);
  const m = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month];
  return `${m} ${year}`;
}

function keyToDate(k: MonthKey): Date {
  const { year, month } = fromMonthKey(k);
  return new Date(Date.UTC(year, month - 1, 1));
}

export default function SectorLab({ theme }: { theme: string }) {
  void theme;
  const { state, setParam } = useAtlasState();
  const c = useMemo(() => atlasColors(), []);

  const view = (state.params.get("sv") ?? "rebased") as View;
  const windowChoice = (state.params.get("sw") ?? "post-covid") as WindowOpt;
  const window = useMemo(() => resolveWindow(windowChoice), [windowChoice]);

  // ─── Data prep ───────────────────────────────────────────────────────────

  // Per-sector window-restricted series
  const seriesByWindow = useMemo(() => {
    const m = new Map<string, ReturnType<typeof SECTOR_INDICES.get>>();
    for (const id of SECTOR_IDS) {
      const s = SECTOR_INDICES.get(id);
      if (s) m.set(id, s.window(window.from, window.to));
    }
    return m;
  }, [window.from, window.to]);

  // Per-sector rebased series (rebased view)
  const rebasedData = useMemo(() => {
    const out: Array<{ date: Date; value: number; series: string }> = [];
    for (const id of SECTOR_IDS) {
      const s = seriesByWindow.get(id);
      if (!s) continue;
      const rebased = rebaseTo100(s, window.from);
      if (!rebased) continue;
      const label = SECTOR_META.get(id)?.label ?? id;
      for (const p of rebased.points) {
        out.push({ date: keyToDate(p.key), value: p.value, series: label });
      }
    }
    return out;
  }, [seriesByWindow, window.from]);

  // Per-sector relative strength vs composite (RS view)
  const rsData = useMemo(() => {
    const out: Array<{ date: Date; value: number; series: string }> = [];
    const composite = SECTOR_INDICES.get(COMPOSITE_ID);
    if (!composite) return out;
    for (const id of SECTOR_ONLY_IDS) {
      const sector = SECTOR_INDICES.get(id);
      if (!sector) continue;
      const rs = relativeStrength(sector, composite, window.from);
      if (!rs) continue;
      // restrict to active window
      const restricted = rs.window(window.from, window.to);
      const label = SECTOR_META.get(id)?.label ?? id;
      for (const p of restricted.points) {
        out.push({ date: keyToDate(p.key), value: p.value, series: label });
      }
    }
    return out;
  }, [window.from, window.to]);

  // Per-sector period returns (table view + readouts)
  const periodReturns = useMemo(() => {
    return SECTOR_IDS.map((id) => {
      const s = SECTOR_INDICES.get(id);
      if (!s) return null;
      const ret = periodReturnPct(s, window.from, window.to);
      const cagr = monthlyCagr(s, window.from, window.to);
      const meta = SECTOR_META.get(id);
      return {
        id,
        label: meta?.label ?? id,
        symbol: meta?.symbol ?? "",
        ret: ret ?? 0,
        cagr: cagr ?? 0,
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [window.from, window.to]);

  // Best/worst for headline
  const sectorReturns = periodReturns.filter((p) => p.id !== COMPOSITE_ID);
  const sortedByReturn = [...sectorReturns].sort((a, b) => b.ret - a.ret);
  const best = sortedByReturn[0];
  const worst = sortedByReturn[sortedByReturn.length - 1];
  const composite = periodReturns.find((p) => p.id === COMPOSITE_ID);
  const months = monthsBetween(window.from, window.to);

  // Color domain — stable per-sector colors across views
  const seriesLabels = SECTOR_IDS.map(
    (id) => SECTOR_META.get(id)?.label ?? id,
  );
  // Composite is signal; sectors use cat colors
  const colorRange = [c.signal, c.cat[0], c.cat[1], c.cat[2], c.cat[3], c.cat[4]];

  // ─── Plot options ────────────────────────────────────────────────────────

  const rebasedFigure = useMemo<Plot.PlotOptions>(() => {
    return {
      width: 880,
      height: 360,
      marginLeft: 56,
      marginRight: 16,
      marginBottom: 32,
      style: { background: "transparent", color: c.inkSoft, fontSize: "12px" },
      color: {
        domain: seriesLabels,
        range: colorRange,
        legend: true,
      },
      x: { type: "time", label: null, grid: false },
      y: {
        label: `↑ Rebased (100 at ${fmtMonth(window.from)})`,
        grid: true,
        type: "log",
        tickFormat: "~s",
      },
      marks: [
        Plot.ruleY([100], { stroke: c.rule, strokeDasharray: "3,3" }),
        Plot.lineY(rebasedData, {
          x: "date",
          y: "value",
          stroke: "series",
          strokeWidth: 1.5,
        }),
        Plot.tip(
          rebasedData,
          Plot.pointerX({
            x: "date",
            y: "value",
            stroke: c.ruleStrong,
            fill: "var(--surface)",
          }),
        ),
      ],
    };
  }, [rebasedData, window.from, c, seriesLabels, colorRange]);

  const rsFigure = useMemo<Plot.PlotOptions>(() => {
    return {
      width: 880,
      height: 360,
      marginLeft: 56,
      marginRight: 16,
      marginBottom: 32,
      style: { background: "transparent", color: c.inkSoft, fontSize: "12px" },
      color: {
        domain: seriesLabels.filter((l) => l !== "Nifty 50"),
        range: colorRange.slice(1),
        legend: true,
      },
      x: { type: "time", label: null, grid: false },
      y: {
        label: "↑ Relative strength vs Nifty 50 (100 at anchor)",
        grid: true,
        tickFormat: (d: number) => `${d.toFixed(0)}`,
      },
      marks: [
        Plot.ruleY([100], { stroke: c.rule, strokeDasharray: "3,3" }),
        Plot.lineY(rsData, {
          x: "date",
          y: "value",
          stroke: "series",
          strokeWidth: 1.5,
        }),
        Plot.tip(
          rsData,
          Plot.pointerX({
            x: "date",
            y: "value",
            stroke: c.ruleStrong,
            fill: "var(--surface)",
          }),
        ),
      ],
    };
  }, [rsData, c, seriesLabels, colorRange]);

  // CSV export — adapts per view
  const handleExport = () => {
    if (view === "rs") {
      downloadCsv(
        `nifty-relative-strength-${windowChoice}.csv`,
        rsData.map((p) => ({
          date: p.date.toISOString().slice(0, 7),
          series: p.series,
          rs_vs_nifty: p.value.toFixed(2),
        })),
      );
    } else if (view === "table") {
      downloadCsv(
        `nifty-period-returns-${windowChoice}.csv`,
        periodReturns.map((p) => ({
          sector: p.label,
          symbol: p.symbol,
          period_return_pct: p.ret.toFixed(2),
          period_cagr_pct: p.cagr.toFixed(2),
        })),
      );
    } else {
      downloadCsv(
        `nifty-sectors-rebased-${windowChoice}.csv`,
        rebasedData.map((p) => ({
          date: p.date.toISOString().slice(0, 7),
          series: p.series,
          rebased_value: p.value.toFixed(2),
        })),
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="surface flex flex-wrap items-end gap-5 p-5">
        <div>
          <div className="eyebrow mb-1.5">View</div>
          <Segmented
            ariaLabel="Sector view"
            value={view}
            options={viewOptions.map((o) => ({ id: o.id, label: o.label }))}
            onChange={(v) => setParam("sv", v === "rebased" ? null : v)}
          />
        </div>
        <div>
          <div className="eyebrow mb-1.5">Window</div>
          <Segmented
            ariaLabel="Time window"
            value={windowChoice}
            options={windowOptions.map((o) => ({ id: o.id, label: o.label }))}
            onChange={(v) => setParam("sw", v === "post-covid" ? null : v)}
          />
        </div>
        <div className="ml-auto">
          <button
            type="button"
            onClick={handleExport}
            className="segmented px-3 py-1.5 text-[12px]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Headline readouts */}
      <div className="surface grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Readout
          label="Best sector"
          value={best ? Number(best.ret.toFixed(1)) : null}
          unit="%"
          decimals={1}
          tone="pos"
          caption={best?.label}
        />
        <Readout
          label="Worst sector"
          value={worst ? Number(worst.ret.toFixed(1)) : null}
          unit="%"
          decimals={1}
          tone="neg"
          caption={worst?.label}
        />
        <Readout
          label="Composite (Nifty 50)"
          value={composite ? Number(composite.ret.toFixed(1)) : null}
          unit="%"
          decimals={1}
          tone="signal"
          caption={`${months}M total`}
        />
        <Readout
          label="Best–worst spread"
          value={best && worst ? Number((best.ret - worst.ret).toFixed(1)) : null}
          unit="pp"
          decimals={1}
          tone="ink"
          caption={`${fmtMonth(window.from)} → ${fmtMonth(window.to)}`}
        />
      </div>

      {/* Main figure */}
      {view === "table" ? (
        <figure className="surface p-5">
          <figcaption className="mb-4">
            <h3 className="display text-lg">Period returns</h3>
            <span className="num text-[12px]" style={{ color: "var(--ink-faint)" }}>
              {fmtMonth(window.from)} → {fmtMonth(window.to)} · {months} months
            </span>
          </figcaption>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="rule-b" style={{ color: "var(--ink-soft)" }}>
                  <th className="py-2 text-left font-medium">Sector</th>
                  <th className="py-2 text-right font-medium">Symbol</th>
                  <th className="py-2 text-right font-medium">Period return</th>
                  <th className="py-2 text-right font-medium">Annualized (CAGR)</th>
                </tr>
              </thead>
              <tbody>
                {periodReturns.map((p) => (
                  <tr key={p.id} className="rule-b">
                    <td className="py-2.5">
                      {p.id === COMPOSITE_ID ? (
                        <strong>{p.label}</strong>
                      ) : (
                        p.label
                      )}
                    </td>
                    <td
                      className="py-2.5 text-right num"
                      style={{ color: "var(--ink-faint)" }}
                    >
                      {p.symbol}
                    </td>
                    <td
                      className="py-2.5 text-right num"
                      style={{ color: p.ret >= 0 ? "var(--pos)" : "var(--neg)" }}
                    >
                      {p.ret >= 0 ? "+" : ""}
                      {formatNumber(p.ret, 1)}%
                    </td>
                    <td className="py-2.5 text-right num">
                      {p.cagr >= 0 ? "+" : ""}
                      {formatNumber(p.cagr, 1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px]" style={{ color: "var(--ink-faint)" }}>
            Sectors above the composite outperformed the broad Nifty 50;
            sectors below underperformed. CAGR annualizes the period return
            over {(months / 12).toFixed(1)} years.
          </p>
          <div className="rule-t mt-4 pt-3">
            <Provenance id="sectors" />
          </div>
        </figure>
      ) : (
        <figure className="surface p-5">
          <figcaption className="mb-3 flex items-baseline justify-between">
            <h3 className="display text-lg">
              {view === "rs"
                ? "Sector relative strength vs Nifty 50"
                : "Sectoral performance, rebased"}
            </h3>
            <span className="num text-[12px]" style={{ color: "var(--ink-faint)" }}>
              {fmtMonth(window.from)} → {fmtMonth(window.to)}
            </span>
          </figcaption>
          <PlotFigure
            options={view === "rs" ? rsFigure : rebasedFigure}
            ariaLabel={
              view === "rs"
                ? `Relative strength of Bank, IT, Pharma vs Nifty 50, ${fmtMonth(window.from)} to ${fmtMonth(window.to)}`
                : `Rebased Nifty composite + sector indices, ${fmtMonth(window.from)} to ${fmtMonth(window.to)}`
            }
          />
          <p className="mt-3 text-[13px]" style={{ color: "var(--ink-soft)" }}>
            {view === "rs" ? (
              <>
                Lines above 100 indicate the sector is outperforming the
                composite since {fmtMonth(window.from)}; below 100 means
                lagging. Sustained slopes mark genuine rotation regimes.
              </>
            ) : (
              <>
                All series rebased to 100 at {fmtMonth(window.from)} so the
                visual difference is purely relative performance. Best:{" "}
                <strong>{best?.label}</strong> (+{best?.ret.toFixed(1)}%);
                worst: <strong>{worst?.label}</strong> ({worst && worst.ret >= 0 ? "+" : ""}
                {worst?.ret.toFixed(1)}%); composite (Nifty 50):{" "}
                {composite && composite.ret >= 0 ? "+" : ""}
                {composite?.ret.toFixed(1)}%.
              </>
            )}
          </p>
          <div className="rule-t mt-4 pt-3">
            <Provenance id="sectors" />
          </div>
        </figure>
      )}
    </div>
  );
}
