import { useMemo } from "react";
import ReactECharts from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import echarts from "@/lib/echarts";
import { getIndicator } from "@/data/macroIndicators";
import { continuousIndex, years } from "@/data/indiaMarketData";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * Asset Class Race: ₹100 invested in 1979 (Sensex base year) across:
 * - Equities (Sensex)
 * - Gold
 * - USD (holding dollars)
 * - Fixed Deposit (proxy: policy rate compounded)
 * - Inflation (CPI erosion of purchasing power)
 */
function computeAssetRace() {
  const goldData = getIndicator("gold-price")!.data;
  const usdData = getIndicator("usd-inr")!.data;
  const rateData = getIndicator("policy-rate")!.data;
  const cpiData = getIndicator("cpi-inflation")!.data;

  const goldMap = new Map(goldData.map((d) => [d.year, d.value]));
  const usdMap = new Map(usdData.map((d) => [d.year, d.value]));
  const rateMap = new Map(rateData.map((d) => [d.year, d.value]));
  const cpiMap = new Map(cpiData.map((d) => [d.year, d.value]));

  const sensexMap = new Map<number, number>();
  years.forEach((y: number, i: number) => {
    const val = continuousIndex[i]?.value;
    if (val != null) sensexMap.set(y, val);
  });

  const startYear = 1979;
  const raceYears = years.filter((y) => y >= startYear);

  // Sensex
  const sensexBase = sensexMap.get(startYear)!;
  const equities: [number, number][] = raceYears
    .filter((y) => sensexMap.has(y))
    .map((y) => [y, (sensexMap.get(y)! / sensexBase) * 100]);

  // Gold
  const goldBase = goldMap.get(startYear);
  const gold: [number, number][] = goldBase
    ? raceYears.filter((y) => goldMap.has(y) && goldMap.get(y) != null)
        .map((y) => [y, (goldMap.get(y)! / goldBase) * 100])
    : [];

  // USD (holding dollars, converting back to INR)
  const usdBase = usdMap.get(startYear);
  const usd: [number, number][] = usdBase
    ? raceYears.filter((y) => usdMap.has(y) && usdMap.get(y) != null)
        .map((y) => [y, (usdMap.get(y)! / usdBase) * 100])
    : [];

  // Fixed Deposit (compounded at policy rate each year)
  let fdValue = 100;
  const fd: [number, number][] = [[startYear, 100]];
  for (let i = 1; i < raceYears.length; i++) {
    const rate = rateMap.get(raceYears[i]) ?? rateMap.get(raceYears[i - 1]) ?? 6;
    fdValue *= 1 + (rate as number) / 100;
    fd.push([raceYears[i], fdValue]);
  }

  // Inflation erosion (what ₹100 buys over time)
  let inflationValue = 100;
  const inflation: [number, number][] = [[startYear, 100]];
  for (let i = 1; i < raceYears.length; i++) {
    const cpi = cpiMap.get(raceYears[i]);
    if (cpi != null) inflationValue *= 1 + (cpi as number) / 100;
    inflation.push([raceYears[i], inflationValue]);
  }

  return { equities, gold, usd, fd, inflation };
}

export default function AssetRaceSection() {
  const { equities, gold, usd, fd, inflation } = useMemo(computeAssetRace, []);

  const option = useMemo((): EChartsOption => ({
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      borderColor: "rgba(148, 163, 184, 0.2)",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      valueFormatter: (v) => `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
    },
    legend: {
      top: 0,
      textStyle: { color: "#94a3b8", fontSize: 11 },
      icon: "roundRect",
    },
    grid: { left: 70, right: 30, top: 40, bottom: 60 },
    xAxis: {
      type: "value",
      min: 1979,
      max: 2025,
      axisLabel: { color: "#94a3b8", formatter: "{value}" },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
    },
    yAxis: {
      type: "log",
      axisLabel: {
        color: "#94a3b8",
        formatter: (v: number) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`,
      },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
      name: "₹100 invested in 1979",
      nameTextStyle: { color: "#94a3b8" },
    },
    dataZoom: [
      { type: "inside", xAxisIndex: 0 },
      { type: "slider", xAxisIndex: 0, bottom: 10, height: 20,
        textStyle: { color: "#94a3b8" },
        borderColor: "rgba(148, 163, 184, 0.2)" },
    ],
    series: [
      { name: "Equities (Sensex)", type: "line", data: equities, smooth: true, symbol: "none",
        lineStyle: { width: 3, color: "#06b6d4" }, itemStyle: { color: "#06b6d4" }, z: 5 },
      { name: "Gold", type: "line", data: gold, smooth: true, symbol: "none",
        lineStyle: { width: 2, color: "#f59e0b" }, itemStyle: { color: "#f59e0b" } },
      { name: "USD (hold dollars)", type: "line", data: usd, smooth: true, symbol: "none",
        lineStyle: { width: 2, color: "#10b981" }, itemStyle: { color: "#10b981" } },
      { name: "Fixed Deposit", type: "line", data: fd, smooth: true, symbol: "none",
        lineStyle: { width: 2, color: "#8b5cf6", type: "dashed" }, itemStyle: { color: "#8b5cf6" } },
      { name: "Inflation (cost of living)", type: "line", data: inflation, smooth: true, symbol: "none",
        lineStyle: { width: 1.5, color: "#ef4444", type: "dotted" }, itemStyle: { color: "#ef4444" } },
    ],
  }), [equities, gold, usd, fd, inflation]);

  // Final values
  const final = (data: [number, number][]) => data.length > 0 ? data[data.length - 1][1] : 0;

  return (
    <section id="asset-race" className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="asset-race-heading">
      <SectionHeading
        eyebrow="Asset Class Race"
        title="₹100 invested in 1979 — where is it today?"
        subtitle="A head-to-head comparison of Indian asset classes over 46 years. Equities dominate on a long enough timeline, but the journey matters as much as the destination."
      />

      {/* Final value cards */}
      <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Equities", value: final(equities), color: "text-cyan-400" },
          { label: "Gold", value: final(gold), color: "text-amber-400" },
          { label: "Fixed Deposit", value: final(fd), color: "text-violet-400" },
          { label: "USD", value: final(usd), color: "text-emerald-400" },
          { label: "Inflation", value: final(inflation), color: "text-red-400" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-white/5 bg-slate-900/50 p-3 text-center">
            <div className={`text-lg font-bold ${item.color}`}>
              ₹{item.value >= 1000 ? `${(item.value / 1000).toFixed(1)}K` : item.value.toFixed(0)}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4" data-testid="asset-race-chart">
        <ReactECharts
          echarts={echarts}
          option={option}
          style={{ height: 420 }}
          notMerge
        />
      </div>

      <p className="mt-3 text-[10px] text-slate-600">
        Equities = BSE Sensex total index. Gold = INR/10g price. USD = holding dollars, converting at year-end rate.
        FD = compounded annually at RBI policy rate (proxy for bank FD rates). Inflation = cumulative CPI.
        All start at ₹100 in 1979 (Sensex base year). Log scale.
      </p>
    </section>
  );
}
