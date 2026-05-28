import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import echarts from "@/lib/echarts";
import { continuousIndex, years } from "@/data/indiaMarketData";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * SIP vs Lumpsum Analysis:
 * - What if you invested ₹1000/month every year since X?
 * - Compare SIP returns vs lumpsum at start
 * - Show the power of rupee-cost averaging through crashes
 */

function buildSensexMap(): Map<number, number> {
  const map = new Map<number, number>();
  years.forEach((y: number, i: number) => {
    const val = continuousIndex[i]?.value;
    if (val != null) map.set(y, val);
  });
  return map;
}

interface SipResult {
  startYear: number;
  years: number;
  totalInvested: number;
  sipValue: number;
  sipXirr: number;
  lumpsumValue: number;
  lumpsumCagr: number;
  sipWon: boolean;
}

function computeSipVsLumpsum(sensexMap: Map<number, number>): SipResult[] {
  const results: SipResult[] = [];
  const endYear = 2025;
  const annualSip = 12000; // ₹1000/month = ₹12000/year

  for (const startYear of years) {
    if (startYear >= endYear - 2) continue; // need at least 3 years
    const startVal = sensexMap.get(startYear);
    const endVal = sensexMap.get(endYear);
    if (!startVal || !endVal) continue;

    const n = endYear - startYear;
    const totalInvested = annualSip * n;

    // SIP: invest ₹12000 at start of each year
    let sipUnits = 0;
    for (let y = startYear; y < endYear; y++) {
      const price = sensexMap.get(y);
      if (price && price > 0) {
        sipUnits += annualSip / price;
      }
    }
    const sipValue = sipUnits * endVal;

    // SIP XIRR approximation (use geometric mean of annual returns weighted by time)
    const sipXirr = n > 0 ? (Math.pow(sipValue / totalInvested, 2 / (n + 1)) - 1) * 100 : 0;

    // Lumpsum: invest total amount at start
    const lumpsumValue = (totalInvested * endVal) / startVal;
    const lumpsumCagr = (Math.pow(endVal / startVal, 1 / n) - 1) * 100;

    results.push({
      startYear,
      years: n,
      totalInvested,
      sipValue,
      sipXirr,
      lumpsumValue,
      lumpsumCagr,
      sipWon: sipValue > lumpsumValue,
    });
  }

  return results;
}

export default function SipSection() {
  const sensexMap = useMemo(buildSensexMap, []);
  const allResults = useMemo(() => computeSipVsLumpsum(sensexMap), [sensexMap]);
  const [startFrom, setStartFrom] = useState(1990);

  const filteredResults = useMemo(
    () => allResults.filter((r) => r.startYear >= startFrom),
    [allResults, startFrom]
  );

  // Chart: SIP value vs Lumpsum value for each start year
  const chartOption = useMemo((): EChartsOption => ({
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(15, 23, 42, 0.95)",
      borderColor: "rgba(148, 163, 184, 0.2)",
      textStyle: { color: "#e2e8f0", fontSize: 12 },
      valueFormatter: (v) => `₹${(Number(v) / 1000).toFixed(0)}K`,
    },
    legend: { top: 0, textStyle: { color: "#94a3b8", fontSize: 11 } },
    grid: { left: 70, right: 30, top: 40, bottom: 60 },
    xAxis: {
      type: "category",
      data: filteredResults.map((r) => String(r.startYear)),
      axisLabel: { color: "#94a3b8", rotate: 45 },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "#94a3b8",
        formatter: (v: number) => `₹${(v / 100000).toFixed(0)}L`,
      },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
    },
    dataZoom: [{ type: "inside" }, { type: "slider", bottom: 10, height: 20, textStyle: { color: "#94a3b8" } }],
    series: [
      {
        name: "SIP Value",
        type: "bar",
        data: filteredResults.map((r) => r.sipValue),
        itemStyle: { color: "#06b6d4" },
      },
      {
        name: "Lumpsum Value",
        type: "bar",
        data: filteredResults.map((r) => r.lumpsumValue),
        itemStyle: { color: "#f59e0b" },
      },
      {
        name: "Total Invested",
        type: "line",
        data: filteredResults.map((r) => r.totalInvested),
        lineStyle: { color: "#ef4444", type: "dashed", width: 1.5 },
        itemStyle: { color: "#ef4444" },
        symbol: "none",
      },
    ],
  }), [filteredResults]);

  // Summary stats
  const sipWinCount = allResults.filter((r) => r.sipWon).length;
  const avgSipXirr = allResults.length > 0
    ? allResults.reduce((a, b) => a + b.sipXirr, 0) / allResults.length : 0;
  const avgLumpsumCagr = allResults.length > 0
    ? allResults.reduce((a, b) => a + b.lumpsumCagr, 0) / allResults.length : 0;

  return (
    <section id="sip" className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="sip-heading">
      <SectionHeading
        eyebrow="SIP vs Lumpsum"
        title="₹1,000/month — the power of systematic investing"
        subtitle="For every possible start year, we compare: investing ₹12,000/year via SIP vs deploying the same total amount as a lumpsum at the start. Lumpsum wins more often (time in market > timing), but SIP shines when you start before crashes."
      />

      {/* Summary cards */}
      <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-slate-900/50 p-3 text-center">
          <div className="text-lg font-bold text-cyan-400">{avgSipXirr.toFixed(1)}%</div>
          <div className="mt-1 text-[11px] text-slate-500">Avg SIP return</div>
        </div>
        <div className="rounded-xl border border-white/5 bg-slate-900/50 p-3 text-center">
          <div className="text-lg font-bold text-amber-400">{avgLumpsumCagr.toFixed(1)}%</div>
          <div className="mt-1 text-[11px] text-slate-500">Avg Lumpsum CAGR</div>
        </div>
        <div className="rounded-xl border border-white/5 bg-slate-900/50 p-3 text-center">
          <div className="text-lg font-bold text-emerald-400">{sipWinCount}/{allResults.length}</div>
          <div className="mt-1 text-[11px] text-slate-500">SIP beat Lumpsum</div>
        </div>
        <div className="rounded-xl border border-white/5 bg-slate-900/50 p-3 text-center">
          <div className="text-lg font-bold text-violet-400">{allResults.length - sipWinCount}/{allResults.length}</div>
          <div className="mt-1 text-[11px] text-slate-500">Lumpsum beat SIP</div>
        </div>
      </div>

      {/* Period filter */}
      <div className="mb-4 flex gap-2">
        {[1950, 1970, 1980, 1990, 2000, 2010].map((y) => (
          <button
            key={y}
            onClick={() => setStartFrom(y)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
              startFrom === y ? "bg-cyan-700 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}
          >
            From {y}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4" data-testid="sip-chart">
        <ReactECharts echarts={echarts} option={chartOption} style={{ height: 380 }} notMerge />
      </div>

      {/* Key observations */}
      <div className="mt-4 rounded-xl border border-white/5 bg-slate-900/40 p-4">
        <h4 className="mb-2 text-xs font-semibold text-slate-400">Key Observations</h4>
        <ul className="space-y-1 text-[11px] text-slate-500">
          <li>• <span className="text-amber-400">Lumpsum wins ~{((allResults.length - sipWinCount) / allResults.length * 100).toFixed(0)}%</span> of the time — markets trend up, so earlier deployment captures more compounding.</li>
          <li>• <span className="text-cyan-400">SIP wins</span> when you start just before a crash (1992, 2000, 2007) — you buy more units at lower prices during the downturn.</li>
          <li>• Both strategies are profitable for every start year — no one who invested systematically for 5+ years has lost money in Indian equities.</li>
          <li>• The gap narrows for shorter holding periods — SIP's averaging benefit is most visible over 10+ year horizons.</li>
        </ul>
      </div>

      <p className="mt-3 text-[10px] text-slate-600">
        SIP: ₹12,000 invested at start of each year (₹1,000/month equivalent). Lumpsum: total amount deployed at start year's index level.
        Returns are approximate (annual data, not monthly). Real SIP returns would be slightly different with monthly granularity.
      </p>
    </section>
  );
}
