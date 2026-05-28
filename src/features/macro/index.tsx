import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import echarts from "@/lib/echarts";
import { macroIndicators, type MacroIndicator } from "@/data/macroIndicators";
import { SectionHeading } from "@/components/ui/SectionHeading";

const CATEGORY_LABELS: Record<MacroIndicator["category"], string> = {
  currency: "Currency",
  commodity: "Commodities",
  inflation: "Inflation",
  growth: "Growth",
  monetary: "Monetary Policy",
  external: "External Sector",
  fiscal: "Fiscal",
  market: "Market Valuation",
  demographic: "Demographics",
};

const CATEGORY_ORDER: MacroIndicator["category"][] = [
  "currency", "commodity", "inflation", "growth", "monetary",
  "external", "fiscal", "market", "demographic",
];

const COLORS = [
  "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316",
];

export default function MacroSection() {
  const [selected, setSelected] = useState<string[]>(["usd-inr", "gold-price", "cpi-inflation"]);
  const [logScale, setLogScale] = useState(false);
  const [normalize, setNormalize] = useState(false);

  const categories = useMemo(() => {
    const grouped = new Map<MacroIndicator["category"], MacroIndicator[]>();
    for (const ind of macroIndicators) {
      const list = grouped.get(ind.category) || [];
      list.push(ind);
      grouped.set(ind.category, list);
    }
    return grouped;
  }, []);

  const chartOption = useMemo((): EChartsOption => {
    const activeIndicators = macroIndicators.filter((i) => selected.includes(i.id));

    const series = activeIndicators.map((ind, idx) => {
      let data = ind.data.filter((d) => d.value !== null);

      if (normalize && data.length > 0) {
        const base = data[0].value!;
        data = data.map((d) => ({ year: d.year, value: base !== 0 ? (d.value! / base) * 100 : 0 }));
      }

      return {
        name: `${ind.name} (${ind.unit})`,
        type: "line" as const,
        data: data.map((d) => [d.year, d.value]),
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2, color: COLORS[idx % COLORS.length] },
        itemStyle: { color: COLORS[idx % COLORS.length] },
      };
    });

    return {
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
        type: logScale ? "log" : "value",
        axisLabel: { color: "#94a3b8" },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.1)" } },
        name: normalize ? "Index (base = 100)" : "",
        nameTextStyle: { color: "#94a3b8" },
      },
      dataZoom: [
        { type: "inside", xAxisIndex: 0 },
        { type: "slider", xAxisIndex: 0, bottom: 10, height: 20,
          textStyle: { color: "#94a3b8" },
          borderColor: "rgba(148, 163, 184, 0.2)",
          fillerColor: "rgba(6, 182, 212, 0.1)" },
      ],
      series,
    };
  }, [selected, logScale, normalize]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <section id="macro" className="mx-auto max-w-7xl px-4 py-16 sm:px-6" aria-labelledby="macro-heading">
      <SectionHeading
        eyebrow="Macro Context"
        title="16 indicators across 78 years"
        subtitle="Overlay any combination of India's key macroeconomic indicators against the market timeline. Toggle normalize to compare relative growth on a common base-100 scale."
      />

      {/* Controls */}
      <div className="mb-4 flex flex-wrap gap-3">
        <button
          onClick={() => setNormalize(!normalize)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            normalize ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          {normalize ? "Normalized (base 100)" : "Absolute values"}
        </button>
        <button
          onClick={() => setLogScale(!logScale)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            logScale ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          {logScale ? "Log scale" : "Linear scale"}
        </button>
        <button
          onClick={() => setSelected([])}
          className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700"
        >
          Clear all
        </button>
      </div>

      {/* Indicator selector */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORY_ORDER.map((cat) => {
          const indicators = categories.get(cat);
          if (!indicators) return null;
          return (
            <div key={cat} className="rounded-xl border border-white/5 bg-slate-900/50 p-3">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {CATEGORY_LABELS[cat]}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {indicators.map((ind) => (
                  <button
                    key={ind.id}
                    onClick={() => toggle(ind.id)}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                      selected.includes(ind.id)
                        ? "bg-cyan-700/60 text-cyan-100"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                    }`}
                    title={`${ind.name} — ${ind.source}`}
                  >
                    {ind.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4" data-testid="macro-chart">
        {selected.length === 0 ? (
          <div className="flex h-80 items-center justify-center text-slate-500">
            Select one or more indicators above to visualize
          </div>
        ) : (
          <ReactECharts
            echarts={echarts}
            option={chartOption}
            style={{ height: 420 }}
            notMerge
          />
        )}
      </div>

      {/* Source attribution */}
      <p className="mt-3 text-[10px] text-slate-600">
        Sources: RBI Handbook of Statistics, MOSPI National Accounts, IMF WEO, World Bank, BSE India, SEBI, PPAC, Census of India.
        Pre-1979 market data estimated from RBI Share Price Index.
      </p>
    </section>
  );
}
