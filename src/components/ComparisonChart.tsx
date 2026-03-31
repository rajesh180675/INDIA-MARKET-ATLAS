import { useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { GlobalComparisonPoint } from "../data/indiaMarketData";
import useDocumentTheme from "../hooks/useDocumentTheme";
import {
  clamp,
  formatNumber,
  formatPercent,
  summarizeSeries,
  zoomWindowFromPercent,
} from "../charts/marketChartUtils";

type ZoomState = {
  start: number;
  end: number;
};

function extractZoomState(event: unknown): ZoomState | null {
  if (!event || typeof event !== "object") {
    return null;
  }

  const candidate =
    "batch" in event && Array.isArray((event as { batch?: unknown[] }).batch)
      ? (event as { batch: Array<Record<string, number>> }).batch[0]
      : (event as Record<string, number>);

  if (!candidate) {
    return null;
  }

  if (
    typeof candidate.start === "number" &&
    typeof candidate.end === "number"
  ) {
    return {
      start: clamp(candidate.start, 0, 100),
      end: clamp(candidate.end, 0, 100),
    };
  }

  return null;
}

function paletteFor(theme: "dark" | "light") {
  return theme === "light"
    ? {
        text: "#0f172a",
        muted: "#475569",
        subtle: "#64748b",
        grid: "rgba(15, 23, 42, 0.08)",
        gridStrong: "rgba(15, 23, 42, 0.14)",
        panel: "#ffffff",
        panelBorder: "rgba(15, 23, 42, 0.08)",
        india: "#047857",
        usa: "#0284c7",
        china: "#db2777",
        sliderBg: "rgba(15, 23, 42, 0.04)",
        sliderFill: "rgba(14, 165, 233, 0.12)",
      }
    : {
        text: "#f8fafc",
        muted: "#cbd5e1",
        subtle: "#94a3b8",
        grid: "rgba(255, 255, 255, 0.08)",
        gridStrong: "rgba(255, 255, 255, 0.15)",
        panel: "#020617",
        panelBorder: "rgba(255, 255, 255, 0.08)",
        india: "#34d399",
        usa: "#60a5fa",
        china: "#f472b6",
        sliderBg: "rgba(255, 255, 255, 0.03)",
        sliderFill: "rgba(56, 189, 248, 0.14)",
      };
}

function rangeFromYears(data: GlobalComparisonPoint[], years: number) {
  if (!data.length) {
    return { start: 0, end: 100 };
  }

  const lastYear = data[data.length - 1]?.year ?? 2025;
  const startYear = lastYear - years + 1;
  const firstIndex = data.findIndex((point) => point.year >= startYear);
  if (firstIndex <= 0) {
    return { start: 0, end: 100 };
  }

  return {
    start: (firstIndex / Math.max(data.length - 1, 1)) * 100,
    end: 100,
  };
}

export default function ComparisonChart({
  data,
}: {
  data: GlobalComparisonPoint[];
}) {
  const theme = useDocumentTheme();
  const palette = paletteFor(theme);
  const chartRef = useRef<ReactECharts | null>(null);
  const [zoomState, setZoomState] = useState<ZoomState>({ start: 0, end: 100 });

  if (!data || data.length === 0) {
    return (
      <div className="rounded-[30px] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
        Comparison data is currently unavailable.
      </div>
    );
  }

  const years = data.map((point) => point.year);
  const labels = years.map(String);
  const india = data.map((point) => point.india);
  const usa = data.map((point) => point.usa);
  const china = data.map((point) => point.china);

  const window = zoomWindowFromPercent(
    data.length,
    zoomState.start,
    zoomState.end,
  );
  const visibleData = data.slice(window.startIndex, window.endIndex + 1);
  const indiaSummary = summarizeSeries(
    visibleData.map((point) => point.india),
    visibleData.map((point) => String(point.year)),
    visibleData.map((point) => point.year),
  );

  const option = useMemo<EChartsOption>(
    () => ({
      backgroundColor: "transparent",
      animationDuration: 380,
      textStyle: { color: palette.text, fontFamily: "inherit" },
      grid: [{ left: 58, right: 22, top: 30, height: "66%" }],
      tooltip: {
        trigger: "axis",
        backgroundColor:
          theme === "dark" ? "rgba(2,6,23,0.96)" : "rgba(255,255,255,0.98)",
        borderColor: palette.panelBorder,
        textStyle: { color: palette.text },
        extraCssText:
          "box-shadow: 0 16px 44px rgba(15,23,42,0.18); border-radius: 16px;",
        formatter: (params) => {
          const list = Array.isArray(params) ? params : [params];
          const axisValue =
            list[0] && typeof list[0] === "object" && "axisValue" in list[0]
              ? (list[0] as { axisValue?: string | number }).axisValue
              : "—";
          const point = data.find(
            (item) => String(item.year) === String(axisValue),
          );
          if (!point) {
            return "";
          }

          const sorted = [
            { label: "India", color: palette.india, value: point.india },
            { label: "USA", color: palette.usa, value: point.usa },
            { label: "China", color: palette.china, value: point.china },
          ].sort((a, b) => b.value - a.value);

          return [
            `<div style="min-width:220px">`,
            `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">`,
            `<strong style="font-size:14px">${point.year}</strong>`,
            `<span style="font-size:12px;color:${palette.subtle}">Leader: ${sorted[0]?.label ?? "—"}</span>`,
            `</div>`,
            ...sorted.map(
              (entry) =>
                `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;margin-top:6px">
                  <span style="color:${entry.color}">${entry.label}</span>
                  <strong>${formatNumber(entry.value)}</strong>
                </div>`,
            ),
            `</div>`,
          ].join("");
        },
      },
      toolbox: {
        right: 8,
        top: 0,
        iconStyle: { borderColor: palette.subtle },
        feature: {
          restore: {},
          saveAsImage: {
            title: "Export PNG",
            backgroundColor: palette.panel,
          },
        },
      },
      axisPointer: {
        lineStyle: { color: palette.gridStrong, width: 1.1 },
      },
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: [0],
          filterMode: "none",
          start: zoomState.start,
          end: zoomState.end,
        },
        {
          type: "slider",
          xAxisIndex: [0],
          filterMode: "none",
          height: 28,
          bottom: 14,
          borderColor: palette.panelBorder,
          fillerColor: palette.sliderFill,
          backgroundColor: palette.sliderBg,
          handleStyle: { color: palette.text, borderColor: palette.panel },
          textStyle: { color: palette.subtle },
          start: zoomState.start,
          end: zoomState.end,
        },
      ],
      xAxis: [
        {
          type: "category",
          boundaryGap: false,
          data: labels,
          axisLine: { lineStyle: { color: palette.gridStrong } },
          axisLabel: { color: palette.muted, hideOverlap: true },
          axisTick: { show: false },
          splitLine: { show: false },
        },
      ],
      yAxis: [
        {
          type: "log",
          scale: true,
          axisLine: { show: false },
          axisLabel: {
            color: palette.muted,
            formatter: (value: number) => formatNumber(value),
          },
          splitLine: { lineStyle: { color: palette.grid } },
        },
      ],
      series: [
        {
          name: "India",
          type: "line",
          smooth: 0.22,
          showSymbol: false,
          lineStyle: { color: palette.india, width: 3.2 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${palette.india}66` },
                { offset: 1, color: `${palette.india}08` },
              ],
            },
          },
          data: india,
        },
        {
          name: "USA",
          type: "line",
          smooth: 0.2,
          showSymbol: false,
          lineStyle: { color: palette.usa, width: 2.5 },
          data: usa,
        },
        {
          name: "China",
          type: "line",
          smooth: 0.2,
          showSymbol: false,
          lineStyle: { color: palette.china, width: 2.5 },
          data: china,
        },
      ],
    }),
    [
      china,
      data,
      india,
      labels,
      palette,
      theme,
      usa,
      zoomState.end,
      zoomState.start,
    ],
  );

  return (
    <div
      className="relative rounded-[30px] p-4 sm:p-6"
      style={{
        background: "var(--chart-panel-bg)",
        boxShadow: "var(--chart-panel-shadow)",
      }}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Base year = 1990
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Log scale
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
            Drag to pan, wheel to zoom
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setZoomState({ start: 0, end: 100 })}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
          >
            Fit all
          </button>
          <button
            type="button"
            onClick={() => setZoomState(rangeFromYears(data, 20))}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
          >
            Last 20Y
          </button>
          <button
            type="button"
            onClick={() => setZoomState(rangeFromYears(data, 10))}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
          >
            Last 10Y
          </button>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/8 bg-black/10 p-2">
        <ReactECharts
          ref={chartRef}
          option={option}
          notMerge
          lazyUpdate
          opts={{ renderer: "canvas" }}
          onEvents={{
            datazoom: (event: unknown) => {
              const nextZoom = extractZoomState(event);
              if (nextZoom) {
                setZoomState(nextZoom);
              }
            },
          }}
          style={{ height: 460, width: "100%" }}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-3 text-xs">
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-200">
          India
        </span>
        <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-sky-200">
          USA
        </span>
        <span className="rounded-full border border-pink-400/20 bg-pink-400/10 px-3 py-1 text-pink-200">
          China
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Visible span</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {indiaSummary.years}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            The chart now follows the same fit-all and pan/zoom model as the
            main market explorer.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">India CAGR</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatPercent(indiaSummary.cagr, 1)}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Annualized multiple expansion inside the current viewport.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">India total move</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {indiaSummary.totalMove != null && indiaSummary.totalMove >= 0
              ? "+"
              : ""}
            {formatPercent(indiaSummary.totalMove, 0)}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            This range is now easier to inspect because the whole dataset is
            available without horizontal scrolling.
          </p>
        </div>
      </div>
    </div>
  );
}
