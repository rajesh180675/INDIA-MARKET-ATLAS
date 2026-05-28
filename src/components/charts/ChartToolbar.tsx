import {
  rangeFilters,
  type ChartMode,
  type TechnicalPane,
  type TimeframeKey,
} from "@/charts/marketChartUtils";

type ChartToolbarProps = {
  mode: ChartMode;
  setMode: (mode: ChartMode) => void;
  compareMode: boolean;
  setCompareMode: (fn: (current: boolean) => boolean) => void;
  selectedRangeKey: string;
  setSelectedRangeKey: (key: string) => void;
  timeframe: TimeframeKey;
  setTimeframe: (tf: TimeframeKey) => void;
  technicalPane: TechnicalPane;
  setTechnicalPane: (pane: TechnicalPane) => void;
  showMA20: boolean;
  setShowMA20: (fn: (current: boolean) => boolean) => void;
  showMA50: boolean;
  setShowMA50: (fn: (current: boolean) => boolean) => void;
  showMA200: boolean;
  setShowMA200: (fn: (current: boolean) => boolean) => void;
  showVolume: boolean;
  setShowVolume: (fn: (current: boolean) => boolean) => void;
  showMilestones: boolean;
  setShowMilestones: (fn: (current: boolean) => boolean) => void;
  showCrashes: boolean;
  setShowCrashes: (fn: (current: boolean) => boolean) => void;
  isFullscreen: boolean;
  setIsFullscreen: (fn: (current: boolean) => boolean) => void;
  onExportPng: () => void;
  onFitAll: () => void;
  onLast20Y: () => void;
  onLast10Y: () => void;
};

function pill(active: boolean, tone: "fuchsia" | "emerald" | "amber" | "sky") {
  const tones = {
    fuchsia: "border-fuchsia-400/35 bg-fuchsia-400/12 text-fuchsia-200",
    emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-400/35 bg-amber-400/12 text-amber-200",
    sky: "border-sky-400/30 bg-sky-400/12 text-sky-200",
  };
  return active
    ? `rounded-full border ${tones[tone]} px-3 py-1.5 text-sm font-medium`
    : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/10";
}

function pillXs(active: boolean, tone: "fuchsia" | "emerald" | "amber" | "sky") {
  const tones = {
    fuchsia: "border-fuchsia-400/35 bg-fuchsia-400/12 text-fuchsia-200",
    emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-400/35 bg-amber-400/12 text-amber-200",
    sky: "border-sky-400/30 bg-sky-400/12 text-sky-200",
  };
  return active
    ? `rounded-full border ${tones[tone]} px-3 py-1.5 text-xs font-medium`
    : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10";
}

export default function ChartToolbar({
  mode,
  setMode,
  compareMode,
  setCompareMode,
  selectedRangeKey,
  setSelectedRangeKey,
  timeframe,
  setTimeframe,
  technicalPane,
  setTechnicalPane,
  showMA20,
  setShowMA20,
  showMA50,
  setShowMA50,
  showMA200,
  setShowMA200,
  showVolume,
  setShowVolume,
  showMilestones,
  setShowMilestones,
  showCrashes,
  setShowCrashes,
  isFullscreen,
  setIsFullscreen,
  onExportPng,
  onFitAll,
  onLast20Y,
  onLast10Y,
}: ChartToolbarProps) {
  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">
            Market explorer
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-white">
            Professional candlestick desk with expand-to-window review and
            full-history context
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsFullscreen((current) => !current)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
          >
            {isFullscreen ? "Collapse window" : "Expand to window"}
          </button>
          <button
            type="button"
            onClick={onExportPng}
            className="rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-400/15"
          >
            Export PNG
          </button>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("technical")}
          className={pill(mode === "technical", "fuchsia")}
        >
          Candlestick Desk
        </button>
        <button
          type="button"
          onClick={() => setMode("long")}
          className={pill(mode === "long", "emerald")}
        >
          Long Horizon Context
        </button>
        <button
          type="button"
          onClick={() => setCompareMode((current) => !current)}
          className={pill(compareMode, "amber")}
        >
          {compareMode ? "Compare on" : "Compare off"}
        </button>
      </div>

      {/* Range filters */}
      <div className="flex flex-wrap gap-2">
        {rangeFilters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setSelectedRangeKey(filter.key)}
            className={pillXs(filter.key === selectedRangeKey, "sky")}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Quick zoom */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
          Quick view
        </span>
        <button
          type="button"
          onClick={onFitAll}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
        >
          Fit all
        </button>
        <button
          type="button"
          onClick={onLast20Y}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
        >
          Last 20Y
        </button>
        <button
          type="button"
          onClick={onLast10Y}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
        >
          Last 10Y
        </button>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
          Wheel to zoom, drag to pan, pinch on touch
        </span>
      </div>

      {/* Technical controls */}
      {mode === "technical" ? (
        <div className="space-y-3 rounded-[24px] border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap gap-2">
            {(["month", "quarter", "year"] as TimeframeKey[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTimeframe(option)}
                className={pillXs(timeframe === option, "fuchsia")}
              >
                {option === "month"
                  ? "Monthly"
                  : option === "quarter"
                    ? "Quarterly"
                    : "Yearly"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTechnicalPane("none")}
              className={pillXs(technicalPane === "none", "amber")}
            >
              Price action only
            </button>
            <button
              type="button"
              onClick={() => setTechnicalPane("rsi")}
              className={pillXs(technicalPane === "rsi", "amber")}
            >
              RSI pane
            </button>
            <button
              type="button"
              onClick={() => setTechnicalPane("macd")}
              className={pillXs(technicalPane === "macd", "amber")}
            >
              MACD pane
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "MA 20", active: showMA20, toggle: () => setShowMA20((c) => !c) },
              { label: "MA 50", active: showMA50, toggle: () => setShowMA50((c) => !c) },
              { label: "MA 200", active: showMA200, toggle: () => setShowMA200((c) => !c) },
              { label: "Volume", active: showVolume, toggle: () => setShowVolume((c) => !c) },
              { label: "Milestones", active: showMilestones, toggle: () => setShowMilestones((c) => !c) },
              { label: "Crashes", active: showCrashes, toggle: () => setShowCrashes((c) => !c) },
            ].map((overlay) => (
              <button
                key={overlay.label}
                type="button"
                onClick={overlay.toggle}
                className={pillXs(overlay.active, "emerald")}
              >
                {overlay.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
