import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import echarts from "@/lib/echarts";
import { macroIndicators, getIndicator } from "@/data/macroIndicators";
import { continuousIndex, years } from "@/data/indiaMarketData";
import { SectionHeading } from "@/components/ui/SectionHeading";

// Compute year-over-year returns for Sensex
function sensexReturns(): Map<number, number> {
  const map = new Map<number, number>();
  for (let i = 1; i < years.length; i++) {
    const prev = continuousIndex[i - 1]?.value;
    const curr = continuousIndex[i]?.value;
    if (prev != null && curr != null && prev > 0) {
      map.set(years[i], ((curr - prev) / prev) * 100);
    }
  }
  return map;
}

// Pearson correlation between two arrays
function pearson(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i] - mx;
    const yi = y[i] - my;
    num += xi * yi;
    dx += xi * xi;
    dy += yi * yi;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

interface CorrelationResult {
  id: string;
  name: string;
  correlation: number;
  n: number;
  interpretation: string;
}

function computeCorrelations(): CorrelationResult[] {
  const sensexRet = sensexReturns();
  const results: CorrelationResult[] = [];

  for (const ind of macroIndicators) {
    const indMap = new Map(ind.data.filter((d) => d.value !== null).map((d) => [d.year, d.value!]));
    
    // Align years
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [year, ret] of sensexRet) {
      const val = indMap.get(year);
      if (val !== undefined) {
        xs.push(ret);
        ys.push(val);
      }
    }

    if (xs.length >= 10) {
      const r = pearson(xs, ys);
      let interpretation = "Negligible";
      const absR = Math.abs(r);
      if (absR > 0.7) interpretation = r > 0 ? "Strong positive" : "Strong negative";
      else if (absR > 0.4) interpretation = r > 0 ? "Moderate positive" : "Moderate negative";
      else if (absR > 0.2) interpretation = r > 0 ? "Weak positive" : "Weak negative";

      results.push({ id: ind.id, name: ind.name, correlation: r, n: xs.length, interpretation });
    }
  }

  return results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

// Decade-wise returns in different denominations
interface DecadeReturn {
  decade: string;
  startYear: number;
  endYear: number;
  nominal: number;
  usd: number;
  gold: number;
  real: number;
}

function computeDecadeReturns(): DecadeReturn[] {
  const usdMap = new Map(getIndicator("usd-inr")!.data.map((d) => [d.year, d.value]));
  const goldMap = new Map(getIndicator("gold-price")!.data.map((d) => [d.year, d.value]));
  const cpiMap = new Map(getIndicator("cpi-inflation")!.data.map((d) => [d.year, d.value]));

  const sensexMap = new Map<number, number>();
  years.forEach((y: number, i: number) => {
    const val = continuousIndex[i]?.value;
    if (val != null) sensexMap.set(y, val);
  });

  const decades: [string, number, number][] = [
    ["1950s", 1950, 1960], ["1960s", 1960, 1970], ["1970s", 1970, 1980],
    ["1980s", 1980, 1990], ["1990s", 1990, 2000], ["2000s", 2000, 2010],
    ["2010s", 2010, 2020], ["2020-25", 2020, 2025],
  ];

  const cagr = (start: number, end: number, years: number) =>
    years > 0 ? (Math.pow(end / start, 1 / years) - 1) * 100 : 0;

  const results: DecadeReturn[] = [];

  for (const [label, sy, ey] of decades) {
    const s = sensexMap.get(sy);
    const e = sensexMap.get(ey);
    if (!s || !e) continue;

    const n = ey - sy;
    const nominal = cagr(s, e, n);

    // USD-adjusted
    const usdS = usdMap.get(sy);
    const usdE = usdMap.get(ey);
    let usd = nominal;
    if (usdS && usdE && usdS > 0 && usdE > 0) {
      usd = cagr(s / usdS, e / usdE, n);
    }

    // Gold-adjusted
    const goldS = goldMap.get(sy);
    const goldE = goldMap.get(ey);
    let gold = nominal;
    if (goldS && goldE && goldS > 0 && goldE > 0) {
      gold = cagr(s / goldS, e / goldE, n);
    }

    // Real (CPI-deflated)
    let cumulCpi = 1;
    for (let y = sy + 1; y <= ey; y++) {
      const c = cpiMap.get(y);
      if (c != null) cumulCpi *= 1 + c / 100;
    }
    const real = cagr(1, (e / s) / cumulCpi, n);

    results.push({ decade: label, startYear: sy, endYear: ey, nominal, usd, gold, real });
  }

  return results;
}

export default function CorrelationSection() {
  const [view, setView] = useState<"correlation" | "decades">("correlation");
  const correlations = useMemo(computeCorrelations, []);
  const decadeReturns = useMemo(computeDecadeReturns, []);

  const corrChartOption = useMemo((): EChartsOption => ({
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      borderColor: "rgba(148, 163, 184, 0.2)",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
    },
    grid: { left: 180, right: 40, top: 20, bottom: 30 },
    xAxis: {
      type: "value",
      min: -1,
      max: 1,
      axisLabel: { color: "#94a3b8" },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
    },
    yAxis: {
      type: "category",
      data: correlations.map((c) => c.name).reverse(),
      axisLabel: { color: "#94a3b8", fontSize: 10 },
    },
    series: [{
      type: "bar",
      data: correlations.map((c) => ({
        value: c.correlation,
        itemStyle: {
          color: c.correlation > 0 ? "#10b981" : "#ef4444",
          opacity: Math.min(1, Math.abs(c.correlation) * 1.5 + 0.3),
        },
      })).reverse(),
      barWidth: "60%",
    }],
  }), [correlations]);

  const decadeChartOption = useMemo((): EChartsOption => ({
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      borderColor: "rgba(148, 163, 184, 0.2)",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      valueFormatter: (v) => `${Number(v).toFixed(1)}%`,
    },
    legend: {
      top: 0,
      textStyle: { color: "#94a3b8", fontSize: 11 },
    },
    grid: { left: 60, right: 30, top: 40, bottom: 30 },
    xAxis: {
      type: "category",
      data: decadeReturns.map((d) => d.decade),
      axisLabel: { color: "#94a3b8" },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8", formatter: "{value}%" },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
    },
    series: [
      { name: "Nominal (INR)", type: "bar", data: decadeReturns.map((d) => d.nominal),
        itemStyle: { color: "#06b6d4" } },
      { name: "In USD", type: "bar", data: decadeReturns.map((d) => d.usd),
        itemStyle: { color: "#10b981" } },
      { name: "In Gold", type: "bar", data: decadeReturns.map((d) => d.gold),
        itemStyle: { color: "#f59e0b" } },
      { name: "Real (CPI-adj)", type: "bar", data: decadeReturns.map((d) => d.real),
        itemStyle: { color: "#ef4444" } },
    ],
  }), [decadeReturns]);

  return (
    <section id="analytics" className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="analytics-heading">
      <SectionHeading
        eyebrow="Deep Analytics"
        title="Correlation analysis and decade-wise decomposition"
        subtitle="How do macro variables relate to equity returns? And how did each decade perform when measured in hard currencies vs nominal INR?"
      />

      {/* View toggle */}
      <div className="my-6 flex gap-2">
        <button
          onClick={() => setView("correlation")}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
            view === "correlation" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          Correlation Matrix
        </button>
        <button
          onClick={() => setView("decades")}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
            view === "decades" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          Decade Returns
        </button>
      </div>

      {view === "correlation" ? (
        <>
          <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4" data-testid="correlation-chart">
            <ReactECharts echarts={echarts} option={corrChartOption} style={{ height: 450 }} notMerge />
          </div>
          {/* Correlation table */}
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/5 bg-slate-900/40">
            <table className="w-full text-xs text-slate-300">
              <thead>
                <tr className="border-b border-white/5 text-left text-slate-500">
                  <th className="px-3 py-2">Indicator</th>
                  <th className="px-3 py-2 text-right">r</th>
                  <th className="px-3 py-2 text-right">n</th>
                  <th className="px-3 py-2">Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {correlations.map((c) => (
                  <tr key={c.id} className="border-b border-white/5">
                    <td className="px-3 py-1.5">{c.name}</td>
                    <td className={`px-3 py-1.5 text-right font-mono ${
                      c.correlation > 0.3 ? "text-emerald-400" : c.correlation < -0.3 ? "text-red-400" : "text-slate-400"
                    }`}>
                      {c.correlation > 0 ? "+" : ""}{c.correlation.toFixed(3)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-500">{c.n}</td>
                    <td className="px-3 py-1.5 text-slate-500">{c.interpretation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[10px] text-slate-600">
            Pearson correlation between annual Sensex returns (%) and each indicator's level.
            Correlation ≠ causation. n = overlapping data years. |r| &gt; 0.4 = moderate, &gt; 0.7 = strong.
          </p>
        </>
      ) : (
        <>
          <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4" data-testid="decade-chart">
            <ReactECharts echarts={echarts} option={decadeChartOption} style={{ height: 380 }} notMerge />
          </div>
          {/* Decade table */}
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/5 bg-slate-900/40">
            <table className="w-full text-xs text-slate-300">
              <thead>
                <tr className="border-b border-white/5 text-left text-slate-500">
                  <th className="px-3 py-2">Decade</th>
                  <th className="px-3 py-2 text-right">Nominal</th>
                  <th className="px-3 py-2 text-right">USD</th>
                  <th className="px-3 py-2 text-right">Gold</th>
                  <th className="px-3 py-2 text-right">Real</th>
                  <th className="px-3 py-2">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {decadeReturns.map((d) => {
                  const verdict = d.real > 8 ? "Exceptional" : d.real > 4 ? "Good" : d.real > 0 ? "Mediocre" : "Lost decade";
                  return (
                    <tr key={d.decade} className="border-b border-white/5">
                      <td className="px-3 py-1.5 font-medium">{d.decade}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-cyan-400">{d.nominal.toFixed(1)}%</td>
                      <td className="px-3 py-1.5 text-right font-mono text-emerald-400">{d.usd.toFixed(1)}%</td>
                      <td className={`px-3 py-1.5 text-right font-mono ${d.gold > 0 ? "text-amber-400" : "text-red-400"}`}>{d.gold.toFixed(1)}%</td>
                      <td className={`px-3 py-1.5 text-right font-mono ${d.real > 0 ? "text-slate-200" : "text-red-400"}`}>{d.real.toFixed(1)}%</td>
                      <td className="px-3 py-1.5 text-slate-500">{verdict}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[10px] text-slate-600">
            CAGR for each decade in four denominations. "In Gold" = equity returns minus gold appreciation.
            Negative gold-adjusted returns mean gold outperformed equities that decade.
            "Real" = nominal minus cumulative CPI inflation.
          </p>
        </>
      )}
    </section>
  );
}
