import { GradientPanel } from "@/components/ui/GradientPanel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ProgressMetric } from "@/components/ui/ProgressMetric";
import MotionReveal from "@/components/MotionReveal";
import InteractiveMarketChart from "@/components/InteractiveMarketChart";
import {
  continuousIndex,
  crashEvents,
  marketRegimes,
  milestones,
  yearAnnotations,
} from "@/data/indiaMarketData";
import { downloadCsv } from "@/lib/csv";

// Filter out OHLC-only points (value undefined) that would crash ECharts
const chartData = continuousIndex.filter(
  (point): point is typeof point & { value: number } =>
    point.value !== undefined && point.value !== null,
);

function handleDownloadIndexCsv() {
  downloadCsv(
    "india-stock-market-index-1947-2025.csv",
    chartData.map((point) => ({
      year: point.year,
      normalized_index_1947_base_100: point.value,
    })),
  );
}

export default function MarketChartSection() {
  return (
    <section
      id="chart"
      className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-14"
    >
      <MotionReveal>
        <SectionHeading
          eyebrow="Interactive chart"
          title="A professional candlestick chart first, with expand-to-window viewing and a structural context mode"
          subtitle="The primary chart now opens as a technical desk: candlesticks, clearer moving averages, native pan and zoom, and a larger footprint so the tape is easier to read. The long-horizon context view is still available when you need the truthful annual structure behind the reconstruction."
        />
      </MotionReveal>

      <div className="mt-10 space-y-6">
        <MotionReveal>
          <GradientPanel>
            <InteractiveMarketChart
              data={chartData}
              milestones={milestones}
              crashEvents={crashEvents}
              regimes={marketRegimes}
              annotations={yearAnnotations}
            />
          </GradientPanel>
        </MotionReveal>

        <div className="grid gap-6 xl:grid-cols-3">
          <MotionReveal delay={0.05}>
            <GradientPanel innerClassName="h-full">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                Chart reading guide
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white">
                What changed in the desk
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                The chart now opens where most users actually want to work:
                in candlesticks, with a larger plotting surface, direct
                expand-to-window viewing, and visible moving average
                overlays that hold up when you switch ranges.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleDownloadIndexCsv}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  Download index CSV
                </button>
                <a
                  href="#data"
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                >
                  Jump to reference table
                </a>
              </div>
            </GradientPanel>
          </MotionReveal>

          <MotionReveal delay={0.1}>
            <GradientPanel innerClassName="h-full">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                Technical quality
              </p>
              <div className="mt-4 space-y-4">
                <ProgressMetric
                  label="Candlestick readability"
                  value="Primary"
                  max={96}
                  tone="sky"
                  description="The main chart starts in a trading-desk view instead of asking users to switch modes first."
                />
                <ProgressMetric
                  label="Range-aware indicators"
                  value="Fixed"
                  max={93}
                  tone="emerald"
                  description="Moving averages are computed on the full history first, then displayed inside the selected era so they do not break in shorter windows."
                />
                <ProgressMetric
                  label="Expand mode"
                  value="Prominent"
                  max={90}
                  tone="amber"
                  description="The chart can now be expanded into a larger window without sacrificing the current zoom state."
                />
              </div>
            </GradientPanel>
          </MotionReveal>

          <MotionReveal delay={0.15}>
            <GradientPanel innerClassName="h-full">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                Data integrity
              </p>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                The candlestick desk is still clearly framed as a
                reconstruction from annual source data. When you need the
                plain structural record, the long-horizon context mode is
                still built into the same panel with the same pan and zoom
                behavior.
              </p>
            </GradientPanel>
          </MotionReveal>
        </div>
      </div>
    </section>
  );
}
