import { useMemo } from "react";
import { GradientPanel } from "@/components/ui/GradientPanel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ProgressMetric } from "@/components/ui/ProgressMetric";
import MotionReveal from "@/components/MotionReveal";
import { crashEvents, decadeReturns, rollingWindows } from "@/data/indiaMarketData";

export default function CrashesSection() {
  const maxCrash = Math.max(
    ...crashEvents.map((event) => Math.abs(event.decline)),
    1,
  );

  const medianRecovery = useMemo(() => {
    const recoveries = crashEvents
      .map((crash) => crash.monthsToRecover)
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);

    const middle = Math.floor(recoveries.length / 2);
    if (recoveries.length % 2 === 0) {
      return (recoveries[middle - 1] + recoveries[middle]) / 2;
    }
    return recoveries[middle];
  }, []);

  return (
    <section
      id="crashes"
      className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-14"
    >
      <MotionReveal>
        <SectionHeading
          eyebrow="Crashes & windows"
          title="The market kept breaking — and patience kept winning"
          subtitle="This section still reinforces the core behavioral finding: drawdowns were frequent, scary, and often violent, yet long windows kept neutralizing terrible entry points."
        />
      </MotionReveal>

      <div className="mt-10 grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <MotionReveal>
          <GradientPanel>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  Major drawdown map
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  The severity of the fall mattered less than the discipline
                  to stay invested.
                </p>
              </div>
              <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm text-rose-200">
                Median recovery: {medianRecovery} months
              </span>
            </div>

            <div className="space-y-5">
              {crashEvents.map((crash) => (
                <div
                  key={`${crash.name}-${crash.period}`}
                  className="rounded-3xl border border-white/10 bg-slate-950/55 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-400">
                        {crash.period}
                      </p>
                      <h4 className="text-lg font-semibold text-white">
                        {crash.name}
                      </h4>
                    </div>
                    <div className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-sm font-medium text-rose-200">
                      {crash.decline}%
                    </div>
                  </div>

                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-900/80 ring-1 ring-white/5">
                    <div
                      className="progress-fill h-full rounded-full bg-gradient-to-r from-rose-500 via-orange-400 to-amber-300"
                      style={{
                        width: `${(Math.abs(crash.decline) / maxCrash) * 100}%`,
                      }}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      {crash.monthsToBottom} months to bottom
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      {crash.monthsToRecover === null
                        ? "Recovery ongoing"
                        : `${crash.monthsToRecover} months to recover`}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-400">
                    {crash.note}
                  </p>
                </div>
              ))}
            </div>
          </GradientPanel>
        </MotionReveal>

        <div className="space-y-6">
          <MotionReveal delay={0.05}>
            <GradientPanel className="bg-[linear-gradient(135deg,rgba(16,185,129,0.22),rgba(255,255,255,0.08),rgba(56,189,248,0.12))]">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">
                Patience premium
              </p>
              <h3 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                No 15-year window in the supplied Sensex dataset fell below
                9% CAGR.
              </h3>
              <p className="mt-4 text-base leading-7 text-emerald-50">
                The strongest edge in Indian equities was never perfect
                timing. It was remaining invested through the exact moments
                that felt least survivable.
              </p>
            </GradientPanel>
          </MotionReveal>

          <MotionReveal delay={0.1}>
            <GradientPanel>
              <h3 className="text-xl font-semibold text-white">
                15-year rolling windows
              </h3>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {rollingWindows.map((window) => (
                  <div
                    key={window.period}
                    className="rounded-2xl border border-white/10 bg-slate-950/55 p-5"
                  >
                    <p className="text-sm text-slate-400">{window.period}</p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      {window.cagr.toFixed(1)}%
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {window.verdict}
                    </p>
                  </div>
                ))}
              </div>
            </GradientPanel>
          </MotionReveal>

          <MotionReveal delay={0.14}>
            <GradientPanel>
              <h3 className="text-xl font-semibold text-white">
                Decade return bars
              </h3>
              <div className="mt-5 space-y-5">
                {decadeReturns.map((period) => (
                  <div
                    key={period.period}
                    className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">
                        {period.period}
                      </p>
                      <span className="text-xs text-slate-400">
                        Nominal vs real CAGR
                      </span>
                    </div>
                    <ProgressMetric
                      label="Nominal"
                      value={`${period.nominal > 0 ? "+" : ""}${period.nominal.toFixed(1)}%`}
                      max={Math.max(
                        Math.abs(period.nominal) * 4.2,
                        period.nominal === 0 ? 8 : 18,
                      )}
                      tone={
                        period.nominal >= 10
                          ? "emerald"
                          : period.nominal >= 0
                            ? "amber"
                            : "rose"
                      }
                      description="Headline annualized return"
                    />
                    <div className="mt-4" />
                    <ProgressMetric
                      label="Real"
                      value={`${period.real > 0 ? "+" : ""}${period.real.toFixed(1)}%`}
                      max={Math.max(
                        Math.abs(period.real) * 5.4,
                        period.real === 0 ? 8 : 18,
                      )}
                      tone={
                        period.real >= 5
                          ? "emerald"
                          : period.real >= 0
                            ? "amber"
                            : "rose"
                      }
                      description="Inflation-adjusted annualized return"
                    />
                  </div>
                ))}
              </div>
            </GradientPanel>
          </MotionReveal>
        </div>
      </div>
    </section>
  );
}
