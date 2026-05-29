import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import { scenario2050 } from "@/data/indiaMarketData";
import { sensexClose } from "@/domain/atlas";
import { downloadCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/format";
import PlotFigure from "../PlotFigure";
import Provenance from "../Provenance";
import { atlasColors } from "../theme-colors";
import { FieldLabel, Readout } from "../controls";
import { readInt, useAtlasState } from "../url-state";

const LAUNCH_YEAR = 2025;
const HORIZON = 2050;

// Slider domains (basis points so URL state stays integer + precise)
const CAGR_MIN = 30; // 3.0%
const CAGR_MAX = 160; // 16.0%
const INFL_MIN = 20;
const INFL_MAX = 100;

export default function ProjectionStudio({ theme }: { theme: string }) {
  const { state, setParams } = useAtlasState();
  const launch = sensexClose.at(LAUNCH_YEAR) ?? 81721;

  // Stored as tenths-of-percent so 101 => 10.1%
  const cagrTenths = readInt(state.params, "g", 101);
  const inflTenths = readInt(state.params, "pi", 50);
  const cagr = cagrTenths / 10;
  const infl = inflTenths / 10;

  const c = useMemo(() => atlasColors(), [theme]);

  const path = useMemo(() => {
    const rows: { year: number; nominal: number; real: number }[] = [];
    for (let y = LAUNCH_YEAR; y <= HORIZON; y++) {
      const n = y - LAUNCH_YEAR;
      const nominal = launch * Math.pow(1 + cagr / 100, n);
      const real = nominal / Math.pow(1 + infl / 100, n);
      rows.push({ year: y, nominal, real });
    }
    return rows;
  }, [launch, cagr, infl]);

  const end = path[path.length - 1];
  const realMultiple = end.real / launch;

  const figureOptions = useMemo<Plot.PlotOptions>(() => {
    const long = [
      ...path.map((p) => ({ year: p.year, value: p.nominal, kind: "Nominal Sensex" })),
      ...path.map((p) => ({ year: p.year, value: p.real, kind: "Real (today's ₹)" })),
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
  }, [path, c]);

  function loadScenario(s: (typeof scenario2050)[number]) {
    setParams({ g: String(Math.round(s.cagr * 10)), pi: String(Math.round(s.inflation * 10)) });
  }

  function exportPath() {
    downloadCsv(
      `india-projection-${cagr}pc-cagr-${infl}pc-infl.csv`,
      path.map((p) => ({
        year: p.year,
        nominal_sensex: Math.round(p.nominal),
        real_sensex_today_rupees: Math.round(p.real),
      })),
    );
  }

  return (
    <div className="space-y-6">
      {/* Assumption sliders */}
      <div className="surface grid gap-6 p-5 lg:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between">
            <FieldLabel>Equity CAGR</FieldLabel>
            <span className="num text-[15px]" style={{ color: "var(--signal)" }}>
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
            onChange={(e) => setParams({ g: e.target.value })}
          />
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

      {/* Presets */}
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

      {/* Live readouts */}
      <div className="surface grid grid-cols-2 gap-6 p-5 sm:grid-cols-4">
        <Readout label="Launch (2025)" value={launch} decimals={0} caption="Sensex close" tone="ink" />
        <Readout label="Nominal 2050" value={end.nominal} decimals={0} tone="signal" caption={`@ ${cagr.toFixed(1)}% CAGR`} />
        <Readout label="Real 2050" value={end.real} decimals={0} tone="pos" caption="today's rupees" />
        <Readout label="Real multiple" value={realMultiple} decimals={2} unit="×" tone={realMultiple >= 1 ? "pos" : "neg"} caption="purchasing power" />
      </div>

      <figure className="surface p-5">
        <figcaption className="mb-3 flex items-baseline justify-between">
          <h3 className="display text-lg">Path to 2050</h3>
          <span className="eyebrow">25-year horizon · live</span>
        </figcaption>
        <PlotFigure options={figureOptions} ariaLabel={`Projected Sensex to 2050 at ${cagr}% CAGR and ${infl}% inflation`} />
        <p className="mt-3 text-[13px]" style={{ color: "var(--ink-soft)" }}>
          At {cagr.toFixed(1)}% nominal CAGR the Sensex reaches{" "}
          <span className="num" style={{ color: "var(--signal)" }}>
            {formatNumber(end.nominal, 0)}
          </span>{" "}
          by 2050 — but after {infl.toFixed(1)}% inflation that is worth{" "}
          <span className="num" style={{ color: "var(--pos)" }}>
            {formatNumber(end.real, 0)}
          </span>{" "}
          in today's rupees ({realMultiple.toFixed(2)}× real). Adjust the assumptions; the URL captures the scenario for sharing.
        </p>
        <div className="rule-t mt-4 pt-3"><Provenance id="projections" /></div>
      </figure>
    </div>
  );
}
