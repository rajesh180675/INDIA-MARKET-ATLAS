import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import echarts from "@/lib/echarts";
import { getIndicator } from "@/data/macroIndicators";
import { continuousIndex, years } from "@/data/indiaMarketData";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * Regime Analysis: Which macro environment produced the best equity returns?
 * Segments history into regimes based on GDP growth + inflation combinations.
 */

interface RegimeYear {
  year: number;
  regime: string;
  sensexReturn: number;
  gdpGrowth: number | null;
  inflation: number | null;
  usdReturn: number;
  goldReturn: number;
}

function classifyRegime(gdp: number | null, cpi: number | null): string {
  if (gdp === null || cpi === null) return "Unknown";
  if (gdp >= 6 && cpi <= 6) return "Goldilocks";       // High growth, low inflation
  if (gdp >= 6 && cpi > 6) return "Overheating";       // High growth, high inflation
  if (gdp < 6 && gdp >= 3 && cpi <= 6) return "Moderate";  // Moderate growth, low inflation
  if (gdp < 6 && gdp >= 3 && cpi > 6) return "Stagflation-lite"; // Moderate growth, high inflation
  if (gdp < 3 && cpi > 6) return "Stagflation";        // Low growth, high inflation
  if (gdp < 3 && cpi <= 6) return "Slowdown";          // Low growth, low inflation
  return "Unknown";
}

function computeRegimeData(): RegimeYear[] {
  const gdpMap = new Map(getIndicator("real-gdp-growth")!.data.map((d) => [d.year, d.value]));
  const cpiMap = new Map(getIndicator("cpi-inflation")!.data.map((d) => [d.year, d.value]));
  const usdMap = new Map(getIndicator("usd-inr")!.data.map((d) => [d.year, d.value]));
  const goldMap = new Map(getIndicator("gold-price")!.data.map((d) => [d.year, d.value]));

  const sensexMap = new Map<number, number>();
  years.forEach((y: number, i: number) => {
    const val = continuousIndex[i]?.value;
    if (val != null) sensexMap.set(y, val);
  });

  const results: RegimeYear[] = [];

  for (let i = 1; i < years.length; i++) {
    const year = years[i];
    const prev = sensexMap.get(years[i - 1]);
    const curr = sensexMap.get(year);
    if (!prev || !curr || prev <= 0) continue;

    const sensexReturn = ((curr - prev) / prev) * 100;
    const gdp = gdpMap.get(year) ?? null;
    const cpi = cpiMap.get(year) ?? null;

    // USD return
    const usdPrev = usdMap.get(years[i - 1]);
    const usdCurr = usdMap.get(year);
    let usdReturn = sensexReturn;
    if (usdPrev && usdCurr && usdPrev > 0 && usdCurr > 0) {
      usdReturn = ((curr / usdCurr) / (prev / usdPrev) - 1) * 100;
    }

    // Gold return
    const goldPrev = goldMap.get(years[i - 1]);
    const goldCurr = goldMap.get(year);
    let goldReturn = sensexReturn;
    if (goldPrev && goldCurr && goldPrev > 0 && goldCurr > 0) {
      goldReturn = ((curr / goldCurr) / (prev / goldPrev) - 1) * 100;
    }

    results.push({
      year,
      regime: classifyRegime(gdp, cpi),
      sensexReturn,
      gdpGrowth: gdp,
      inflation: cpi,
      usdReturn,
      goldReturn,
    });
  }

  return results;
}

interface RegimeSummary {
  regime: string;
  count: number;
  avgReturn: number;
  avgUsdReturn: number;
  avgGoldReturn: number;
  medianReturn: number;
  positiveYears: number;
  color: string;
}

const REGIME_COLORS: Record<string, string> = {
  "Goldilocks": "#10b981",
  "Overheating": "#f59e0b",
  "Moderate": "#06b6d4",
  "Stagflation-lite": "#f97316",
  "Stagflation": "#ef4444",
  "Slowdown": "#8b5cf6",
  "Unknown": "#64748b",
};

function summarizeRegimes(data: RegimeYear[]): RegimeSummary[] {
  const grouped = new Map<string, RegimeYear[]>();
  for (const d of data) {
    const list = grouped.get(d.regime) || [];
    list.push(d);
    grouped.set(d.regime, list);
  }

  const summaries: RegimeSummary[] = [];
  for (const [regime, years] of grouped) {
    if (regime === "Unknown") continue;
    const returns = years.map((y) => y.sensexReturn).sort((a, b) => a - b);
    const usdReturns = years.map((y) => y.usdReturn);
    const goldReturns = years.map((y) => y.goldReturn);
    const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
    const avgUsd = usdReturns.reduce((a, b) => a + b, 0) / usdReturns.length;
    const avgGold = goldReturns.reduce((a, b) => a + b, 0) / goldReturns.length;
    const median = returns[Math.floor(returns.length / 2)];
    const positive = returns.filter((r) => r > 0).length;

    summaries.push({
      regime,
      count: years.length,
      avgReturn: avg,
      avgUsdReturn: avgUsd,
      avgGoldReturn: avgGold,
      medianReturn: median,
      positiveYears: positive,
      color: REGIME_COLORS[regime] || "#64748b",
    });
  }

  return summaries.sort((a, b) => b.avgReturn - a.avgReturn);
}

export default function RegimeSection() {
  const [showScatter, setShowScatter] = useState(true);
  const regimeData = useMemo(computeRegimeData, []);
  const summaries = useMemo(() => summarizeRegimes(regimeData), [regimeData]);

  const scatterOption = useMemo((): EChartsOption => {
    const regimeGroups = new Map<string, [number, number, number][]>();
    for (const d of regimeData) {
      if (d.gdpGrowth === null || d.inflation === null) continue;
      const list = regimeGroups.get(d.regime) || [];
      list.push([d.gdpGrowth, d.inflation, d.sensexReturn]);
      regimeGroups.set(d.regime, list);
    }

    const series = [...regimeGroups.entries()].map(([regime, points]) => ({
      name: regime,
      type: "scatter" as const,
      data: points,
      symbolSize: (val: number[]) => Math.min(30, Math.max(8, Math.abs(val[2]) / 3)),
      itemStyle: { color: REGIME_COLORS[regime] || "#64748b", opacity: 0.8 },
    }));

    return {
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        borderColor: "rgba(148, 163, 184, 0.2)",
        textStyle: { color: "#e2e8f0", fontSize: 12 },
        formatter: (params: unknown) => {
          const p = params as { value: number[]; seriesName: string };
          const [gdp, cpi, ret] = p.value;
          return `<b>${p.seriesName}</b><br/>GDP: ${gdp.toFixed(1)}% | CPI: ${cpi.toFixed(1)}%<br/>Sensex: ${ret > 0 ? "+" : ""}${ret.toFixed(1)}%`;
        },
      },
      legend: {
        top: 0,
        textStyle: { color: "#94a3b8", fontSize: 11 },
      },
      grid: { left: 60, right: 30, top: 40, bottom: 40 },
      xAxis: {
        type: "value",
        name: "Real GDP Growth (%)",
        nameLocation: "center",
        nameGap: 30,
        nameTextStyle: { color: "#94a3b8" },
        axisLabel: { color: "#94a3b8" },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
      },
      yAxis: {
        type: "value",
        name: "CPI Inflation (%)",
        nameTextStyle: { color: "#94a3b8" },
        axisLabel: { color: "#94a3b8" },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
      },
      series,
    };
  }, [regimeData]);

  const barOption = useMemo((): EChartsOption => ({
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      borderColor: "rgba(148, 163, 184, 0.2)",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      valueFormatter: (v) => `${Number(v).toFixed(1)}%`,
    },
    legend: { top: 0, textStyle: { color: "#94a3b8", fontSize: 11 } },
    grid: { left: 120, right: 30, top: 40, bottom: 30 },
    yAxis: {
      type: "category",
      data: summaries.map((s) => `${s.regime} (${s.count}y)`),
      axisLabel: { color: "#94a3b8", fontSize: 10 },
    },
    xAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8", formatter: "{value}%" },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
    },
    series: [
      { name: "Nominal", type: "bar", data: summaries.map((s) => ({ value: s.avgReturn, itemStyle: { color: s.color } })) },
      { name: "In USD", type: "bar", data: summaries.map((s) => s.avgUsdReturn), itemStyle: { color: "#10b981" } },
      { name: "In Gold", type: "bar", data: summaries.map((s) => s.avgGoldReturn), itemStyle: { color: "#f59e0b" } },
    ],
  }), [summaries]);

  return (
    <section id="regimes" className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="regimes-heading">
      <SectionHeading
        eyebrow="Regime Analysis"
        title="Which macro environment produces the best equity returns?"
        subtitle="Every year classified by GDP growth × inflation into 6 regimes. Bubble size = magnitude of Sensex return. Goldilocks (high growth + low inflation) consistently delivers."
      />

      <div className="my-6 flex gap-2">
        <button
          onClick={() => setShowScatter(true)}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
            showScatter ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          GDP × Inflation Scatter
        </button>
        <button
          onClick={() => setShowScatter(false)}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
            !showScatter ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          Regime Returns
        </button>
      </div>

      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4" data-testid="regime-chart">
        <ReactECharts
          echarts={echarts}
          option={showScatter ? scatterOption : barOption}
          style={{ height: 420 }}
          notMerge
        />
      </div>

      {/* Summary table */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-white/5 bg-slate-900/40">
        <table className="w-full text-xs text-slate-300">
          <thead>
            <tr className="border-b border-white/5 text-left text-slate-500">
              <th className="px-3 py-2">Regime</th>
              <th className="px-3 py-2">Definition</th>
              <th className="px-3 py-2 text-right">Years</th>
              <th className="px-3 py-2 text-right">Avg Return</th>
              <th className="px-3 py-2 text-right">Median</th>
              <th className="px-3 py-2 text-right">Win Rate</th>
              <th className="px-3 py-2 text-right">USD</th>
              <th className="px-3 py-2 text-right">Gold</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => (
              <tr key={s.regime} className="border-b border-white/5">
                <td className="px-3 py-1.5 font-medium" style={{ color: s.color }}>{s.regime}</td>
                <td className="px-3 py-1.5 text-slate-500">
                  {s.regime === "Goldilocks" && "GDP≥6%, CPI≤6%"}
                  {s.regime === "Overheating" && "GDP≥6%, CPI>6%"}
                  {s.regime === "Moderate" && "GDP 3-6%, CPI≤6%"}
                  {s.regime === "Stagflation-lite" && "GDP 3-6%, CPI>6%"}
                  {s.regime === "Stagflation" && "GDP<3%, CPI>6%"}
                  {s.regime === "Slowdown" && "GDP<3%, CPI≤6%"}
                </td>
                <td className="px-3 py-1.5 text-right">{s.count}</td>
                <td className={`px-3 py-1.5 text-right font-mono ${s.avgReturn > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {s.avgReturn > 0 ? "+" : ""}{s.avgReturn.toFixed(1)}%
                </td>
                <td className="px-3 py-1.5 text-right font-mono">{s.medianReturn.toFixed(1)}%</td>
                <td className="px-3 py-1.5 text-right">{s.positiveYears}/{s.count} ({((s.positiveYears / s.count) * 100).toFixed(0)}%)</td>
                <td className={`px-3 py-1.5 text-right font-mono ${s.avgUsdReturn > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {s.avgUsdReturn > 0 ? "+" : ""}{s.avgUsdReturn.toFixed(1)}%
                </td>
                <td className={`px-3 py-1.5 text-right font-mono ${s.avgGoldReturn > 0 ? "text-amber-400" : "text-red-400"}`}>
                  {s.avgGoldReturn > 0 ? "+" : ""}{s.avgGoldReturn.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[10px] text-slate-600">
        Classification: GDP growth and CPI inflation for each year mapped to 6 macro regimes.
        Bubble size proportional to absolute Sensex return. Win rate = % of years with positive returns.
        Goldilocks years (high growth + low inflation) have the highest average returns and win rates.
      </p>
    </section>
  );
}
