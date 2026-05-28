import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import ReactECharts from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import echarts from "@/lib/echarts";
import { sensexOHLC, getAnnualReturn, getVolatility, type OHLCDataPoint } from "@/data/sensexOHLC";
import { getIndicator } from "@/data/macroIndicators";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * Professional Candlestick Desk
 * - Annual OHLC candlestick chart (1979-2025)
 * - Expand-to-window (fullscreen modal)
 * - Structural context overlay (GDP growth, policy rate, regime bands)
 * - Volume proxy (intra-year volatility as bar height)
 */

type ContextMode = "none" | "gdp" | "policy" | "inflation" | "gold";

const CONTEXT_OPTIONS: { value: ContextMode; label: string }[] = [
  { value: "none", label: "Price only" },
  { value: "gdp", label: "+ GDP Growth" },
  { value: "policy", label: "+ Policy Rate" },
  { value: "inflation", label: "+ CPI Inflation" },
  { value: "gold", label: "+ Gold Price" },
];

function buildCandlestickOption(
  data: OHLCDataPoint[],
  contextMode: ContextMode,
  isFullscreen: boolean
): EChartsOption {
  const gdpMap = new Map(getIndicator("real-gdp-growth")?.data.map((d) => [d.year, d.value]) ?? []);
  const policyMap = new Map(getIndicator("policy-rate")?.data.map((d) => [d.year, d.value]) ?? []);
  const cpiMap = new Map(getIndicator("cpi-inflation")?.data.map((d) => [d.year, d.value]) ?? []);
  const goldMap = new Map(getIndicator("gold-price")?.data.map((d) => [d.year, d.value]) ?? []);

  const years = data.map((d) => String(d.year));
  // ECharts candlestick: [open, close, low, high]
  const ohlcData = data.map((d) => [d.open, d.close, d.low, d.high]);
  // Volatility bars (intra-year range)
  const volData = data.map((d) => getVolatility(d));

  const series: EChartsOption["series"] = [
    {
      name: "Sensex",
      type: "candlestick",
      data: ohlcData,
      itemStyle: {
        color: "#10b981",        // bullish (close > open)
        color0: "#ef4444",       // bearish (close < open)
        borderColor: "#10b981",
        borderColor0: "#ef4444",
      },
      barWidth: isFullscreen ? "70%" : "60%",
    },
    {
      name: "Volatility",
      type: "bar",
      data: volData,
      yAxisIndex: 1,
      itemStyle: {
        color: (params: { dataIndex: number }) => {
          const d = data[params.dataIndex];
          return d.close >= d.open ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)";
        },
      },
      barWidth: "50%",
      silent: true,
    },
  ];

  // Context overlay
  if (contextMode !== "none") {
    const contextMap = contextMode === "gdp" ? gdpMap
      : contextMode === "policy" ? policyMap
      : contextMode === "inflation" ? cpiMap
      : goldMap;

    const contextName = contextMode === "gdp" ? "GDP Growth %"
      : contextMode === "policy" ? "Policy Rate %"
      : contextMode === "inflation" ? "CPI %"
      : "Gold (₹K/10g)";

    const contextData = data.map((d) => {
      const val = contextMap.get(d.year);
      if (val == null) return null;
      return contextMode === "gold" ? val / 1000 : val; // Gold in thousands for readability
    });

    series.push({
      name: contextName,
      type: "line",
      data: contextData,
      yAxisIndex: 2,
      smooth: true,
      symbol: "none",
      lineStyle: {
        width: 2,
        color: contextMode === "gdp" ? "#06b6d4"
          : contextMode === "policy" ? "#f59e0b"
          : contextMode === "inflation" ? "#f97316"
          : "#eab308",
        type: "dashed",
      },
      itemStyle: {
        color: contextMode === "gdp" ? "#06b6d4"
          : contextMode === "policy" ? "#f59e0b"
          : contextMode === "inflation" ? "#f97316"
          : "#eab308",
      },
    });
  }

  const yAxes: EChartsOption["yAxis"] = [
    {
      type: "log",
      position: "right",
      axisLabel: { color: "#94a3b8", formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v) },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.08)" } },
      name: "Sensex",
      nameTextStyle: { color: "#94a3b8", fontSize: 10 },
    },
    {
      type: "value",
      position: "left",
      max: 120,
      show: false,
      axisLabel: { show: false },
      splitLine: { show: false },
    },
    ...(contextMode !== "none" ? [{
      type: "value" as const,
      position: "left" as const,
      axisLabel: {
        color: "#64748b",
        fontSize: 10,
        formatter: (v: number) => contextMode === "gold" ? `₹${v.toFixed(0)}K` : `${v.toFixed(0)}%`,
      },
      splitLine: { show: false },
      name: CONTEXT_OPTIONS.find((o) => o.value === contextMode)?.label.slice(2),
      nameTextStyle: { color: "#64748b", fontSize: 9 },
    }] : []),
  ];

  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      borderColor: "rgba(148, 163, 184, 0.2)",
      textStyle: { color: "#e2e8f0", fontSize: 11 },
    },
    legend: {
      top: 0,
      textStyle: { color: "#94a3b8", fontSize: 11 },
    },
    grid: {
      left: contextMode !== "none" ? 70 : 30,
      right: 70,
      top: isFullscreen ? 50 : 40,
      bottom: isFullscreen ? 80 : 60,
    },
    xAxis: {
      type: "category",
      data: years,
      axisLabel: { color: "#94a3b8", rotate: isFullscreen ? 0 : 45, fontSize: isFullscreen ? 11 : 10 },
      axisLine: { lineStyle: { color: "rgba(148, 163, 184, 0.2)" } },
    },
    yAxis: yAxes,
    dataZoom: [
      { type: "inside", xAxisIndex: 0 },
      { type: "slider", bottom: isFullscreen ? 30 : 10, height: 20, textStyle: { color: "#94a3b8" } },
    ],
    series,
  };
}

export default function CandlestickDesk() {
  const [contextMode, setContextMode] = useState<ContextMode>("none");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Escape key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  // Lock body scroll in fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isFullscreen]);

  const chartOption = useMemo(
    () => buildCandlestickOption(sensexOHLC, contextMode, isFullscreen),
    [contextMode, isFullscreen]
  );

  // Stats cards
  const stats = useMemo(() => {
    const returns = sensexOHLC.map(getAnnualReturn);
    const vols = sensexOHLC.map(getVolatility);
    const bullish = returns.filter((r) => r > 0).length;
    const avgVol = vols.reduce((a, b) => a + b, 0) / vols.length;
    const maxDrawdown = Math.min(...sensexOHLC.map((d) => ((d.low - d.open) / d.open) * 100));
    const bestYear = sensexOHLC.reduce((best, d) => getAnnualReturn(d) > getAnnualReturn(best) ? d : best);
    const worstYear = sensexOHLC.reduce((worst, d) => getAnnualReturn(d) < getAnnualReturn(worst) ? d : worst);

    return { bullish, total: sensexOHLC.length, avgVol, maxDrawdown, bestYear, worstYear };
  }, []);

  const toggleFullscreen = useCallback(() => setIsFullscreen((f) => !f), []);

  const chartContent = (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap gap-1.5">
          {CONTEXT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setContextMode(opt.value)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                contextMode === opt.value
                  ? "bg-cyan-700 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={toggleFullscreen}
          className="rounded-md bg-slate-800 px-3 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 transition"
          aria-label={isFullscreen ? "Exit fullscreen" : "Expand to window"}
        >
          {isFullscreen ? "✕ Close" : "⛶ Expand"}
        </button>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-2" data-testid="candlestick-chart">
        <ReactECharts
          echarts={echarts}
          option={chartOption}
          style={{ height: isFullscreen ? "calc(100vh - 180px)" : 420 }}
          notMerge
        />
      </div>

      {/* Stats row */}
      <div className={`mt-3 grid gap-2 ${isFullscreen ? "grid-cols-6" : "grid-cols-3 sm:grid-cols-6"}`}>
        <div className="rounded-lg border border-white/5 bg-slate-900/40 p-2 text-center">
          <div className="text-[10px] text-slate-500">Bullish Years</div>
          <div className="text-sm font-bold text-emerald-400">{stats.bullish}/{stats.total}</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-slate-900/40 p-2 text-center">
          <div className="text-[10px] text-slate-500">Win Rate</div>
          <div className="text-sm font-bold text-cyan-400">{((stats.bullish / stats.total) * 100).toFixed(0)}%</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-slate-900/40 p-2 text-center">
          <div className="text-[10px] text-slate-500">Avg Volatility</div>
          <div className="text-sm font-bold text-amber-400">{stats.avgVol.toFixed(0)}%</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-slate-900/40 p-2 text-center">
          <div className="text-[10px] text-slate-500">Max Intra-Year Drop</div>
          <div className="text-sm font-bold text-red-400">{stats.maxDrawdown.toFixed(0)}%</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-slate-900/40 p-2 text-center">
          <div className="text-[10px] text-slate-500">Best Year</div>
          <div className="text-sm font-bold text-emerald-400">{stats.bestYear.year} (+{getAnnualReturn(stats.bestYear).toFixed(0)}%)</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-slate-900/40 p-2 text-center">
          <div className="text-[10px] text-slate-500">Worst Year</div>
          <div className="text-sm font-bold text-red-400">{stats.worstYear.year} ({getAnnualReturn(stats.worstYear).toFixed(0)}%)</div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <section
        id="candlestick"
        ref={containerRef}
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6"
        aria-labelledby="candlestick-heading"
      >
        <SectionHeading
          eyebrow="Candlestick Desk"
          title="46 years of annual OHLC — the full picture"
          subtitle="Each candle shows one year: open, high, low, close. Green = bullish (close > open). Red = bearish. Overlay macro context to see what drove each year. Expand to window for full-screen analysis."
        />
        {!isFullscreen && chartContent}
      </section>

      {/* Fullscreen modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-950 p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Candlestick chart fullscreen view"
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-200">
              BSE Sensex Annual OHLC (1979–2025)
            </h2>
            <button
              onClick={toggleFullscreen}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
            >
              ✕ Close (Esc)
            </button>
          </div>
          {chartContent}
          <p className="mt-2 text-[10px] text-slate-600">
            Log scale. Drag to zoom. Scroll to pan. Each candle = 1 calendar year.
            Volatility bars show intra-year range (high−low) as % of open.
          </p>
        </div>
      )}
    </>
  );
}
