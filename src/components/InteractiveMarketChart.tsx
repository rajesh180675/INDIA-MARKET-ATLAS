import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type {
  CrashEvent,
  MarketPoint,
  Milestone,
  Regime,
} from "../data/indiaMarketData";
import useDocumentTheme from "../hooks/useDocumentTheme";
import {
  aggregateCandles,
  buildDrawdown,
  buildMacd,
  buildMonthlyCandles,
  buildRsi,
  buildSma,
  buildVolatility,
  bucketSizeForTimeframe,
  clamp,
  type ChartMode,
  formatNumber,
  formatPercent,
  parseRegimeYears,
  rangeBoundsByYear,
  rangeFilters,
  summarizeSeries,
  type TechnicalPane,
  type TimeframeKey,
  zoomWindowFromPercent,
} from "../charts/marketChartUtils";

type Annotation = {
  year: number;
  title: string;
  detail: string;
};

type Props = {
  data: MarketPoint[];
  milestones: Milestone[];
  crashEvents: CrashEvent[];
  regimes: Regime[];
  annotations: Annotation[];
};

type ZoomState = {
  start: number;
  end: number;
};

function usePalette(theme: "dark" | "light") {
  return useMemo(
    () =>
      theme === "light"
        ? {
            text: "#0f172a",
            muted: "#475569",
            subtle: "#64748b",
            grid: "rgba(15, 23, 42, 0.08)",
            gridStrong: "rgba(15, 23, 42, 0.14)",
            axis: "#475569",
            panel: "#ffffff",
            panelBorder: "rgba(15, 23, 42, 0.08)",
            line: "#0f172a",
            areaTop: "rgba(14, 165, 233, 0.34)",
            areaBottom: "rgba(14, 165, 233, 0.04)",
            drawdown: "rgba(249, 115, 22, 0.16)",
            drawdownLine: "#f97316",
            bull: "#0f766e",
            bear: "#dc2626",
            ma20: "#ea580c",
            ma50: "#0284c7",
            ma200: "#059669",
            crash: "#e11d48",
            milestone: "#7c3aed",
            overlayFill: "rgba(124, 58, 237, 0.08)",
            sliderBg: "rgba(15, 23, 42, 0.04)",
            sliderFill: "rgba(14, 165, 233, 0.12)",
            shadow: "#f8fafc",
          }
        : {
            text: "#f8fafc",
            muted: "#cbd5e1",
            subtle: "#94a3b8",
            grid: "rgba(255, 255, 255, 0.08)",
            gridStrong: "rgba(255, 255, 255, 0.15)",
            axis: "#cbd5e1",
            panel: "#020617",
            panelBorder: "rgba(255, 255, 255, 0.08)",
            line: "#e2e8f0",
            areaTop: "rgba(56, 189, 248, 0.34)",
            areaBottom: "rgba(56, 189, 248, 0.04)",
            drawdown: "rgba(251, 146, 60, 0.16)",
            drawdownLine: "#fb923c",
            bull: "#34d399",
            bear: "#fb7185",
            ma20: "#f59e0b",
            ma50: "#38bdf8",
            ma200: "#34d399",
            crash: "#fb7185",
            milestone: "#c084fc",
            overlayFill: "rgba(192, 132, 252, 0.08)",
            sliderBg: "rgba(255, 255, 255, 0.03)",
            sliderFill: "rgba(56, 189, 248, 0.14)",
            shadow: "#020617",
          },
    [theme],
  );
}

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

function downloadDataUrl(filename: string, dataUrl: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default function InteractiveMarketChart({
  data,
  milestones,
  crashEvents,
  regimes,
  annotations,
}: Props) {
  const theme = useDocumentTheme();
  const palette = usePalette(theme);
  const chartRef = useRef<ReactECharts | null>(null);

  const [mode, setMode] = useState<ChartMode>("technical");
  const [selectedRangeKey, setSelectedRangeKey] = useState("all");
  const [compareRangeKey, setCompareRangeKey] = useState("reform");
  const [compareMode, setCompareMode] = useState(false);
  const [timeframe, setTimeframe] = useState<TimeframeKey>("quarter");
  const [technicalPane, setTechnicalPane] = useState<TechnicalPane>("rsi");
  const [zoomState, setZoomState] = useState<ZoomState>({ start: 0, end: 100 });
  const [showVolume, setShowVolume] = useState(true);
  const [showMilestones, setShowMilestones] = useState(true);
  const [showCrashes, setShowCrashes] = useState(true);
  const [showMA20, setShowMA20] = useState(true);
  const [showMA50, setShowMA50] = useState(true);
  const [showMA200, setShowMA200] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const selectedRange =
    rangeFilters.find((filter) => filter.key === selectedRangeKey) ??
    rangeFilters[0];
  const compareRange =
    rangeFilters.find((filter) => filter.key === compareRangeKey) ??
    rangeFilters[2] ??
    rangeFilters[0];

  useEffect(() => {
    setZoomState({ start: 0, end: 100 });
  }, [mode, selectedRangeKey, timeframe]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isFullscreen]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const filteredYearly = useMemo(
    () =>
      data.filter(
        (point) =>
          point.year >= selectedRange.start && point.year <= selectedRange.end,
      ),
    [data, selectedRange.end, selectedRange.start],
  );

  const compareYearly = useMemo(
    () =>
      data.filter(
        (point) =>
          point.year >= compareRange.start && point.year <= compareRange.end,
      ),
    [compareRange.end, compareRange.start, data],
  );

  const yearlyYears = filteredYearly.map((point) => point.year);
  const yearlyLabels = yearlyYears.map(String);
  const yearlyValues = filteredYearly.map((point) => point.value);
  const yearlyDrawdown = buildDrawdown(yearlyValues);
  const yearlyVolatility = buildVolatility(
    yearlyValues,
    Math.min(10, Math.max(3, Math.floor(yearlyValues.length / 4))),
  );
  const yearlyYoy = yearlyValues.map((value, index) =>
    index === 0
      ? null
      : (value / Math.max(yearlyValues[index - 1], 1) - 1) * 100,
  );

  const longWindow = zoomWindowFromPercent(
    yearlyValues.length,
    zoomState.start,
    zoomState.end,
  );
  const visibleYearlyValues = yearlyValues.slice(
    longWindow.startIndex,
    longWindow.endIndex + 1,
  );
  const visibleYearlyLabels = yearlyLabels.slice(
    longWindow.startIndex,
    longWindow.endIndex + 1,
  );
  const visibleYearlyYears = yearlyYears.slice(
    longWindow.startIndex,
    longWindow.endIndex + 1,
  );
  const longSummary = summarizeSeries(
    visibleYearlyValues,
    visibleYearlyLabels,
    visibleYearlyYears,
  );
  const compareSummary = summarizeSeries(
    compareYearly.map((point) => point.value),
    compareYearly.map((point) => String(point.year)),
    compareYearly.map((point) => point.year),
  );

  const latestYearPoint =
    filteredYearly[filteredYearly.length - 1] ?? data[data.length - 1];
  const latestYearVolatility =
    yearlyVolatility[yearlyVolatility.length - 1] ?? null;
  const latestYearYoy = yearlyYoy[yearlyYoy.length - 1] ?? null;

  const allTechnicalCandles = useMemo(() => {
    const monthly = buildMonthlyCandles(data, crashEvents);
    return aggregateCandles(monthly, bucketSizeForTimeframe(timeframe));
  }, [crashEvents, data, timeframe]);

  const allTechLabels = allTechnicalCandles.map((candle) => candle.label);
  const allTechYears = allTechnicalCandles.map((candle) => candle.year);
  const allTechCloses = allTechnicalCandles.map((candle) => candle.close);
  const allTechVolumes = allTechnicalCandles.map((candle) => candle.volume);
  const allMa20 = buildSma(allTechCloses, 20);
  const allMa50 = buildSma(allTechCloses, 50);
  const allMa200 = buildSma(allTechCloses, 200);
  const allRsi14 = buildRsi(allTechCloses, 14);
  const allMacd = buildMacd(allTechCloses);
  const allTechDrawdown = buildDrawdown(allTechCloses);
  const technicalRangeBounds = rangeBoundsByYear(
    allTechnicalCandles,
    selectedRange.start,
    selectedRange.end,
  );
  const technicalCandles = allTechnicalCandles.slice(
    technicalRangeBounds.startIndex,
    technicalRangeBounds.endIndex + 1,
  );
  const techLabels = allTechLabels.slice(
    technicalRangeBounds.startIndex,
    technicalRangeBounds.endIndex + 1,
  );
  const techYears = allTechYears.slice(
    technicalRangeBounds.startIndex,
    technicalRangeBounds.endIndex + 1,
  );
  const techCloses = allTechCloses.slice(
    technicalRangeBounds.startIndex,
    technicalRangeBounds.endIndex + 1,
  );
  const techVolumes = allTechVolumes.slice(
    technicalRangeBounds.startIndex,
    technicalRangeBounds.endIndex + 1,
  );
  const ma20 = allMa20.slice(
    technicalRangeBounds.startIndex,
    technicalRangeBounds.endIndex + 1,
  );
  const ma50 = allMa50.slice(
    technicalRangeBounds.startIndex,
    technicalRangeBounds.endIndex + 1,
  );
  const ma200 = allMa200.slice(
    technicalRangeBounds.startIndex,
    technicalRangeBounds.endIndex + 1,
  );
  const rsi14 = allRsi14.slice(
    technicalRangeBounds.startIndex,
    technicalRangeBounds.endIndex + 1,
  );
  const macd = {
    macd: allMacd.macd.slice(
      technicalRangeBounds.startIndex,
      technicalRangeBounds.endIndex + 1,
    ),
    signal: allMacd.signal.slice(
      technicalRangeBounds.startIndex,
      technicalRangeBounds.endIndex + 1,
    ),
    histogram: allMacd.histogram.slice(
      technicalRangeBounds.startIndex,
      technicalRangeBounds.endIndex + 1,
    ),
  };
  const techDrawdown = allTechDrawdown.slice(
    technicalRangeBounds.startIndex,
    technicalRangeBounds.endIndex + 1,
  );
  const techWindow = zoomWindowFromPercent(
    techCloses.length,
    zoomState.start,
    zoomState.end,
  );
  const visibleTechCloses = techCloses.slice(
    techWindow.startIndex,
    techWindow.endIndex + 1,
  );
  const visibleTechLabels = techLabels.slice(
    techWindow.startIndex,
    techWindow.endIndex + 1,
  );
  const visibleTechYears = techYears.slice(
    techWindow.startIndex,
    techWindow.endIndex + 1,
  );
  const technicalSummary = summarizeSeries(
    visibleTechCloses,
    visibleTechLabels,
    visibleTechYears,
  );

  const latestCandle = technicalCandles[technicalCandles.length - 1] ?? null;
  const latestRsi = rsi14[rsi14.length - 1] ?? null;
  const latestMacdHistogram = macd.histogram[macd.histogram.length - 1] ?? null;
  const latestPriceVsMa200 =
    latestCandle && ma200[ma200.length - 1] != null
      ? (latestCandle.close / Number(ma200[ma200.length - 1]) - 1) * 100
      : null;

  const longMilestones = milestones
    .filter(
      (item) =>
        item.year >= selectedRange.start && item.year <= selectedRange.end,
    )
    .map((item) => ({
      name: item.label,
      value: [String(item.year), item.value],
      label: { show: false },
      itemStyle: { color: palette.milestone },
      detail: item.detail,
    }));

  const longCrashes = crashEvents
    .filter(
      (event) =>
        event.year >= selectedRange.start && event.year <= selectedRange.end,
    )
    .map((event) => {
      const matching = filteredYearly.find(
        (point) => point.year === event.year,
      );
      if (!matching) {
        return null;
      }

      return {
        name: event.name,
        value: [String(event.year), matching.value],
        itemStyle: { color: palette.crash },
        detail: event.note,
        decline: event.decline,
      };
    })
    .filter(Boolean);

  const longRegimeAreas = regimes
    .map((regime) => {
      const { start, end } = parseRegimeYears(regime.years);
      if (start > selectedRange.end || end < selectedRange.start) {
        return null;
      }

      return [
        {
          name: regime.name,
          xAxis: String(Math.max(start, selectedRange.start)),
          itemStyle: { color: palette.overlayFill },
        },
        {
          xAxis: String(Math.min(end, selectedRange.end)),
        },
      ];
    })
    .filter(Boolean);

  const technicalMilestones = milestones
    .filter(
      (item) =>
        item.year >= selectedRange.start && item.year <= selectedRange.end,
    )
    .map((item) => {
      const candleIndex = technicalCandles.findIndex(
        (candle) => candle.year === item.year,
      );
      if (candleIndex === -1) {
        return null;
      }

      return {
        name: item.label,
        value: [techLabels[candleIndex], technicalCandles[candleIndex].close],
        itemStyle: { color: palette.milestone },
        detail: item.detail,
      };
    })
    .filter(Boolean);

  const technicalCrashes = crashEvents
    .filter(
      (event) =>
        event.year >= selectedRange.start && event.year <= selectedRange.end,
    )
    .map((event) => {
      const candleIndex = technicalCandles.findIndex(
        (candle) => candle.year === event.year,
      );
      if (candleIndex === -1) {
        return null;
      }

      return {
        name: event.name,
        value: [techLabels[candleIndex], technicalCandles[candleIndex].low],
        itemStyle: { color: palette.crash },
        detail: event.note,
        decline: event.decline,
      };
    })
    .filter(Boolean);

  const baseChartOption = useMemo(() => {
    const backgroundColor = "transparent";

    if (mode === "long") {
      return {
        backgroundColor,
        animationDuration: 450,
        textStyle: { color: palette.text, fontFamily: "inherit" },
        grid: [
          { left: 58, right: 24, top: 26, height: "60%" },
          { left: 58, right: 24, top: "76%", height: "12%" },
        ],
        axisPointer: {
          link: [{ xAxisIndex: [0, 1] }],
          lineStyle: { color: palette.gridStrong, width: 1.1 },
          label: { backgroundColor: palette.shadow, color: palette.text },
        },
        tooltip: {
          trigger: "axis",
          backgroundColor:
            theme === "dark" ? "rgba(2,6,23,0.96)" : "rgba(255,255,255,0.98)",
          borderColor: palette.panelBorder,
          textStyle: { color: palette.text },
          extraCssText:
            "box-shadow: 0 16px 44px rgba(15,23,42,0.18); border-radius: 16px;",
          formatter: (params) => {
            const series = Array.isArray(params) ? params : [params];
            const axisValue =
              series[0] &&
              typeof series[0] === "object" &&
              "axisValue" in series[0]
                ? (series[0] as { axisValue?: string | number }).axisValue
                : "—";
            const year = String(axisValue ?? "—");
            const point = filteredYearly.find(
              (item) => String(item.year) === year,
            );
            const milestone = milestones.find(
              (item) => item.year === point?.year,
            );
            const crash = crashEvents.find((item) => item.year === point?.year);
            const annotation = annotations.find(
              (item) => item.year === point?.year,
            );
            const drawdownIndex = filteredYearly.findIndex(
              (item) => item.year === point?.year,
            );
            const drawdown =
              drawdownIndex >= 0 ? yearlyDrawdown[drawdownIndex] : null;
            const yoy = drawdownIndex >= 0 ? yearlyYoy[drawdownIndex] : null;
            const note =
              milestone?.detail ??
              crash?.note ??
              annotation?.detail ??
              selectedRange.note;

            return [
              `<div style="min-width:240px">`,
              `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">`,
              `<strong style="font-size:14px">${year}</strong>`,
              `<span style="font-size:12px;color:${palette.subtle}">${milestone?.label ?? crash?.name ?? annotation?.title ?? "Annual index"}</span>`,
              `</div>`,
              `<div style="display:grid;grid-template-columns:1fr auto;gap:6px 12px;font-size:12px">`,
              `<span style="color:${palette.subtle}">Index</span><strong>${formatNumber(point?.value)}</strong>`,
              `<span style="color:${palette.subtle}">YoY</span><strong>${yoy == null ? "—" : `${yoy >= 0 ? "+" : ""}${formatPercent(yoy, 1)}`}</strong>`,
              `<span style="color:${palette.subtle}">Drawdown</span><strong>${formatPercent(drawdown, 1)}</strong>`,
              `</div>`,
              `<div style="margin-top:10px;font-size:12px;line-height:1.6;color:${palette.muted}">${note}</div>`,
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
        dataZoom: [
          {
            type: "inside",
            xAxisIndex: [0, 1],
            filterMode: "none",
            start: zoomState.start,
            end: zoomState.end,
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
          },
          {
            type: "slider",
            xAxisIndex: [0, 1],
            filterMode: "none",
            height: 28,
            bottom: 12,
            borderColor: palette.panelBorder,
            fillerColor: palette.sliderFill,
            backgroundColor: palette.sliderBg,
            handleStyle: { color: palette.line, borderColor: palette.panel },
            textStyle: { color: palette.subtle },
            start: zoomState.start,
            end: zoomState.end,
          },
        ],
        xAxis: [
          {
            type: "category",
            boundaryGap: false,
            data: yearlyLabels,
            axisLine: { lineStyle: { color: palette.gridStrong } },
            axisLabel: { color: palette.axis },
            axisTick: { show: false },
            splitLine: { show: false },
          },
          {
            type: "category",
            gridIndex: 1,
            boundaryGap: false,
            data: yearlyLabels,
            axisLine: { lineStyle: { color: palette.gridStrong } },
            axisLabel: { color: palette.axis, show: false },
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
              color: palette.axis,
              formatter: (value: number) => formatNumber(value),
            },
            splitLine: { lineStyle: { color: palette.grid } },
          },
          {
            type: "value",
            gridIndex: 1,
            min: Math.min(...yearlyDrawdown, -5),
            max: 0,
            axisLine: { show: false },
            axisLabel: {
              color: palette.axis,
              formatter: (value: number) => `${value.toFixed(0)}%`,
            },
            splitLine: { lineStyle: { color: palette.grid } },
          },
        ],
        series: [
          {
            name: "Normalized index",
            type: "line",
            smooth: 0.22,
            showSymbol: false,
            lineStyle: { color: palette.line, width: 2.8 },
            areaStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: palette.areaTop },
                  { offset: 1, color: palette.areaBottom },
                ],
              },
            },
            emphasis: { focus: "series" },
            markArea: {
              silent: true,
              itemStyle: { borderWidth: 0 },
              label: { color: palette.subtle, fontSize: 11, fontWeight: 600 },
              data: longRegimeAreas as any,
            },
            data: yearlyValues,
          },
          {
            name: "Milestones",
            type: "scatter",
            symbolSize: 10,
            data: showMilestones ? longMilestones : [],
            tooltip: {
              formatter: (point: {
                data?: {
                  name?: string;
                  detail?: string;
                  value?: [string, number];
                };
              }) => {
                const datum = point.data as {
                  name?: string;
                  detail?: string;
                  value?: [string, number];
                };
                return `<strong>${datum.name ?? "Milestone"}</strong><div style="margin-top:6px;font-size:12px;line-height:1.6">${datum.detail ?? ""}</div>`;
              },
            },
          },
          {
            name: "Crash markers",
            type: "scatter",
            symbol: "diamond",
            symbolSize: 14,
            data: showCrashes ? longCrashes : [],
            label: {
              show: showCrashes,
              formatter: (params: { data?: { decline?: number } }) =>
                params.data?.decline == null ? "" : `${params.data.decline}%`,
              position: "top",
              color: palette.crash,
              fontWeight: 700,
              fontSize: 11,
            },
            tooltip: {
              formatter: (point: {
                data?: { name?: string; detail?: string; decline?: number };
              }) => {
                const datum = point.data as {
                  name?: string;
                  detail?: string;
                  decline?: number;
                };
                return `<strong>${datum.name ?? "Crash"}</strong><div style="margin-top:6px;font-size:12px;line-height:1.6">${datum.decline ?? ""}% drawdown. ${datum.detail ?? ""}</div>`;
              },
            },
          },
          {
            name: "Drawdown",
            type: "line",
            xAxisIndex: 1,
            yAxisIndex: 1,
            smooth: 0.18,
            showSymbol: false,
            lineStyle: { color: palette.drawdownLine, width: 2 },
            areaStyle: { color: palette.drawdown },
            data: yearlyDrawdown,
          },
        ],
      };
    }

    const paneHeight = showVolume ? "16%" : "0%";
    const thirdTop = showVolume ? "74%" : "66%";
    const firstHeight = showVolume ? "46%" : "56%";
    const candleData = technicalCandles.map((candle) => [
      candle.open,
      candle.close,
      candle.low,
      candle.high,
    ]);
    const volumeData = techVolumes.map((volume, index) => ({
      value: volume,
      itemStyle: {
        color:
          candleData[index][1] >= candleData[index][0]
            ? palette.bull
            : palette.bear,
        opacity: 0.42,
      },
    }));

    return {
      backgroundColor,
      animationDuration: 400,
      textStyle: { color: palette.text, fontFamily: "inherit" },
      legend: {
        top: 0,
        left: 58,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { color: palette.muted },
        selectedMode: false,
        data: [
          "Technical reconstruction",
          ...(showMA20 ? ["MA 20"] : []),
          ...(showMA50 ? ["MA 50"] : []),
          ...(showMA200 ? ["MA 200"] : []),
        ],
      },
      grid: [
        { left: 58, right: 24, top: 52, height: firstHeight },
        {
          left: 58,
          right: 24,
          top: showVolume ? "58%" : "999%",
          height: paneHeight,
        },
        { left: 58, right: 24, top: thirdTop, height: "16%" },
      ],
      axisPointer: {
        link: [{ xAxisIndex: [0, 1, 2] }],
        lineStyle: { color: palette.gridStrong, width: 1.1 },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
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
          const label = String(axisValue ?? "—");
          const index = techLabels.indexOf(label);
          const candle = index >= 0 ? technicalCandles[index] : null;
          const milestone = candle
            ? milestones.find((item) => item.year === candle.year)
            : null;
          const crash = candle
            ? crashEvents.find((item) => item.year === candle.year)
            : null;
          const note =
            milestone?.detail ??
            crash?.note ??
            "Illustrative technical reconstruction derived from annual data.";

          return [
            `<div style="min-width:260px">`,
            `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">`,
            `<strong style="font-size:14px">${label}</strong>`,
            `<span style="font-size:12px;color:${palette.subtle}">${candle ? `${candle.close >= candle.open ? "+" : ""}${formatPercent((candle.close / Math.max(candle.open, 1) - 1) * 100, 1)}` : ""}</span>`,
            `</div>`,
            candle
              ? `<div style="display:grid;grid-template-columns:1fr auto;gap:6px 12px;font-size:12px">
                  <span style="color:${palette.subtle}">Open</span><strong>${formatNumber(candle.open)}</strong>
                  <span style="color:${palette.subtle}">High</span><strong>${formatNumber(candle.high)}</strong>
                  <span style="color:${palette.subtle}">Low</span><strong>${formatNumber(candle.low)}</strong>
                  <span style="color:${palette.subtle}">Close</span><strong>${formatNumber(candle.close)}</strong>
                  <span style="color:${palette.subtle}">MA20</span><strong>${formatNumber(ma20[index])}</strong>
                  <span style="color:${palette.subtle}">MA50</span><strong>${formatNumber(ma50[index])}</strong>
                  <span style="color:${palette.subtle}">MA200</span><strong>${formatNumber(ma200[index])}</strong>
                  <span style="color:${palette.subtle}">${technicalPane === "rsi" ? "RSI 14" : "MACD hist"}</span>
                  <strong>${technicalPane === "rsi" ? formatNumber(rsi14[index], 1) : formatNumber(macd.histogram[index], 1)}</strong>
                </div>`
              : "",
            `<div style="margin-top:10px;font-size:12px;line-height:1.6;color:${palette.muted}">${note}</div>`,
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
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: [0, 1, 2],
          filterMode: "none",
          start: zoomState.start,
          end: zoomState.end,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
        },
        {
          type: "slider",
          xAxisIndex: [0, 1, 2],
          filterMode: "none",
          height: 28,
          bottom: 12,
          borderColor: palette.panelBorder,
          fillerColor: palette.sliderFill,
          backgroundColor: palette.sliderBg,
          handleStyle: { color: palette.line, borderColor: palette.panel },
          textStyle: { color: palette.subtle },
          start: zoomState.start,
          end: zoomState.end,
        },
      ],
      xAxis: [
        {
          type: "category",
          data: techLabels,
          scale: true,
          boundaryGap: true,
          axisLine: { lineStyle: { color: palette.gridStrong } },
          axisLabel: { color: palette.axis, hideOverlap: true },
          splitLine: { show: false },
          min: "dataMin",
          max: "dataMax",
        },
        {
          type: "category",
          gridIndex: 1,
          data: techLabels,
          axisLine: { lineStyle: { color: palette.gridStrong } },
          axisLabel: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          show: showVolume,
        },
        {
          type: "category",
          gridIndex: 2,
          data: techLabels,
          axisLine: { lineStyle: { color: palette.gridStrong } },
          axisLabel: { color: palette.axis, hideOverlap: true },
          splitLine: { show: false },
        },
      ],
      yAxis: [
        {
          type: "log",
          scale: true,
          axisLine: { show: false },
          axisLabel: {
            color: palette.axis,
            formatter: (value: number) => formatNumber(value),
          },
          splitLine: { lineStyle: { color: palette.grid } },
        },
        {
          type: "value",
          gridIndex: 1,
          axisLine: { show: false },
          axisLabel: {
            color: palette.axis,
            formatter: (value: number) => formatNumber(value),
          },
          splitLine: { show: false },
          show: showVolume,
        },
        {
          type: "value",
          gridIndex: 2,
          min: technicalPane === "rsi" ? 0 : "dataMin",
          max: technicalPane === "rsi" ? 100 : "dataMax",
          axisLine: { show: false },
          axisLabel: {
            color: palette.axis,
            formatter: (value: number) =>
              technicalPane === "rsi"
                ? value.toFixed(0)
                : formatNumber(value, 1),
          },
          splitLine: { lineStyle: { color: palette.grid } },
        },
      ],
      series: [
        {
          name: "Technical reconstruction",
          type: "candlestick",
          z: 2,
          data: candleData,
          itemStyle: {
            color: palette.bull,
            color0: palette.bear,
            borderColor: palette.bull,
            borderColor0: palette.bear,
          },
        },
        ...(showMA20
          ? [
              {
                name: "MA 20",
                type: "line",
                showSymbol: false,
                z: 4,
                smooth: true,
                connectNulls: false,
                lineStyle: { width: 2.2, color: palette.ma20 },
                data: ma20,
              },
            ]
          : []),
        ...(showMA50
          ? [
              {
                name: "MA 50",
                type: "line",
                showSymbol: false,
                z: 4,
                smooth: true,
                connectNulls: false,
                lineStyle: { width: 2.2, color: palette.ma50 },
                data: ma50,
              },
            ]
          : []),
        ...(showMA200
          ? [
              {
                name: "MA 200",
                type: "line",
                showSymbol: false,
                z: 4,
                smooth: true,
                connectNulls: false,
                lineStyle: { width: 2.4, color: palette.ma200 },
                data: ma200,
              },
            ]
          : []),
        ...(showMilestones
          ? [
              {
                name: "Milestones",
                type: "scatter",
                symbolSize: 10,
                data: technicalMilestones,
                tooltip: {
                  formatter: (point: {
                    data?: { name?: string; detail?: string };
                  }) => {
                    const datum = point.data as {
                      name?: string;
                      detail?: string;
                    };
                    return `<strong>${datum.name ?? "Milestone"}</strong><div style="margin-top:6px;font-size:12px;line-height:1.6">${datum.detail ?? ""}</div>`;
                  },
                },
              },
            ]
          : []),
        ...(showCrashes
          ? [
              {
                name: "Crashes",
                type: "scatter",
                symbol: "diamond",
                symbolSize: 14,
                data: technicalCrashes,
                label: {
                  show: true,
                  formatter: (params: { data?: { decline?: number } }) =>
                    params.data?.decline == null
                      ? ""
                      : `${params.data.decline}%`,
                  position: "top",
                  color: palette.crash,
                  fontWeight: 700,
                  fontSize: 11,
                },
                tooltip: {
                  formatter: (point: {
                    data?: { name?: string; detail?: string; decline?: number };
                  }) => {
                    const datum = point.data as {
                      name?: string;
                      detail?: string;
                      decline?: number;
                    };
                    return `<strong>${datum.name ?? "Crash"}</strong><div style="margin-top:6px;font-size:12px;line-height:1.6">${datum.decline ?? ""}% drawdown. ${datum.detail ?? ""}</div>`;
                  },
                },
              },
            ]
          : []),
        ...(showVolume
          ? [
              {
                name: "Volume",
                type: "bar",
                xAxisIndex: 1,
                yAxisIndex: 1,
                barWidth: "64%",
                data: volumeData,
              },
            ]
          : []),
        ...(technicalPane === "rsi"
          ? [
              {
                name: "RSI 14",
                type: "line",
                xAxisIndex: 2,
                yAxisIndex: 2,
                showSymbol: false,
                smooth: true,
                lineStyle: { width: 1.8, color: palette.ma20 },
                markLine: {
                  silent: true,
                  symbol: "none",
                  lineStyle: { color: palette.gridStrong, type: "dashed" },
                  data: [{ yAxis: 30 }, { yAxis: 50 }, { yAxis: 70 }],
                },
                data: rsi14,
              },
            ]
          : [
              {
                name: "MACD histogram",
                type: "bar",
                xAxisIndex: 2,
                yAxisIndex: 2,
                data: macd.histogram.map((value) => ({
                  value,
                  itemStyle: {
                    color: (value ?? 0) >= 0 ? palette.bull : palette.bear,
                    opacity: 0.56,
                  },
                })),
              },
              {
                name: "MACD",
                type: "line",
                xAxisIndex: 2,
                yAxisIndex: 2,
                showSymbol: false,
                smooth: true,
                lineStyle: { width: 1.6, color: palette.ma50 },
                data: macd.macd,
              },
              {
                name: "Signal",
                type: "line",
                xAxisIndex: 2,
                yAxisIndex: 2,
                showSymbol: false,
                smooth: true,
                lineStyle: { width: 1.6, color: palette.ma20, type: "dashed" },
                data: macd.signal,
              },
            ]),
      ],
    };
  }, [
    annotations,
    compareMode,
    crashEvents,
    filteredYearly,
    longCrashes,
    longMilestones,
    longRegimeAreas,
    ma20,
    ma50,
    ma200,
    macd,
    milestones,
    mode,
    palette,
    rsi14,
    selectedRange.note,
    selectedRange.end,
    selectedRange.start,
    showCrashes,
    showMA20,
    showMA50,
    showMA200,
    showMilestones,
    showVolume,
    techLabels,
    techVolumes,
    technicalCandles,
    technicalCrashes,
    technicalMilestones,
    technicalPane,
    theme,
    yearlyDrawdown,
    yearlyLabels,
    yearlyValues,
    yearlyYoy,
    zoomState.end,
    zoomState.start,
  ]) as EChartsOption;

  const onChartEvents = useMemo(
    () => ({
      datazoom: (event: unknown) => {
        const nextZoom = extractZoomState(event);
        if (nextZoom) {
          setZoomState(nextZoom);
        }
      },
    }),
    [],
  );

  const applyTrailingYears = (years: number) => {
    const domainLength =
      mode === "long" ? filteredYearly.length : technicalCandles.length;
    if (domainLength <= 1) {
      setZoomState({ start: 0, end: 100 });
      return;
    }

    const selectedYears =
      mode === "long"
        ? filteredYearly
        : technicalCandles.map((candle) => ({ year: candle.year }));
    const lastYear =
      selectedYears[selectedYears.length - 1]?.year ?? selectedRange.end;
    const startYear = lastYear - years + 1;
    const firstIndex = selectedYears.findIndex(
      (point) => point.year >= startYear,
    );
    if (firstIndex <= 0) {
      setZoomState({ start: 0, end: 100 });
      return;
    }

    const lastIndex = domainLength - 1;
    setZoomState({
      start: (firstIndex / lastIndex) * 100,
      end: 100,
    });
  };

  const exportChartPng = () => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) {
      return;
    }

    downloadDataUrl(
      `india-market-${mode}-${selectedRange.key}.png`,
      instance.getDataURL({
        pixelRatio: 2,
        backgroundColor: palette.panel,
      }),
    );
  };

  const summary = mode === "long" ? longSummary : technicalSummary;
  const activeVolatility =
    mode === "long"
      ? latestYearVolatility
      : (buildVolatility(techCloses, 20).at(-1) ?? null);
  const activeDrawdown =
    mode === "long"
      ? (yearlyDrawdown.at(-1) ?? null)
      : (techDrawdown.at(-1) ?? null);
  const activeNote =
    mode === "long"
      ? "Structural long-horizon context using annual normalized index data."
      : "Primary candlestick desk built from reconstructed monthly bars, with indicators computed on the full history before range filtering.";
  const chartHeight = isFullscreen
    ? "calc(100vh - 210px)"
    : mode === "technical"
      ? 760
      : 660;
  const movingAverageCards = [
    {
      label: "MA 20",
      active: showMA20,
      color: palette.ma20,
      value: ma20[ma20.length - 1],
    },
    {
      label: "MA 50",
      active: showMA50,
      color: palette.ma50,
      value: ma50[ma50.length - 1],
    },
    {
      label: "MA 200",
      active: showMA200,
      color: palette.ma200,
      value: ma200[ma200.length - 1],
    },
  ];

  return (
    <div
      data-testid="main-market-chart"
      className="relative overflow-hidden rounded-[32px] p-4 sm:p-6"
      style={{
        background: "var(--chart-panel-bg)",
        boxShadow: "var(--chart-panel-shadow)",
      }}
    >
      {isFullscreen ? (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/75 backdrop-blur-md"
          onClick={() => setIsFullscreen(false)}
        />
      ) : null}

      <div
        className={
          isFullscreen
            ? "fixed inset-3 z-[80] overflow-y-auto rounded-[32px] border border-white/10 p-4 sm:inset-4 sm:p-6"
            : "relative"
        }
        style={
          isFullscreen
            ? {
                background: "var(--chart-panel-bg)",
                boxShadow: "var(--chart-panel-shadow)",
              }
            : undefined
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">
                Market explorer
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                Professional candlestick desk with expand-to-window review and
                full-history context
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsFullscreen((current) => !current)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10"
              >
                {isFullscreen ? "Collapse window" : "Expand to window"}
              </button>
              <button
                type="button"
                onClick={exportChartPng}
                className="rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-400/15"
              >
                Export PNG
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("technical")}
              className={
                mode === "technical"
                  ? "rounded-full border border-fuchsia-400/35 bg-fuchsia-400/12 px-3 py-1.5 text-sm font-medium text-fuchsia-200"
                  : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/10"
              }
            >
              Candlestick Desk
            </button>
            <button
              type="button"
              onClick={() => setMode("long")}
              className={
                mode === "long"
                  ? "rounded-full border border-emerald-400/35 bg-emerald-400/12 px-3 py-1.5 text-sm font-medium text-emerald-200"
                  : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/10"
              }
            >
              Long Horizon Context
            </button>
            <button
              type="button"
              onClick={() => setCompareMode((current) => !current)}
              className={
                compareMode
                  ? "rounded-full border border-amber-400/35 bg-amber-400/12 px-3 py-1.5 text-sm font-medium text-amber-200"
                  : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/10"
              }
            >
              {compareMode ? "Compare on" : "Compare off"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {rangeFilters.map((filter) => {
              const active = filter.key === selectedRangeKey;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setSelectedRangeKey(filter.key)}
                  className={
                    active
                      ? "rounded-full border border-sky-400/30 bg-sky-400/12 px-3 py-1.5 text-xs font-medium text-sky-200"
                      : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
                  }
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              Quick view
            </span>
            <button
              type="button"
              onClick={() => setZoomState({ start: 0, end: 100 })}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
            >
              Fit all
            </button>
            <button
              type="button"
              onClick={() => applyTrailingYears(20)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
            >
              Last 20Y
            </button>
            <button
              type="button"
              onClick={() => applyTrailingYears(10)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
            >
              Last 10Y
            </button>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
              Wheel to zoom, drag to pan, pinch on touch
            </span>
          </div>

          {mode === "technical" ? (
            <div className="space-y-3 rounded-[24px] border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap gap-2">
                {(["month", "quarter", "year"] as TimeframeKey[]).map(
                  (option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setTimeframe(option)}
                      className={
                        timeframe === option
                          ? "rounded-full border border-fuchsia-400/35 bg-fuchsia-400/12 px-3 py-1.5 text-xs font-medium text-fuchsia-200"
                          : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
                      }
                    >
                      {option === "month"
                        ? "Monthly"
                        : option === "quarter"
                          ? "Quarterly"
                          : "Yearly"}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  onClick={() => setTechnicalPane("rsi")}
                  className={
                    technicalPane === "rsi"
                      ? "rounded-full border border-amber-400/35 bg-amber-400/12 px-3 py-1.5 text-xs font-medium text-amber-200"
                      : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
                  }
                >
                  RSI pane
                </button>
                <button
                  type="button"
                  onClick={() => setTechnicalPane("macd")}
                  className={
                    technicalPane === "macd"
                      ? "rounded-full border border-amber-400/35 bg-amber-400/12 px-3 py-1.5 text-xs font-medium text-amber-200"
                      : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
                  }
                >
                  MACD pane
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    label: "MA 20",
                    active: showMA20,
                    toggle: () => setShowMA20((current) => !current),
                  },
                  {
                    label: "MA 50",
                    active: showMA50,
                    toggle: () => setShowMA50((current) => !current),
                  },
                  {
                    label: "MA 200",
                    active: showMA200,
                    toggle: () => setShowMA200((current) => !current),
                  },
                  {
                    label: "Volume",
                    active: showVolume,
                    toggle: () => setShowVolume((current) => !current),
                  },
                  {
                    label: "Milestones",
                    active: showMilestones,
                    toggle: () => setShowMilestones((current) => !current),
                  },
                  {
                    label: "Crashes",
                    active: showCrashes,
                    toggle: () => setShowCrashes((current) => !current),
                  },
                ].map((overlay) => (
                  <button
                    key={overlay.label}
                    type="button"
                    onClick={overlay.toggle}
                    className={
                      overlay.active
                        ? "rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-200"
                        : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
                    }
                  >
                    {overlay.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {mode === "long"
                  ? "Structural annual context"
                  : "Candlestick-first technical view"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {selectedRange.label}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {mode === "long"
                  ? `${filteredYearly.length} annual points`
                  : `${technicalCandles.length} ${timeframe} candles`}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                Mini-map slider built in
              </span>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                {mode === "long"
                  ? "Why this context view matters"
                  : "Why this trading view works better"}
              </p>
              <p className="mt-2 leading-7">
                {mode === "long"
                  ? "Use this mode to reset to the truthful annual structure, compare regimes, and understand where the current candle window sits in the full compounding story."
                  : "This desk now opens directly in candlesticks, exposes the moving averages clearly, and keeps the full-history indicator calculations intact when you zoom into a shorter era."}
              </p>
            </div>
          </div>

          {mode === "technical" ? (
            <div className="grid gap-3 md:grid-cols-3">
              {movingAverageCards.map((average) => (
                <div
                  key={average.label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-slate-300">{average.label}</p>
                    <span
                      className="inline-flex h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: average.active
                          ? average.color
                          : palette.gridStrong,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {formatNumber(average.value, 0)}
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    {average.active
                      ? "Rendered from full-history calculations and displayed inside the current window."
                      : "Overlay hidden. Toggle it back on above."}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="rounded-[28px] border border-white/8 bg-black/10 p-2">
            <ReactECharts
              ref={chartRef}
              option={baseChartOption}
              notMerge
              lazyUpdate
              opts={{ renderer: "canvas" }}
              onEvents={onChartEvents}
              style={{
                height: chartHeight,
                width: "100%",
              }}
            />
          </div>
        </div>

        {isFullscreen ? (
          <div className="sticky bottom-3 mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100 backdrop-blur"
            >
              Close fullscreen
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Visible window</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {summary.years}
          </p>
          <p className="mt-2 text-sm text-slate-300">{selectedRange.note}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Window CAGR</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatPercent(summary.cagr, 1)}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Annualized move across the current zoom window.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Total move</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {summary.totalMove != null && summary.totalMove >= 0 ? "+" : ""}
            {formatPercent(summary.totalMove, 0)}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            {summary.startLabel} → {summary.endLabel}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Max drawdown</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatPercent(summary.maxDrawdown, 1)}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Worst peak-to-trough move inside the visible window.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">
            {mode === "long"
              ? "Latest YoY move"
              : technicalPane === "rsi"
                ? "Latest RSI 14"
                : "Latest MACD hist"}
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {mode === "long"
              ? `${latestYearYoy != null && latestYearYoy >= 0 ? "+" : ""}${formatPercent(latestYearYoy, 1)}`
              : technicalPane === "rsi"
                ? formatNumber(latestRsi, 1)
                : formatNumber(latestMacdHistogram, 1)}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            {mode === "long"
              ? "Latest annual change in the selected range."
              : `Momentum read from the ${technicalPane.toUpperCase()} pane.`}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">
            {mode === "long" ? "Latest index level" : "Price vs MA 200"}
          </p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {mode === "long"
              ? formatNumber(latestYearPoint?.value)
              : `${latestPriceVsMa200 != null && latestPriceVsMa200 >= 0 ? "+" : ""}${formatPercent(latestPriceVsMa200, 1)}`}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            {mode === "long"
              ? `Latest point in ${selectedRange.label}.`
              : "How stretched the reconstructed close is versus the long trend."}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Drawdown now</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {formatPercent(activeDrawdown, 1)}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Current distance from the visible-window peak.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Volatility lens</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {formatPercent(activeVolatility, 1)}
          </p>
          <p className="mt-2 text-sm text-slate-300">
            {mode === "long"
              ? "Annualized volatility estimate on annual closes."
              : "Annualized volatility estimate on reconstructed candles."}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Interaction model</p>
          <p className="mt-2 text-xl font-semibold text-white">
            Native pan + zoom
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Wheel zoom, touch pinch, drag pan, and fit-all without
            horizontal-scroll hacks.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Integrity note</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {mode === "long" ? "Source-faithful" : "Clearly labeled"}
          </p>
          <p className="mt-2 text-sm text-slate-300">{activeNote}</p>
        </div>
      </div>

      {compareMode ? (
        <div className="mt-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                Compare ranges
              </p>
              <h4 className="mt-1 text-lg font-semibold text-white">
                Use the same lens across different eras
              </h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {rangeFilters.map((filter) => (
                <button
                  key={`compare-${filter.key}`}
                  type="button"
                  disabled={filter.key === selectedRangeKey}
                  onClick={() => setCompareRangeKey(filter.key)}
                  className={
                    filter.key === compareRangeKey
                      ? "rounded-full border border-amber-400/35 bg-amber-400/12 px-3 py-1.5 text-xs font-medium text-amber-200"
                      : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  }
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Primary
              </p>
              <h5 className="mt-2 text-xl font-semibold text-white">
                {selectedRange.label}
              </h5>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/8 bg-white/5 p-3">
                  <p className="text-slate-400">CAGR</p>
                  <p className="mt-1 font-semibold text-white">
                    {formatPercent(summary.cagr, 1)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/5 p-3">
                  <p className="text-slate-400">Total move</p>
                  <p className="mt-1 font-semibold text-white">
                    {formatPercent(summary.totalMove, 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/5 p-3">
                  <p className="text-slate-400">Max drawdown</p>
                  <p className="mt-1 font-semibold text-white">
                    {formatPercent(summary.maxDrawdown, 1)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/5 p-3">
                  <p className="text-slate-400">Span</p>
                  <p className="mt-1 font-semibold text-white">
                    {summary.years}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Comparison
              </p>
              <h5 className="mt-2 text-xl font-semibold text-white">
                {compareRange.label}
              </h5>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-white/8 bg-white/5 p-3">
                  <p className="text-slate-400">CAGR</p>
                  <p className="mt-1 font-semibold text-white">
                    {formatPercent(compareSummary.cagr, 1)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/5 p-3">
                  <p className="text-slate-400">Total move</p>
                  <p className="mt-1 font-semibold text-white">
                    {formatPercent(compareSummary.totalMove, 0)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/5 p-3">
                  <p className="text-slate-400">Max drawdown</p>
                  <p className="mt-1 font-semibold text-white">
                    {formatPercent(compareSummary.maxDrawdown, 1)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/5 p-3">
                  <p className="text-slate-400">Span</p>
                  <p className="mt-1 font-semibold text-white">
                    {compareSummary.years}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-slate-400">Important note</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
          The default chart now opens in a professional candlestick desk with
          visible moving averages and an expand-to-window path. The structural
          long-horizon context is still one click away so the app keeps both
          technical readability and data honesty.
        </p>
      </div>
    </div>
  );
}
