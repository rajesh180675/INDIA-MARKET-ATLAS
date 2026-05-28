import { useMemo } from "react";
import ReactECharts from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import echarts from "@/lib/echarts";
import { getIndicator } from "@/data/macroIndicators";
import { continuousIndex, years } from "@/data/indiaMarketData";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * Purchasing Power Deep Dive:
 * 1. What ₹1 lakh in each decade buys today
 * 2. Sensex earnings yield vs G-Sec yield (equity risk premium)
 * 3. Sensex vs Nominal GDP growth (market pricing efficiency)
 */

function computePurchasingPower() {
  const cpiMap = new Map(getIndicator("cpi-inflation")!.data.map((d) => [d.year, d.value]));

  // What ₹1 lakh invested in year X is worth today in real terms
  const decades = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
  const results: { year: number; nominalGrowth: number; realValue: number; inflationEroded: number }[] = [];

  const sensexMap = new Map<number, number>();
  years.forEach((y: number, i: number) => {
    const val = continuousIndex[i]?.value;
    if (val != null) sensexMap.set(y, val);
  });

  for (const startYear of decades) {
    const startVal = sensexMap.get(startYear);
    const endVal = sensexMap.get(2025);
    if (!startVal || !endVal) continue;

    const nominalGrowth = endVal / startVal;

    // Cumulative inflation from startYear to 2025
    let cumulCpi = 1;
    for (let y = startYear + 1; y <= 2025; y++) {
      const c = cpiMap.get(y);
      if (c != null) cumulCpi *= 1 + c / 100;
    }

    const realValue = (nominalGrowth / cumulCpi) * 100000;
    const inflationEroded = cumulCpi;

    results.push({ year: startYear, nominalGrowth, realValue, inflationEroded });
  }

  return results;
}

function computeEquityRiskPremium() {
  const peMap = new Map(getIndicator("sensex-pe")!.data.map((d) => [d.year, d.value]));
  const gsecMap = new Map(getIndicator("gsec-yield")!.data.map((d) => [d.year, d.value]));

  const data: [number, number, number, number][] = []; // [year, earningsYield, gsec, premium]

  for (const [year, pe] of peMap) {
    const gsec = gsecMap.get(year);
    if (pe && gsec && pe > 0) {
      const ey = 100 / pe; // earnings yield = 1/PE * 100
      const premium = ey - gsec;
      data.push([year, ey, gsec, premium]);
    }
  }

  return data.sort((a, b) => a[0] - b[0]);
}

function computeMarketVsGdp() {
  const gdpMap = new Map(getIndicator("nominal-gdp")!.data.map((d) => [d.year, d.value]));

  const sensexMap = new Map<number, number>();
  years.forEach((y: number, i: number) => {
    const val = continuousIndex[i]?.value;
    if (val != null) sensexMap.set(y, val);
  });

  // Normalize both to base 100 at 1990
  const sensex1990 = sensexMap.get(1990);
  const gdp1990 = gdpMap.get(1990);
  if (!sensex1990 || !gdp1990) return { sensex: [], gdp: [] };

  const sensexSeries: [number, number][] = [];
  const gdpSeries: [number, number][] = [];

  for (const year of years) {
    const s = sensexMap.get(year);
    const g = gdpMap.get(year);
    if (s && year >= 1990) sensexSeries.push([year, (s / sensex1990) * 100]);
    if (g && year >= 1990) gdpSeries.push([year, (g / gdp1990) * 100]);
  }

  return { sensex: sensexSeries, gdp: gdpSeries };
}

export default function PurchasingPowerSection() {
  const ppData = useMemo(computePurchasingPower, []);
  const erpData = useMemo(computeEquityRiskPremium, []);
  const { sensex: mktSeries, gdp: gdpSeries } = useMemo(computeMarketVsGdp, []);

  const erpOption = useMemo((): EChartsOption => ({
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      borderColor: "rgba(148, 163, 184, 0.2)",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
    },
    legend: { top: 0, textStyle: { color: "#94a3b8", fontSize: 11 } },
    grid: { left: 50, right: 30, top: 40, bottom: 60 },
    xAxis: {
      type: "value",
      min: erpData.length > 0 ? erpData[0][0] : 1990,
      max: 2025,
      axisLabel: { color: "#94a3b8", formatter: "{value}" },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8", formatter: "{value}%" },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
    },
    dataZoom: [{ type: "inside" }, { type: "slider", bottom: 10, height: 20, textStyle: { color: "#94a3b8" } }],
    series: [
      { name: "Earnings Yield (1/PE)", type: "line", data: erpData.map((d) => [d[0], d[1]]),
        smooth: true, symbol: "none", lineStyle: { width: 2, color: "#06b6d4" }, itemStyle: { color: "#06b6d4" } },
      { name: "10Y G-Sec Yield", type: "line", data: erpData.map((d) => [d[0], d[2]]),
        smooth: true, symbol: "none", lineStyle: { width: 2, color: "#f59e0b" }, itemStyle: { color: "#f59e0b" } },
      { name: "Equity Risk Premium", type: "bar", data: erpData.map((d) => ({
          value: [d[0], d[3]],
          itemStyle: { color: d[3] > 0 ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)" },
        })),
        barWidth: "60%",
      },
    ],
  }), [erpData]);

  const gdpVsMktOption = useMemo((): EChartsOption => ({
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      borderColor: "rgba(148, 163, 184, 0.2)",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
    },
    legend: { top: 0, textStyle: { color: "#94a3b8", fontSize: 11 } },
    grid: { left: 60, right: 30, top: 40, bottom: 60 },
    xAxis: {
      type: "value",
      min: 1990,
      max: 2025,
      axisLabel: { color: "#94a3b8", formatter: "{value}" },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
    },
    yAxis: {
      type: "log",
      axisLabel: { color: "#94a3b8" },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
      name: "Index (1990 = 100)",
      nameTextStyle: { color: "#94a3b8" },
    },
    dataZoom: [{ type: "inside" }, { type: "slider", bottom: 10, height: 20, textStyle: { color: "#94a3b8" } }],
    series: [
      { name: "Sensex", type: "line", data: mktSeries, smooth: true, symbol: "none",
        lineStyle: { width: 2.5, color: "#06b6d4" }, itemStyle: { color: "#06b6d4" } },
      { name: "Nominal GDP", type: "line", data: gdpSeries, smooth: true, symbol: "none",
        lineStyle: { width: 2, color: "#10b981", type: "dashed" }, itemStyle: { color: "#10b981" } },
    ],
  }), [mktSeries, gdpSeries]);

  return (
    <section id="purchasing-power" className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="pp-heading">
      <SectionHeading
        eyebrow="Purchasing Power"
        title="What your money actually bought — and the equity risk premium"
        subtitle="Inflation is the silent tax. This section shows how much of your nominal returns were real, whether equities compensated for risk vs bonds, and how the market tracks GDP."
      />

      {/* Purchasing power table */}
      <h3 className="mt-8 mb-3 text-sm font-semibold text-slate-300">
        ₹1 lakh invested in equities — real value today (2025)
      </h3>
      <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-900/40">
        <table className="w-full text-xs text-slate-300">
          <thead>
            <tr className="border-b border-white/5 text-left text-slate-500">
              <th className="px-3 py-2">Invested in</th>
              <th className="px-3 py-2 text-right">Nominal growth</th>
              <th className="px-3 py-2 text-right">Inflation multiplier</th>
              <th className="px-3 py-2 text-right">Real value today</th>
              <th className="px-3 py-2 text-right">Real multiple</th>
            </tr>
          </thead>
          <tbody>
            {ppData.map((d) => (
              <tr key={d.year} className="border-b border-white/5">
                <td className="px-3 py-1.5 font-medium">{d.year}</td>
                <td className="px-3 py-1.5 text-right font-mono text-cyan-400">{d.nominalGrowth.toFixed(0)}x</td>
                <td className="px-3 py-1.5 text-right font-mono text-red-400">{d.inflationEroded.toFixed(0)}x</td>
                <td className="px-3 py-1.5 text-right font-mono text-emerald-400">
                  ₹{(d.realValue / 100000).toFixed(1)} lakh
                </td>
                <td className="px-3 py-1.5 text-right font-mono">
                  {(d.realValue / 100000).toFixed(1)}x
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-slate-600">
        Real value = nominal growth ÷ cumulative CPI inflation. ₹1 lakh in 1950 grew 1493x nominally but inflation was 227x, so real purchasing power grew ~6.6x.
      </p>

      {/* Equity Risk Premium */}
      <h3 className="mt-10 mb-3 text-sm font-semibold text-slate-300">
        Equity Risk Premium: Earnings Yield vs G-Sec Yield
      </h3>
      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4" data-testid="erp-chart">
        <ReactECharts echarts={echarts} option={erpOption} style={{ height: 350 }} notMerge />
      </div>
      <p className="mt-2 text-[10px] text-slate-600">
        Earnings yield = 100/PE. When EY &gt; G-Sec yield, equities are "cheap" vs bonds (positive risk premium).
        Negative premium (2007, 2021) = market euphoria. Current PE ~20 → EY 5.0% vs G-Sec 6.4% = -1.4% premium (slightly expensive).
      </p>

      {/* Market vs GDP */}
      <h3 className="mt-10 mb-3 text-sm font-semibold text-slate-300">
        Sensex vs Nominal GDP (base 1990 = 100)
      </h3>
      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4" data-testid="gdp-vs-market-chart">
        <ReactECharts echarts={echarts} option={gdpVsMktOption} style={{ height: 350 }} notMerge />
      </div>
      <p className="mt-2 text-[10px] text-slate-600">
        Over long periods, equity markets track nominal GDP growth (corporate profits are a share of GDP).
        Divergences = valuation expansion/compression. Sensex outpaced GDP since 2003 due to PE re-rating from 14x to 20x+.
      </p>
    </section>
  );
}
