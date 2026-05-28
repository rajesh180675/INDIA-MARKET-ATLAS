import { useState } from "react";
import { GradientPanel } from "@/components/ui/GradientPanel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ProgressMetric } from "@/components/ui/ProgressMetric";
import MotionReveal from "@/components/MotionReveal";
import { scenario2050 } from "@/data/indiaMarketData";
import { formatNumber } from "@/lib/format";
import { cn } from "@/utils/cn";

const scenarioToneClasses = {
  amber: "border-amber-400/20 bg-amber-400/10 text-amber-100",
  sky: "border-sky-400/20 bg-sky-400/10 text-sky-100",
  emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
  violet: "border-violet-400/20 bg-violet-400/10 text-violet-100",
} as const;

export default function ProjectorSection() {
  const [projectionCagr, setProjectionCagr] = useState(10.1);
  const [projectionInflation, setProjectionInflation] = useState(5);

  const projectionYears = 25;
  const projectedSensex2050 = Math.round(
    80000 * Math.pow(1 + projectionCagr / 100, projectionYears),
  );
  const realCagr =
    ((1 + projectionCagr / 100) / (1 + projectionInflation / 100) - 1) * 100;
  const realMultiple = Math.pow(1 + realCagr / 100, projectionYears);
  const projectedRealValue = Math.round(80000 * realMultiple);

  return (
    <section
      id="projector"
      className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-14"
    >
      <MotionReveal>
        <SectionHeading
          eyebrow="2050 projector"
          title="Preset scenarios plus a custom return-and-inflation simulator"
          subtitle="The long-term framing is now interactive: click a preset path or build your own projection using nominal CAGR and inflation assumptions."
        />
      </MotionReveal>

      <div className="mt-10 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <MotionReveal>
          <GradientPanel>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Scenario table
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  Preset 2050 paths
                </h3>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                Click to load
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {scenario2050.map((scenario) => (
                <button
                  key={scenario.name}
                  type="button"
                  onClick={() => {
                    setProjectionCagr(scenario.cagr);
                    setProjectionInflation(scenario.inflation);
                  }}
                  className={cn(
                    "w-full rounded-2xl border p-5 text-left transition hover:bg-white/10",
                    scenarioToneClasses[scenario.tone],
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] opacity-80">
                        {scenario.probability}
                      </p>
                      <h4 className="mt-1 text-lg font-semibold text-white">
                        {scenario.name}
                      </h4>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white">
                      {scenario.cagr}% CAGR
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                      2050: {formatNumber(scenario.projectedSensex2050)}
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                      Inflation: {scenario.inflation}%
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                      Real multiple: {scenario.realMultiple.toFixed(2)}x
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-100/90">
                    {scenario.note}
                  </p>
                </button>
              ))}
            </div>
          </GradientPanel>
        </MotionReveal>

        <MotionReveal delay={0.08}>
          <GradientPanel>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Custom simulator
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  Build your own 2050 view
                </h3>
              </div>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                25-year horizon
              </span>
            </div>

            <div className="mt-6 grid gap-6">
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
                <div className="flex items-center justify-between gap-4">
                  <label
                    htmlFor="cagr"
                    className="text-sm font-medium text-white"
                  >
                    Nominal CAGR assumption
                  </label>
                  <span className="text-sm font-semibold text-slate-200">
                    {projectionCagr.toFixed(1)}%
                  </span>
                </div>
                <input
                  id="cagr"
                  type="range"
                  min={6}
                  max={15}
                  step={0.1}
                  value={projectionCagr}
                  onChange={(event) =>
                    setProjectionCagr(Number(event.target.value))
                  }
                  className="mt-4 w-full"
                />
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
                <div className="flex items-center justify-between gap-4">
                  <label
                    htmlFor="inflation"
                    className="text-sm font-medium text-white"
                  >
                    Inflation assumption
                  </label>
                  <span className="text-sm font-semibold text-slate-200">
                    {projectionInflation.toFixed(1)}%
                  </span>
                </div>
                <input
                  id="inflation"
                  type="range"
                  min={3}
                  max={7}
                  step={0.1}
                  value={projectionInflation}
                  onChange={(event) =>
                    setProjectionInflation(Number(event.target.value))
                  }
                  className="mt-4 w-full"
                />
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-slate-400">
                  Projected 2050 Sensex
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {formatNumber(projectedSensex2050)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-slate-400">
                  Real CAGR after inflation
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {realCagr.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm text-slate-400">
                  Real 2025-rupee value
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {formatNumber(projectedRealValue)}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <ProgressMetric
                label="Nominal multiple"
                value={`${(projectedSensex2050 / 80000).toFixed(2)}x`}
                max={(projectedSensex2050 / 1500000) * 100}
                tone="emerald"
                description="How many times the current 80,000 level your scenario implies by 2050."
              />
              <ProgressMetric
                label="Real multiple"
                value={`${realMultiple.toFixed(2)}x`}
                max={(realMultiple / 6) * 100}
                tone="amber"
                description="How much purchasing power remains after your inflation assumption is applied."
              />
            </div>
          </GradientPanel>
        </MotionReveal>
      </div>
    </section>
  );
}
