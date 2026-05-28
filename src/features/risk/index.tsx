import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import echarts from "@/lib/echarts";
import { getIndicator } from "@/data/macroIndicators";
import { continuousIndex, years } from "@/data/indiaMarketData";
import { SectionHeading } from "@/components/ui/SectionHeading";

// Build Sensex map
function buildSensexMap(): Map<number, number> {
  const map = new Map<number, number>();
  years.forEach((y: number, i: number) => {
    const val = continuousIndex[i]?.value;
    if (val != null) map.set(y, val);
  });
  return map;
}

// Rolling CAGR matrix: entry[startYear][holdingPeriod] = CAGR%
function computeRollingReturns(sensexMap: Map<number, number>) {
  const periods = [1, 3, 5, 10, 15, 20];
  const results: { year: number; period: number; cagr: number }[] = [];

  for (const year of years) {
    for (const p of periods) {
      const start = sensexMap.get(year);
      const end = sensexMap.get(year + p);
      if (start && end && start > 0) {
        const cagr = (Math.pow(end / start, 1 / p) - 1) * 100;
        results.push({ year, period: p, cagr });
      }
    }
  }
  return { results, periods };
}

// Drawdown analysis
interface Drawdown {
  peakYear: number;
  troughYear: number;
  recoveryYear: number | null;
  drawdownPct: number;
  durationToTrough: number;
  durationToRecovery: number | null;
}

function computeDrawdowns(sensexMap: Map<number, number>): Drawdown[] {
  const sortedYears = [...sensexMap.keys()].sort((a, b) => a - b);
  const drawdowns: Drawdown[] = [];
  let peak = 0;
  let peakYear = sortedYears[0];
  let inDrawdown = false;
  let troughVal = Infinity;
  let troughYear = peakYear;

  for (const year of sortedYears) {
    const val = sensexMap.get(year)!;
    if (val >= peak) {
      if (inDrawdown && (peak - troughVal) / peak > 0.15) {
        // Record significant drawdown (>15%)
        drawdowns.push({
          peakYear,
          troughYear,
          recoveryYear: year,
          drawdownPct: ((peak - troughVal) / peak) * 100,
          durationToTrough: troughYear - peakYear,
          durationToRecovery: year - peakYear,
        });
      }
      peak = val;
      peakYear = year;
      inDrawdown = false;
      troughVal = val;
      troughYear = year;
    } else {
      inDrawdown = true;
      if (val < troughVal) {
        troughVal = val;
        troughYear = year;
      }
    }
  }

  // If still in drawdown at end
  if (inDrawdown && (peak - troughVal) / peak > 0.15) {
    drawdowns.push({
      peakYear,
      troughYear,
      recoveryYear: null,
      drawdownPct: ((peak - troughVal) / peak) * 100,
      durationToTrough: troughYear - peakYear,
      durationToRecovery: null,
    });
  }

  return drawdowns.sort((a, b) => b.drawdownPct - a.drawdownPct);
}

// Risk metrics
function computeRiskMetrics(sensexMap: Map<number, number>) {
  const usdMap = new Map(getIndicator("usd-inr")!.data.map((d) => [d.year, d.value]));
  const goldMap = new Map(getIndicator("gold-price")!.data.map((d) => [d.year, d.value]));
  const rateMap = new Map(getIndicator("policy-rate")!.data.map((d) => [d.year, d.value]));

  // Annual returns
  const nomReturns: number[] = [];
  const usdReturns: number[] = [];
  const goldReturns: number[] = [];
  const riskFreeRates: number[] = [];

  for (let i = 1; i < years.length; i++) {
    const prev = sensexMap.get(years[i - 1]);
    const curr = sensexMap.get(years[i]);
    if (!prev || !curr || prev <= 0) continue;

    const nomRet = (curr - prev) / prev;
    nomReturns.push(nomRet * 100);

    const usdPrev = usdMap.get(years[i - 1]);
    const usdCurr = usdMap.get(years[i]);
    if (usdPrev && usdCurr && usdPrev > 0 && usdCurr > 0) {
      usdReturns.push(((curr / usdCurr) / (prev / usdPrev) - 1) * 100);
    }

    const goldPrev = goldMap.get(years[i - 1]);
    const goldCurr = goldMap.get(years[i]);
    if (goldPrev && goldCurr && goldPrev > 0 && goldCurr > 0) {
      goldReturns.push(((curr / goldCurr) / (prev / goldPrev) - 1) * 100);
    }

    const rf = rateMap.get(years[i]);
    if (rf != null) riskFreeRates.push(rf);
  }

  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = (arr: number[]) => {
    const m = mean(arr);
    return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1));
  };
  const downside = (arr: number[], threshold: number) => {
    const below = arr.filter((r) => r < threshold).map((r) => (r - threshold) ** 2);
    return below.length > 0 ? Math.sqrt(below.reduce((a, b) => a + b, 0) / arr.length) : 0;
  };

  const avgRf = riskFreeRates.length > 0 ? mean(riskFreeRates) : 6;

  return {
    nominal: {
      mean: mean(nomReturns),
      std: std(nomReturns),
      sharpe: (mean(nomReturns) - avgRf) / std(nomReturns),
      sortino: (mean(nomReturns) - avgRf) / downside(nomReturns, avgRf),
      maxDD: Math.min(...nomReturns),
      positiveYears: nomReturns.filter((r) => r > 0).length,
      totalYears: nomReturns.length,
    },
    usd: {
      mean: mean(usdReturns),
      std: std(usdReturns),
      sharpe: usdReturns.length > 0 ? (mean(usdReturns) - 2) / std(usdReturns) : 0, // US risk-free ~2%
      sortino: usdReturns.length > 0 ? (mean(usdReturns) - 2) / downside(usdReturns, 2) : 0,
    },
    gold: {
      mean: mean(goldReturns),
      std: std(goldReturns),
      sharpe: goldReturns.length > 0 ? mean(goldReturns) / std(goldReturns) : 0, // gold has no yield
    },
  };
}

export default function RiskSection() {
  const [view, setView] = useState<"rolling" | "drawdown" | "risk">("rolling");
  const sensexMap = useMemo(buildSensexMap, []);
  const { results: rollingData, periods } = useMemo(() => computeRollingReturns(sensexMap), [sensexMap]);
  const drawdowns = useMemo(() => computeDrawdowns(sensexMap), [sensexMap]);
  const risk = useMemo(() => computeRiskMetrics(sensexMap), [sensexMap]);

  const [selectedPeriod, setSelectedPeriod] = useState(10);

  const rollingChartOption = useMemo((): EChartsOption => {
    const filtered = rollingData.filter((d) => d.period === selectedPeriod);
    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "rgba(148, 163, 184, 0.2)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        valueFormatter: (v) => `${Number(v).toFixed(1)}%`,
      },
      grid: { left: 60, right: 30, top: 30, bottom: 60 },
      xAxis: {
        type: "value",
        min: 1947,
        max: 2025 - selectedPeriod,
        axisLabel: { color: "#94a3b8", formatter: "{value}" },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#94a3b8", formatter: "{value}%" },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
      },
      visualMap: {
        show: false,
        min: -20,
        max: 30,
        inRange: { color: ["#ef4444", "#f59e0b", "#10b981", "#06b6d4"] },
      },
      dataZoom: [{ type: "inside" }, { type: "slider", bottom: 10, height: 20, textStyle: { color: "#94a3b8" } }],
      series: [{
        type: "bar",
        data: filtered.map((d) => [d.year, d.cagr]),
        barWidth: "80%",
      }],
    };
  }, [rollingData, selectedPeriod]);

  const drawdownChartOption = useMemo((): EChartsOption => {
    // Compute running drawdown from peak
    const sortedYears = [...sensexMap.keys()].sort((a, b) => a - b);
    let peak = 0;
    const ddSeries: [number, number][] = [];
    for (const year of sortedYears) {
      const val = sensexMap.get(year)!;
      if (val > peak) peak = val;
      ddSeries.push([year, -((peak - val) / peak) * 100]);
    }

    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "rgba(148, 163, 184, 0.2)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        valueFormatter: (v) => `${Number(v).toFixed(1)}%`,
      },
      grid: { left: 60, right: 30, top: 20, bottom: 60 },
      xAxis: {
        type: "value",
        min: 1947,
        max: 2025,
        axisLabel: { color: "#94a3b8", formatter: "{value}" },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
      },
      yAxis: {
        type: "value",
        max: 0,
        axisLabel: { color: "#94a3b8", formatter: "{value}%" },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
      },
      dataZoom: [{ type: "inside" }, { type: "slider", bottom: 10, height: 20, textStyle: { color: "#94a3b8" } }],
      series: [{
        type: "line",
        data: ddSeries,
        areaStyle: { color: "rgba(239, 68, 68, 0.2)" },
        lineStyle: { color: "#ef4444", width: 1.5 },
        symbol: "none",
      }],
    };
  }, [sensexMap]);

  return (
    <section id="risk" className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="risk-heading">
      <SectionHeading
        eyebrow="Risk & Returns"
        title="Rolling returns, drawdowns, and risk-adjusted metrics"
        subtitle="Beyond CAGR — understanding the volatility, pain, and risk-adjusted quality of Indian equity returns across different holding periods."
      />

      {/* View toggle */}
      <div className="my-6 flex flex-wrap gap-2">
        {(["rolling", "drawdown", "risk"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium capitalize transition ${
              view === v ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {v === "rolling" ? "Rolling Returns" : v === "drawdown" ? "Drawdowns" : "Risk Metrics"}
          </button>
        ))}
      </div>

      {view === "rolling" && (
        <>
          <div className="mb-3 flex gap-2">
            {periods.map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  selectedPeriod === p ? "bg-cyan-700 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {p}Y
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4" data-testid="rolling-chart">
            <ReactECharts echarts={echarts} option={rollingChartOption} style={{ height: 380 }} notMerge />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {periods.map((p) => {
              const pData = rollingData.filter((d) => d.period === p);
              const avg = pData.length > 0 ? pData.reduce((a, b) => a + b.cagr, 0) / pData.length : 0;
              const min = pData.length > 0 ? Math.min(...pData.map((d) => d.cagr)) : 0;
              const max = pData.length > 0 ? Math.max(...pData.map((d) => d.cagr)) : 0;
              const negative = pData.filter((d) => d.cagr < 0).length;
              return (
                <div key={p} className="rounded-lg border border-white/5 bg-slate-900/40 p-2 text-center">
                  <div className="text-[10px] text-slate-500">{p}-Year</div>
                  <div className="text-sm font-bold text-cyan-400">{avg.toFixed(1)}%</div>
                  <div className="text-[9px] text-slate-600">
                    {min.toFixed(0)}% to {max.toFixed(0)}% | {negative}/{pData.length} negative
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[10px] text-slate-600">
            Rolling {selectedPeriod}-year CAGR starting from each year. Color: red = negative, green = above 10%.
            No {selectedPeriod}-year period has ever lost money if held from before 1990.
          </p>
        </>
      )}

      {view === "drawdown" && (
        <>
          <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4" data-testid="drawdown-chart">
            <ReactECharts echarts={echarts} option={drawdownChartOption} style={{ height: 350 }} notMerge />
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/5 bg-slate-900/40">
            <table className="w-full text-xs text-slate-300">
              <thead>
                <tr className="border-b border-white/5 text-left text-slate-500">
                  <th className="px-3 py-2">Peak</th>
                  <th className="px-3 py-2">Trough</th>
                  <th className="px-3 py-2 text-right">Decline</th>
                  <th className="px-3 py-2 text-right">Years to trough</th>
                  <th className="px-3 py-2 text-right">Recovery</th>
                </tr>
              </thead>
              <tbody>
                {drawdowns.slice(0, 8).map((d, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="px-3 py-1.5">{d.peakYear}</td>
                    <td className="px-3 py-1.5">{d.troughYear}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-red-400">-{d.drawdownPct.toFixed(1)}%</td>
                    <td className="px-3 py-1.5 text-right">{d.durationToTrough}y</td>
                    <td className="px-3 py-1.5 text-right">
                      {d.durationToRecovery != null ? `${d.durationToRecovery}y` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[10px] text-slate-600">
            Drawdown = decline from previous all-time high. Only drawdowns &gt;15% shown.
            Recovery = years from peak to new all-time high. Annual data resolution (intra-year drawdowns may be deeper).
          </p>
        </>
      )}

      {view === "risk" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-900/40">
            <table className="w-full text-xs text-slate-300">
              <thead>
                <tr className="border-b border-white/5 text-left text-slate-500">
                  <th className="px-3 py-2">Metric</th>
                  <th className="px-3 py-2 text-right">Nominal (INR)</th>
                  <th className="px-3 py-2 text-right">In USD</th>
                  <th className="px-3 py-2 text-right">In Gold</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="px-3 py-1.5">Mean annual return</td>
                  <td className="px-3 py-1.5 text-right font-mono text-cyan-400">{risk.nominal.mean.toFixed(1)}%</td>
                  <td className="px-3 py-1.5 text-right font-mono text-emerald-400">{risk.usd.mean.toFixed(1)}%</td>
                  <td className="px-3 py-1.5 text-right font-mono text-amber-400">{risk.gold.mean.toFixed(1)}%</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-3 py-1.5">Volatility (σ)</td>
                  <td className="px-3 py-1.5 text-right font-mono">{risk.nominal.std.toFixed(1)}%</td>
                  <td className="px-3 py-1.5 text-right font-mono">{risk.usd.std.toFixed(1)}%</td>
                  <td className="px-3 py-1.5 text-right font-mono">{risk.gold.std.toFixed(1)}%</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-3 py-1.5">Sharpe ratio</td>
                  <td className="px-3 py-1.5 text-right font-mono text-cyan-400">{risk.nominal.sharpe.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-emerald-400">{risk.usd.sharpe.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-amber-400">{risk.gold.sharpe.toFixed(2)}</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-3 py-1.5">Sortino ratio</td>
                  <td className="px-3 py-1.5 text-right font-mono text-cyan-400">{risk.nominal.sortino.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-emerald-400">{risk.usd.sortino.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">—</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-3 py-1.5">Worst single year</td>
                  <td className="px-3 py-1.5 text-right font-mono text-red-400">{risk.nominal.maxDD.toFixed(1)}%</td>
                  <td className="px-3 py-1.5 text-right font-mono">—</td>
                  <td className="px-3 py-1.5 text-right font-mono">—</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="px-3 py-1.5">Positive years</td>
                  <td className="px-3 py-1.5 text-right font-mono">{risk.nominal.positiveYears}/{risk.nominal.totalYears} ({((risk.nominal.positiveYears / risk.nominal.totalYears) * 100).toFixed(0)}%)</td>
                  <td className="px-3 py-1.5 text-right font-mono">—</td>
                  <td className="px-3 py-1.5 text-right font-mono">—</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[10px] text-slate-600">
            Sharpe = (mean return − risk-free) / σ. Risk-free: RBI policy rate for INR, 2% for USD, 0% for gold.
            Sortino uses downside deviation only (penalizes losses, not upside volatility).
            Based on {risk.nominal.totalYears} years of annual data (1948–2025).
          </p>
        </div>
      )}
    </section>
  );
}
