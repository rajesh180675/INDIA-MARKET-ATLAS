import { useMemo } from "react";
import ReactECharts from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import echarts from "@/lib/echarts";
import { getIndicator } from "@/data/macroIndicators";
import { continuousIndex, years } from "@/data/indiaMarketData";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * Computes Sensex in alternative denominators:
 * - USD terms (Sensex / USD-INR rate)
 * - Gold terms (Sensex / Gold price per 10g)
 * - Real terms (Sensex deflated by cumulative CPI)
 * All normalized to base 100 at their first overlapping year.
 */
function computeDerivedSeries() {
  const usdData = getIndicator("usd-inr")!.data;
  const goldData = getIndicator("gold-price")!.data;
  const cpiData = getIndicator("cpi-inflation")!.data;

  // Build lookup maps
  const usdMap = new Map(usdData.map((d) => [d.year, d.value]));
  const goldMap = new Map(goldData.map((d) => [d.year, d.value]));
  const cpiMap = new Map(cpiData.map((d) => [d.year, d.value]));

  // Sensex nominal (from continuousIndex)
  const sensexMap = new Map<number, number>();
  years.forEach((y: number, i: number) => {
    const val = continuousIndex[i]?.value;
    if (val != null) sensexMap.set(y, val);
  });

  // Sensex in USD
  const sensexUsd: [number, number][] = [];
  let baseUsd: number | null = null;
  for (const year of years) {
    const s = sensexMap.get(year);
    const u = usdMap.get(year);
    if (s != null && u != null && u > 0) {
      const val = s / u;
      if (baseUsd === null) baseUsd = val;
      sensexUsd.push([year, (val / baseUsd) * 100]);
    }
  }

  // Sensex in Gold (grams)
  const sensexGold: [number, number][] = [];
  let baseGold: number | null = null;
  for (const year of years) {
    const s = sensexMap.get(year);
    const g = goldMap.get(year);
    if (s != null && g != null && g > 0) {
      const val = s / g;
      if (baseGold === null) baseGold = val;
      sensexGold.push([year, (val / baseGold) * 100]);
    }
  }

  // Sensex real (CPI-deflated)
  const sensexReal: [number, number][] = [];
  let cumulativeInflation = 1;
  let baseReal: number | null = null;
  for (const year of years) {
    const s = sensexMap.get(year);
    const cpi = cpiMap.get(year);
    if (cpi != null) cumulativeInflation *= 1 + cpi / 100;
    if (s != null && cumulativeInflation > 0) {
      const val = s / cumulativeInflation;
      if (baseReal === null) baseReal = val;
      sensexReal.push([year, (val / baseReal) * 100]);
    }
  }

  // Sensex nominal normalized
  const sensexNom: [number, number][] = [];
  let baseNom: number | null = null;
  for (const year of years) {
    const s = sensexMap.get(year);
    if (s != null) {
      if (baseNom === null) baseNom = s;
      sensexNom.push([year, (s / baseNom) * 100]);
    }
  }

  return { sensexNom, sensexUsd, sensexGold, sensexReal };
}

export default function RealReturnsSection() {
  const { sensexNom, sensexUsd, sensexGold, sensexReal } = useMemo(computeDerivedSeries, []);

  const option = useMemo((): EChartsOption => ({
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      borderColor: "rgba(148, 163, 184, 0.2)",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
    },
    legend: {
      top: 0,
      textStyle: { color: "#94a3b8", fontSize: 11 },
      icon: "roundRect",
    },
    grid: { left: 60, right: 30, top: 40, bottom: 60 },
    xAxis: {
      type: "value",
      min: 1947,
      max: 2025,
      axisLabel: { color: "#94a3b8", formatter: "{value}" },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
    },
    yAxis: {
      type: "log",
      axisLabel: { color: "#94a3b8" },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
      name: "Index (base = 100)",
      nameTextStyle: { color: "#94a3b8" },
    },
    dataZoom: [
      { type: "inside", xAxisIndex: 0 },
      { type: "slider", xAxisIndex: 0, bottom: 10, height: 20,
        textStyle: { color: "#94a3b8" },
        borderColor: "rgba(148, 163, 184, 0.2)",
        fillerColor: "rgba(6, 182, 212, 0.1)" },
    ],
    series: [
      {
        name: "Nominal (INR)",
        type: "line",
        data: sensexNom,
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2.5, color: "#06b6d4" },
        itemStyle: { color: "#06b6d4" },
      },
      {
        name: "In USD terms",
        type: "line",
        data: sensexUsd,
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2, color: "#10b981" },
        itemStyle: { color: "#10b981" },
      },
      {
        name: "In Gold terms",
        type: "line",
        data: sensexGold,
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2, color: "#f59e0b" },
        itemStyle: { color: "#f59e0b" },
      },
      {
        name: "Real (CPI-adjusted)",
        type: "line",
        data: sensexReal,
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2, color: "#ef4444" },
        itemStyle: { color: "#ef4444" },
      },
    ],
  }), [sensexNom, sensexUsd, sensexGold, sensexReal]);

  // Compute final CAGR for each
  const cagr = (data: [number, number][]) => {
    if (data.length < 2) return 0;
    const years = data[data.length - 1][0] - data[0][0];
    const ratio = data[data.length - 1][1] / data[0][1];
    return ((Math.pow(ratio, 1 / years) - 1) * 100);
  };

  return (
    <section id="real-returns" className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="real-returns-heading">
      <SectionHeading
        eyebrow="Real Returns"
        title="Indian market in USD, Gold, and inflation-adjusted terms"
        subtitle="The nominal 1493x return since 1947 looks very different when measured in hard currencies. This chart reveals what Indian equities actually delivered to a global investor."
      />

      {/* Summary cards */}
      <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Nominal (INR)", value: cagr(sensexNom), color: "text-cyan-400" },
          { label: "In USD", value: cagr(sensexUsd), color: "text-emerald-400" },
          { label: "In Gold", value: cagr(sensexGold), color: "text-amber-400" },
          { label: "Real (CPI-adj)", value: cagr(sensexReal), color: "text-red-400" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-white/5 bg-slate-900/50 p-3 text-center">
            <div className={`text-xl font-bold ${item.color}`}>
              {item.value.toFixed(1)}%
            </div>
            <div className="mt-1 text-[11px] text-slate-500">{item.label} CAGR</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4" data-testid="real-returns-chart">
        <ReactECharts
          echarts={echarts}
          option={option}
          style={{ height: 420 }}
          notMerge
        />
      </div>

      <p className="mt-3 text-[10px] text-slate-600">
        All series normalized to base 100 at first available year. Log scale reveals compounding differences.
        USD conversion uses year-end RBI reference rate. Gold uses INR/10g price. CPI uses cumulative annual inflation.
      </p>
    </section>
  );
}
