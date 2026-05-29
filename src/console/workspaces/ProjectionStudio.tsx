import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import { scenario2050 } from "@/data/indiaMarketData";
import { sensexClose, sensexMonthly } from "@/domain/atlas";
import {
  monteCarloProjection,
  monthlyLogReturnArray,
  mulberry32,
} from "@/domain/monthly";
import { downloadCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/format";
import PlotFigure from "../PlotFigure";
import Provenance from "../Provenance";
import { atlasColors } from "../theme-colors";
import { FieldLabel, Readout, Segmented } from "../controls";
import { readInt, useAtlasState } from "../url-state";

const LAUNCH_YEAR = 2025;
const HORIZON = 2050;
const HORIZON_MONTHS = (HORIZON - LAUNCH_YEAR) * 12; // 300

// Slider domains (basis points so URL state stays integer + precise)
const CAGR_MIN = 30; // 3.0%
const CAGR_MAX = 160; // 16.0%
const INFL_MIN = 20;
const INFL_MAX = 100;

// Monte Carlo simulation parameters. Fixed seed = stable, shareable URLs.
const MC_PATHS = 1000;
const MC_SEED = 42;

const methodOptions = [
  { id: "det", label: "Deterministic" },
  { id: "mc", label: "Monte Carlo" },
] as const;
type Method = (typeof methodOptions)[number]["id"];

export default function ProjectionStudio({ theme }: { theme: string }) {
  // theme triggers re-render so colors refresh
  void theme;
  const { state, setParam, setParams } = useAtlasState();
  const launch = sensexClose.at(LAUNCH_YEAR) ?? 81721;

  const method = (state.params.get("m") ?? "det") as Method;

  // Stored as tenths-of-percent so 101 => 10.1%
  const cagrTenths = readInt(state.params, "g", 101);
  const inflTenths = readInt(state.params, "pi", 50);
  const cagr = cagrTenths / 10;
  const infl = inflTenths / 10;

  const c = useMemo(() => atlasColors(), []);

  // ─── Deterministic path (always computed; used in det mode + as overlay) ──
  const detPath = useMemo(() => {
    const rows: { year: number; nominal: number; real: number }[] = [];
    for (let y = LAUNCH_YEAR; y <= HORIZON; y++) {
      const n = y - LAUNCH_YEAR;
      const nominal = launch * Math.pow(1 + cagr / 100, n);
      const real = nominal / Math.pow(1 + infl / 100, n);
      rows.push({ year: y, nominal, real });
    }
    return rows;
  }, [launch, cagr, infl]);

  const detEnd = detPath[detPath.length - 1];

  // ─── Monte Carlo simulation (bootstrap historical monthly returns) ────────
  const mcResult = useMemo(() => {
    const historical = monthlyLogReturnArray(sensexMonthly);
    return monteCarloProjection(
      historical,
      launch,
      HORIZON_MONTHS,
      MC_PATHS,
      mulberry32(MC_SEED),
    );
  }, [launch]);

  // Year-end snapshots from the MC bands (every 12th month, plus month 0)
  const mcAnnual = useMemo(() => {
    if (mcResult.bands.length === 0) return [];
    return mcResult.bands
      .filter((b) => b.month % 12 === 0)
      .map((b, i) => {
        const year = LAUNCH_YEAR + i;
        const inflFactor = Math.pow(1 + infl / 100, i);
        return {
          year,
          p5: b.p5,
          p25: b.p25,
          p50: b.p50,
          p75: b.p75,
          p95: b.p95,
          // Real (deflated) versions of bands
          p5_real: b.p5 / inflFactor,
          p25_real: b.p25 / inflFactor,
          p50_real: b.p50 / inflFactor,
          p75_real: b.p75 / inflFactor,
          p95_real: b.p95 / inflFactor,
        };
      });
  }, [mcResult, infl]);

  const mcEnd = mcAnnual[mcAnnual.length - 1];
  const mcImpliedCagr = mcEnd
    ? (Math.pow(mcEnd.p50 / launch, 1 / (HORIZON - LAUNCH_YEAR)) - 1) * 100
    : 0;

  // ─── Plot options ────────────────────────────────────────────────────────
  const detFigure = useMemo<Plot.PlotOptions>(() => {
    const long = [
      ...detPath.map((p) => ({ year: p.year, value: p.nominal, kind: "Nominal Sensex" })),
      ...detPath.map((p) => ({ year: p.year, value: p.real, kind: "Real (today's ₹)" })),
    ];
    return {
      height: 320,
      marginLeft: 64,
      marginRight: 16,
      marginBottom: 32,
      style: { background: "transparent", color: c.inkSoft },
      color: {
        domain: ["Nominal Sensex", "Real (today's ₹)"],
        range: [c.signal, c.cat[2]],
        legend: true,
      },
      x: { label: null, tickFormat: "d" },
      y: { label: "Sensex level", grid: true, tickFormat: "~s" },
      marks: [
        Plot.lineY(long, { x: "year", y: "value", stroke: "kind", strokeWidth: 1.75 }),
        Plot.tip(long, Plot.pointerX({ x: "year", y: "value", stroke: c.ruleStrong, fill: "var(--surface)" })),
      ],
    };
  }, [detPath, c]);

  const mcFigure = useMemo<Plot.PlotOptions>(() => {
    return {
      height: 360,
      marginLeft: 64,
      marginRight: 16,
      marginBottom: 32,
      style: { background: "transparent", color: c.inkSoft },
      x: { label: null, tickFormat: "d" },
      y: {
        label: "Sensex level (nominal)",
        grid: true,
        tickFormat: "~s",
        type: "log",
      },
      marks: [
        // Outer band p5–p95
        Plot.areaY(mcAnnual, {
          x: "year",
          y1: "p5",
          y2: "p95",
          fill: c.signal,
          fillOpacity: 0.12,
        }),
        // Inner band p25–p75
        Plot.areaY(mcAnnual, {
          x: "year",
          y1: "p25",
          y2: "p75",
          fill: c.signal,
          fillOpacity: 0.25,
        }),
        // Median line
        Plot.lineY(mcAnnual, {
          x: "year",
          y: "p50",
          stroke: c.signal,
          strokeWidth: 2,
        }),
        // User's deterministic CAGR overlay for comparison
        Plot.lineY(detPath, {
          x: "year",
          y: "nominal",
          stroke: c.ink,
          strokeWidth: 1,
          strokeDasharray: "3,3",
        }),
        Plot.tip(mcAnnual, Plot.pointerX({
          x: "year",
          y: "p50",
          stroke: c.ruleStrong,
          fill: "var(--surface)",
          title: (d: typeof mcAnnual[number]) =>
            `${d.year}\nMedian: ${formatNumber(d.p50, 0)}\n5–95%: ${formatNumber(d.p5, 0)}–${formatNumber(d.p95, 0)}`,
        })),
      ],
    };
  }, [mcAnnual, detPath, c]);

  function loadScenario(s: (typeof scenario2050)[number]) {
    setParams({
      g: String(Math.round(s.cagr * 10)),
      pi: String(Math.round(s.inflation * 10)),
    });
  }

  function exportPath() {
    if (method === "mc") {
      downloadCsv(
        `india-projection-monte-carlo-${MC_PATHS}paths.csv`,
        mcAnnual.map((p) => ({
          year: p.year,
          p5_nominal: Math.round(p.p5),
          p25_nominal: Math.round(p.p25),
          p50_nominal: Math.round(p.p50),
          p75_nominal: Math.round(p.p75),
          p95_nominal: Math.round(p.p95),
          p50_real: Math.round(p.p50_real),
        })),
      );
    } else {
      downloadCsv(
        `india-projection-${cagr}pc-cagr-${infl}pc-infl.csv`,
        detPath.map((p) => ({
          year: p.year,
          nominal_sensex: Math.round(p.nominal),
          real_sensex_today_rupees: Math.round(p.real),
        })),
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Method toggle */}
      <div className="surface flex flex-wrap items-end gap-5 p-5">
        <div>
          <div className="eyebrow mb-1.5">Method</div>
          <Segmented
            ariaLabel="Projection method"
            value={method}
            options={methodOptions.map((o) => ({ id: o.id, label: o.label }))}
            onChange={(v) => setParam("m", v === "det" ? null : v)}
          />
        </div>
        <p
          className="ml-2 max-w-md flex-1 text-[12px]"
          style={{ color: "var(--ink-faint)" }}
        >
          {method === "det" ? (
            <>
              <strong>Deterministic:</strong> single geometric path from your CAGR
              + inflation assumptions. No uncertainty modelled.
            </>
          ) : (
            <>
              <strong>Monte Carlo:</strong> {MC_PATHS} paths bootstrapped from
              {" "}{mcResult.historicalN} months of Sensex returns (1997–today).
              Bands show 5/25/75/95th percentile across paths.
            </>
          )}
        </p>
      </div>

      {/* Assumption sliders */}
      <div className="surface grid gap-6 p-5 lg:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between">
            <FieldLabel>Equity CAGR (deterministic only)</FieldLabel>
            <span
              className="num text-[15px]"
              style={{
                color: method === "det" ? "var(--signal)" : "var(--ink-faint)",
              }}
            >
              {cagr.toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            aria-label="Equity CAGR assumption"
            className="w-full"
            min={CAGR_MIN}
            max={CAGR_MAX}
            value={cagrTenths}
            disabled={method === "mc"}
            onChange={(e) => setParams({ g: e.target.value })}
          />
          {method === "mc" && (
            <p className="mt-1 text-[11px]" style={{ color: "var(--ink-faint)" }}>
              implied median CAGR from MC: {mcImpliedCagr.toFixed(1)}%
            </p>
          )}
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <FieldLabel>Inflation</FieldLabel>
            <span className="num text-[15px]" style={{ color: "var(--neg)" }}>
              {infl.toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            aria-label="Inflation assumption"
            className="w-full"
            min={INFL_MIN}
            max={INFL_MAX}
            value={inflTenths}
            onChange={(e) => setParams({ pi: e.target.value })}
          />
        </div>
      </div>

      {/* Presets — only meaningful in deterministic mode */}
      {method === "det" && (
        <div className="surface flex flex-wrap items-center gap-2 p-4">
          <span className="eyebrow mr-1">Load scenario</span>
          {scenario2050.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => loadScenario(s)}
              className="segmented px-3 py-1.5 text-[12px]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
              title={s.note}
            >
              {s.name} · {s.cagr}%
            </button>
          ))}
          <button
            type="button"
            onClick={exportPath}
            className="segmented ml-auto px-3 py-1.5 text-[12px]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
          >
            Export path CSV
          </button>
        </div>
      )}
      {method === "mc" && (
        <div className="surface flex items-center gap-2 p-4">
          <span className="eyebrow mr-1">Monte Carlo</span>
          <span className="num text-[12px]" style={{ color: "var(--ink-soft)" }}>
            {MC_PATHS} paths · {mcResult.historicalN} months bootstrap source · seed {MC_SEED}
          </span>
          <button
            type="button"
            onClick={exportPath}
            className="segmented ml-auto px-3 py-1.5 text-[12px]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
          >
            Export bands CSV
          </button>
        </div>
      )}

      {/* Live readouts */}
      {method === "det" ? (
        <div className="surface grid grid-cols-2 gap-6 p-5 sm:grid-cols-4">
          <Readout label="Launch (2025)" value={launch} decimals={0} caption="Sensex close" tone="ink" />
          <Readout label="Nominal 2050" value={detEnd.nominal} decimals={0} tone="signal" caption={`@ ${cagr.toFixed(1)}% CAGR`} />
          <Readout label="Real 2050" value={detEnd.real} decimals={0} tone="pos" caption="today's rupees" />
          <Readout label="Real multiple" value={detEnd.real / launch} decimals={2} unit="×" tone={detEnd.real / launch >= 1 ? "pos" : "neg"} caption="purchasing power" />
        </div>
      ) : (
        <div className="surface grid grid-cols-2 gap-6 p-5 sm:grid-cols-4">
          <Readout label="Launch (2025)" value={launch} decimals={0} caption="Sensex close" tone="ink" />
          <Readout label="Median 2050" value={mcEnd?.p50 ?? null} decimals={0} tone="signal" caption={`MC ${MC_PATHS}p · p50`} />
          <Readout label="P25–P75 2050" value={mcEnd ? mcEnd.p75 - mcEnd.p25 : null} decimals={0} tone="ink" caption={`${formatNumber(mcEnd?.p25 ?? 0, 0)}–${formatNumber(mcEnd?.p75 ?? 0, 0)}`} />
          <Readout label="P5–P95 2050" value={mcEnd ? mcEnd.p95 - mcEnd.p5 : null} decimals={0} tone="ink" caption={`${formatNumber(mcEnd?.p5 ?? 0, 0)}–${formatNumber(mcEnd?.p95 ?? 0, 0)}`} />
        </div>
      )}

      <figure className="surface p-5">
        <figcaption className="mb-3 flex items-baseline justify-between">
          <h3 className="display text-lg">
            {method === "det" ? "Path to 2050" : "Distribution of paths to 2050"}
          </h3>
          <span className="eyebrow">
            {method === "det"
              ? "25-year horizon · single path"
              : `25-year horizon · ${MC_PATHS} paths`}
          </span>
        </figcaption>
        <PlotFigure
          options={method === "det" ? detFigure : mcFigure}
          ariaLabel={
            method === "det"
              ? `Projected Sensex to 2050 at ${cagr}% CAGR and ${infl}% inflation`
              : `Monte Carlo projection: ${MC_PATHS} bootstrapped paths to 2050 with 5/25/75/95 percentile bands`
          }
        />
        {method === "det" ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--ink-soft)" }}>
            At {cagr.toFixed(1)}% nominal CAGR the Sensex reaches{" "}
            <span className="num" style={{ color: "var(--signal)" }}>
              {formatNumber(detEnd.nominal, 0)}
            </span>{" "}
            by 2050 — but after {infl.toFixed(1)}% inflation that is worth{" "}
            <span className="num" style={{ color: "var(--pos)" }}>
              {formatNumber(detEnd.real, 0)}
            </span>{" "}
            in today's rupees ({(detEnd.real / launch).toFixed(2)}× real). Adjust
            the assumptions; the URL captures the scenario for sharing.
          </p>
        ) : (
          <p className="mt-3 text-[13px]" style={{ color: "var(--ink-soft)" }}>
            Bootstrapping {mcResult.historicalN} months of historical Sensex
            returns produces a 2050 median of{" "}
            <span className="num" style={{ color: "var(--signal)" }}>
              {formatNumber(mcEnd?.p50 ?? 0, 0)}
            </span>
            , with a P5–P95 range of{" "}
            <span className="num">{formatNumber(mcEnd?.p5 ?? 0, 0)}</span>–
            <span className="num">{formatNumber(mcEnd?.p95 ?? 0, 0)}</span>. The
            dashed line is your deterministic {cagr.toFixed(1)}% assumption for
            comparison. Honest read: the wide range is the uncertainty — the
            single-number projection hides it.
          </p>
        )}
        <div className="rule-t mt-4 pt-3">
          <Provenance id={method === "mc" ? "projections-mc" : "projections"} />
        </div>
      </figure>
    </div>
  );
}
