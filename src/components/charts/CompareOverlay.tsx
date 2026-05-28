import { formatPercent } from "@/lib/format";
import {
  rangeFilters,
  summarizeSeries,
  type RangeFilter,
} from "@/charts/marketChartUtils";

type CompareOverlayProps = {
  compareRangeKey: string;
  setCompareRangeKey: (key: string) => void;
  selectedRangeKey: string;
  selectedRange: RangeFilter;
  summary: ReturnType<typeof summarizeSeries>;
  compareSummary: ReturnType<typeof summarizeSeries>;
};

export default function CompareOverlay({
  compareRangeKey,
  setCompareRangeKey,
  selectedRangeKey,
  selectedRange,
  summary,
  compareSummary,
}: CompareOverlayProps) {
  const compareRange =
    rangeFilters.find((f) => f.key === compareRangeKey) ??
    rangeFilters[2] ??
    rangeFilters[0];

  return (
    <div className="mt-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
            Compare ranges
          </p>
          <h4 className="mt-1 text-lg font-semibold text-white">
            Use the same lens across different eras
          </h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {rangeFilters.map((filter) => (
            <button
              key={`compare-${filter.key}`}
              type="button"
              disabled={filter.key === selectedRangeKey}
              onClick={() => setCompareRangeKey(filter.key)}
              className={
                filter.key === compareRangeKey
                  ? "rounded-full border border-amber-400/35 bg-amber-400/12 px-3 py-1.5 text-xs font-medium text-amber-200"
                  : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              }
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Primary
          </p>
          <h5 className="mt-2 text-xl font-semibold text-white">
            {selectedRange.label}
          </h5>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-white/8 bg-white/5 p-3">
              <p className="text-slate-400">CAGR</p>
              <p className="mt-1 font-semibold text-white">
                {formatPercent(summary.cagr, 1)}
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/5 p-3">
              <p className="text-slate-400">Total move</p>
              <p className="mt-1 font-semibold text-white">
                {formatPercent(summary.totalMove, 0)}
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/5 p-3">
              <p className="text-slate-400">Max drawdown</p>
              <p className="mt-1 font-semibold text-white">
                {formatPercent(summary.maxDrawdown, 1)}
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/5 p-3">
              <p className="text-slate-400">Span</p>
              <p className="mt-1 font-semibold text-white">
                {summary.years}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Comparison
          </p>
          <h5 className="mt-2 text-xl font-semibold text-white">
            {compareRange.label}
          </h5>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-white/8 bg-white/5 p-3">
              <p className="text-slate-400">CAGR</p>
              <p className="mt-1 font-semibold text-white">
                {formatPercent(compareSummary.cagr, 1)}
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/5 p-3">
              <p className="text-slate-400">Total move</p>
              <p className="mt-1 font-semibold text-white">
                {formatPercent(compareSummary.totalMove, 0)}
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/5 p-3">
              <p className="text-slate-400">Max drawdown</p>
              <p className="mt-1 font-semibold text-white">
                {formatPercent(compareSummary.maxDrawdown, 1)}
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/5 p-3">
              <p className="text-slate-400">Span</p>
              <p className="mt-1 font-semibold text-white">
                {compareSummary.years}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
