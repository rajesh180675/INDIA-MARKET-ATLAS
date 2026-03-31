import { useEffect, useMemo, useRef, useState } from "react";
import type { CrashEvent, MarketPoint, Milestone, Regime } from "../data/indiaMarketData";

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

type RangeFilter = {
  key: string;
  label: string;
  start: number;
  end: number;
  note: string;
};

type Candle = {
  index: number;
  year: number;
  month: number;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type CrossoverSignal = {
  index: number;
  type: "bullish" | "bearish";
  family: "20/50" | "50/200";
  label: string;
  detail: string;
};

type OverlayKey = "ma20" | "ma50" | "ma100" | "ma200" | "ema20" | "bollinger" | "crashes" | "volume" | "crossovers";
type TimeframeKey = "auto" | "month" | "quarter" | "year";
type ZoomKey = "all" | "50" | "25" | "10";

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pricePanelHeight = 390;
const volumePanelHeight = 88;
const rsiPanelHeight = 112;
const macdPanelHeight = 118;
const panelGap = 28;
const padding = { top: 38, right: 26, bottom: 46, left: 72 };
const navigatorPadding = { left: 14, right: 14, top: 10, bottom: 14 };

const rangeFilters: RangeFilter[] = [
  {
    key: "all",
    label: "Full journey",
    start: 1947,
    end: 2025,
    note: "Full 1947–2025 technical reconstruction using monthly candles derived from the annual normalized index.",
  },
  {
    key: "pre-sensex",
    label: "1947–1979",
    start: 1947,
    end: 1979,
    note: "The suppressed-market era where inflation and policy control dominated price structure.",
  },
  {
    key: "awakening",
    label: "1979–1991",
    start: 1979,
    end: 1991,
    note: "The Sensex awakening, low-base rerating, and pre-liberalization acceleration.",
  },
  {
    key: "reform",
    label: "1991–2003",
    start: 1991,
    end: 2003,
    note: "Liberalization, scams, and global stress in one volatile technical regime.",
  },
  {
    key: "golden-bull",
    label: "2003–2025",
    start: 2003,
    end: 2025,
    note: "The globally integrated, retail-supported, post-2003 compounding phase.",
  },
  {
    key: "modern",
    label: "2014–2025",
    start: 2014,
    end: 2025,
    note: "The modern structural-bull era with stronger domestic participation and deeper market breadth.",
  },
];

const overlayMeta: Array<{ key: OverlayKey; label: string; color: string }> = [
  { key: "ma20", label: "MA 20", color: "#f59e0b" },
  { key: "ma50", label: "MA 50", color: "#38bdf8" },
  { key: "ma100", label: "MA 100", color: "#a78bfa" },
  { key: "ma200", label: "MA 200", color: "#34d399" },
  { key: "ema20", label: "EMA 20", color: "#f97316" },
  { key: "bollinger", label: "Bollinger 20,2", color: "#f472b6" },
  { key: "crashes", label: "Crash markers", color: "#fb7185" },
  { key: "crossovers", label: "Crossovers", color: "#eab308" },
  { key: "volume", label: "Volume", color: "#64748b" },
];

const timeframeOptions: Array<{ key: TimeframeKey; label: string; description: string }> = [
  { key: "auto", label: "Auto density", description: "Adjusts candle density for readability by range length." },
  { key: "month", label: "Monthly", description: "Most detailed view with reconstructed monthly candles." },
  { key: "quarter", label: "Quarterly", description: "Balanced view for long spans and medium-range trend work." },
  { key: "year", label: "Yearly", description: "Best for the full 78-year structural journey." },
];

const zoomOptions: Array<{ key: ZoomKey; label: string; fraction: number }> = [
  { key: "all", label: "100%", fraction: 1 },
  { key: "50", label: "50%", fraction: 0.5 },
  { key: "25", label: "25%", fraction: 0.25 },
  { key: "10", label: "10%", fraction: 0.1 },
];

const regimeFills: Record<Regime["tone"], string> = {
  red: "rgba(244, 63, 94, 0.08)",
  amber: "rgba(245, 158, 11, 0.08)",
  blue: "rgba(56, 189, 248, 0.08)",
  emerald: "rgba(52, 211, 153, 0.08)",
  violet: "rgba(167, 139, 250, 0.08)",
};

const milestoneColors = {
  emerald: "#34d399",
  amber: "#fbbf24",
  rose: "#fb7185",
  blue: "#38bdf8",
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatNumber(value: number | null | undefined, decimals = 0) {
  if (!Number.isFinite(value)) return "—";
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPercent(value: number | null | undefined, decimals = 1) {
  if (!Number.isFinite(value)) return "—";
  return `${Number(value).toFixed(decimals)}%`;
}

function parseRegimeYears(years: string) {
  const [start, end] = years.split("–").map((part) => Number(part.trim()));
  return { start, end };
}

function buildLogGuides(minValue: number, maxValue: number) {
  const guides: number[] = [];
  const minExp = Math.floor(Math.log10(Math.max(minValue, 1)));
  const maxExp = Math.ceil(Math.log10(Math.max(maxValue, 1)));

  for (let exp = minExp; exp <= maxExp; exp += 1) {
    [1, 2, 5].forEach((multiplier) => {
      const value = multiplier * Math.pow(10, exp);
      if (value >= minValue && value <= maxValue) guides.push(value);
    });
  }

  return guides.length > 3 ? guides : [minValue, (minValue + maxValue) / 2, maxValue].filter((value) => Number.isFinite(value));
}

function buildYearTicks(firstYear: number, lastYear: number) {
  const span = lastYear - firstYear;
  const step = span <= 12 ? 1 : span <= 25 ? 2 : span <= 45 ? 5 : 10;
  const ticks = new Set<number>([firstYear, lastYear]);
  let cursor = Math.ceil(firstYear / step) * step;

  while (cursor < lastYear) {
    ticks.add(cursor);
    cursor += step;
  }

  return Array.from(ticks).sort((a, b) => a - b);
}

function buildMonthlyCandles(yearlyData: MarketPoint[], crashEvents: CrashEvent[]) {
  const crashMap = new Map(crashEvents.map((event) => [event.year, event]));
  const candles: Candle[] = [];
  let runningIndex = 0;

  yearlyData.forEach((point, pointIndex) => {
    const previous = yearlyData[pointIndex - 1]?.value ?? point.value * 0.94;
    const current = point.value;
    const annualReturn = current / Math.max(previous, 1) - 1;
    const crash = crashMap.get(point.year);
    const crashBoost = crash ? Math.min(Math.abs(crash.decline) / 100, 0.65) : 0;
    const amplitude = clamp(0.03 + Math.abs(annualReturn) * 0.09 + crashBoost * 0.14, 0.025, 0.18);
    let priorClose = previous;

    for (let month = 0; month < 12; month += 1) {
      const t = (month + 1) / 12;
      const base = Math.exp(Math.log(Math.max(previous, 1)) + (Math.log(Math.max(current, 1)) - Math.log(Math.max(previous, 1))) * t);
      const envelope = month === 11 ? 0 : Math.sin(Math.PI * t);
      const waveSeed = Math.sin((point.year - 1947) * 0.9 + month * 0.75) + Math.cos(month * 0.55 + pointIndex * 0.45);
      const waveFactor = 1 + waveSeed * amplitude * 0.16 * envelope;
      const close = month === 11 ? current : Math.max(1, base * waveFactor);
      const open = Math.max(1, priorClose);
      const wickStretch = amplitude * (0.65 + ((month % 5) + 1) / 10);
      let high = Math.max(open, close) * (1 + wickStretch);
      let low = Math.min(open, close) * (1 - wickStretch * 0.84);

      if (crash && month >= 4 && month <= 8) low *= 1 + crash.decline / 100 * 0.33;
      if (crash && month >= 2 && month <= 5) high *= 1 + Math.abs(crash.decline) / 100 * 0.04;

      high = Math.max(high, open, close);
      low = Math.max(1, Math.min(low, open, close));

      const turnoverBase = Math.sqrt(Math.max(open * close, 1));
      const volatilityBoost = Math.abs(close / Math.max(open, 1) - 1) * 16;
      const volume = Math.round((turnoverBase * 28 + 800) * (1 + volatilityBoost + crashBoost * 1.8));

      candles.push({
        index: runningIndex,
        year: point.year,
        month: month + 1,
        label: `${monthLabels[month]} ${point.year}`,
        open,
        high,
        low,
        close,
        volume,
      });

      priorClose = close;
      runningIndex += 1;
    }
  });

  return candles;
}

function aggregateCandles(candles: Candle[], bucketSize: number) {
  if (bucketSize <= 1) return candles;

  const grouped: Candle[] = [];
  for (let index = 0; index < candles.length; index += bucketSize) {
    const slice = candles.slice(index, index + bucketSize);
    if (slice.length === 0) continue;

    const first = slice[0];
    const last = slice[slice.length - 1];
    const label = bucketSize >= 12 ? `${last.year}` : bucketSize >= 3 ? `Q${Math.ceil(last.month / 3)} ${last.year}` : last.label;

    grouped.push({
      index: grouped.length,
      year: last.year,
      month: last.month,
      label,
      open: first.open,
      high: Math.max(...slice.map((item) => item.high)),
      low: Math.min(...slice.map((item) => item.low)),
      close: last.close,
      volume: slice.reduce((total, item) => total + item.volume, 0),
    });
  }

  return grouped;
}

function buildSma(values: number[], period: number) {
  let sum = 0;
  return values.map((value, index) => {
    sum += value;
    if (index >= period) sum -= values[index - period];
    return index >= period - 1 ? sum / period : null;
  });
}

function buildEma(values: number[], period: number) {
  const multiplier = 2 / (period + 1);
  let running: number | null = null;

  return values.map((value, index) => {
    if (index === 0) {
      running = value;
      return running;
    }

    if (index < period - 1) {
      running = value * multiplier + (running ?? value) * (1 - multiplier);
      return null;
    }

    if (index === period - 1) {
      const seed = values.slice(0, period).reduce((total, current) => total + current, 0) / period;
      running = seed;
      return running;
    }

    running = value * multiplier + (running ?? value) * (1 - multiplier);
    return running;
  });
}

function buildRsi(values: number[], period: number) {
  const output: Array<number | null> = new Array(values.length).fill(null);
  if (values.length <= period) return output;

  let gains = 0;
  let losses = 0;

  for (let index = 1; index <= period; index += 1) {
    const delta = values[index] - values[index - 1];
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;
  output[period] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);

  for (let index = period + 1; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    const gain = Math.max(delta, 0);
    const loss = Math.max(-delta, 0);
    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
    output[index] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  }

  return output;
}

function buildMacd(values: number[]) {
  const ema12 = buildEma(values, 12).map((value, index) => value ?? values[index]);
  const ema26 = buildEma(values, 26).map((value, index) => value ?? values[index]);
  const macd = values.map((_, index) => ema12[index] - ema26[index]);
  const signal = buildEma(macd, 9).map((value) => value ?? null);
  const histogram = macd.map((value, index) => (signal[index] == null ? null : value - Number(signal[index])));
  return { macd, signal, histogram };
}

function buildBollinger(values: number[], period: number, deviations = 2) {
  return values.map((_, index) => {
    if (index < period - 1) return { middle: null, upper: null, lower: null, width: null };

    const slice = values.slice(index - period + 1, index + 1);
    const mean = slice.reduce((total, current) => total + current, 0) / period;
    const variance = slice.reduce((total, current) => total + (current - mean) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);
    const upper = mean + stdDev * deviations;
    const lower = mean - stdDev * deviations;

    return {
      middle: mean,
      upper,
      lower,
      width: mean === 0 ? null : ((upper - lower) / mean) * 100,
    };
  });
}

function buildVolatility(values: number[], period: number) {
  const returns = values.map((value, index) => {
    if (index === 0) return 0;
    return Math.log(value / Math.max(values[index - 1], 1));
  });

  return values.map((_, index) => {
    if (index < period) return null;
    const slice = returns.slice(index - period + 1, index + 1);
    const mean = slice.reduce((total, current) => total + current, 0) / slice.length;
    const variance = slice.reduce((total, current) => total + (current - mean) ** 2, 0) / slice.length;
    return Math.sqrt(variance) * Math.sqrt(12) * 100;
  });
}

function buildDrawdown(values: number[]) {
  let peak = values[0] ?? 1;
  return values.map((value) => {
    peak = Math.max(peak, value);
    return (value / Math.max(peak, 1) - 1) * 100;
  });
}

function seriesPath(series: Array<number | null>, xAt: (index: number) => number, yAt: (value: number) => number) {
  let path = "";
  series.forEach((value, index) => {
    if (value == null || !Number.isFinite(value)) return;
    path += `${path ? " L" : "M"} ${xAt(index).toFixed(2)} ${yAt(value).toFixed(2)}`;
  });
  return path;
}

function bandPath(upperSeries: Array<number | null>, lowerSeries: Array<number | null>, xAt: (index: number) => number, yAt: (value: number) => number) {
  const topPoints: string[] = [];
  const bottomPoints: string[] = [];

  upperSeries.forEach((upper, index) => {
    const lower = lowerSeries[index];
    if (upper == null || lower == null || !Number.isFinite(upper) || !Number.isFinite(lower)) return;
    topPoints.push(`${xAt(index).toFixed(2)} ${yAt(upper).toFixed(2)}`);
    bottomPoints.unshift(`${xAt(index).toFixed(2)} ${yAt(lower).toFixed(2)}`);
  });

  if (topPoints.length < 2 || bottomPoints.length < 2) return "";
  return `M ${topPoints.join(" L ")} L ${bottomPoints.join(" L ")} Z`;
}

function trendLabel(close: number, ma20: number | null, ma50: number | null, ma100: number | null, ma200: number | null) {
  if ([ma20, ma50, ma100, ma200].every((value) => value != null)) {
    if (close > Number(ma20) && Number(ma20) > Number(ma50) && Number(ma50) > Number(ma100) && Number(ma100) > Number(ma200)) {
      return "Bullish stack";
    }
    if (close < Number(ma20) && Number(ma20) < Number(ma50) && Number(ma50) < Number(ma100) && Number(ma100) < Number(ma200)) {
      return "Bearish stack";
    }
  }

  if (ma50 != null && ma200 != null && close > ma50 && ma50 > ma200) return "Uptrend intact";
  if (ma50 != null && ma200 != null && close < ma50 && ma50 < ma200) return "Downtrend pressure";
  return "Transitional";
}

function safeSlice<T>(series: T[], start: number, end: number) {
  return series.slice(start, end + 1);
}

function buildCrossovers(shortSeries: Array<number | null>, longSeries: Array<number | null>, family: CrossoverSignal["family"]): CrossoverSignal[] {
  const signals: CrossoverSignal[] = [];

  for (let index = 1; index < shortSeries.length; index += 1) {
    const prevShort = shortSeries[index - 1];
    const prevLong = longSeries[index - 1];
    const currentShort = shortSeries[index];
    const currentLong = longSeries[index];
    if ([prevShort, prevLong, currentShort, currentLong].some((value) => value == null || !Number.isFinite(value))) continue;

    if (Number(prevShort) <= Number(prevLong) && Number(currentShort) > Number(currentLong)) {
      signals.push({
        index,
        type: "bullish",
        family,
        label: family === "50/200" ? "Golden cross" : "Bullish crossover",
        detail: `${family} moving-average bull crossover`,
      });
    }

    if (Number(prevShort) >= Number(prevLong) && Number(currentShort) < Number(currentLong)) {
      signals.push({
        index,
        type: "bearish",
        family,
        label: family === "50/200" ? "Death cross" : "Bearish crossover",
        detail: `${family} moving-average bear crossover`,
      });
    }
  }

  return signals;
}

function buildSparklinePath(values: number[], width: number, height: number) {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function InteractiveMarketChart({ data, milestones, crashEvents, regimes, annotations }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [selectedRangeKey, setSelectedRangeKey] = useState("all");
  const [compareRangeKey, setCompareRangeKey] = useState("reform");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedTimeframeKey, setSelectedTimeframeKey] = useState<TimeframeKey>("auto");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [zoomKey, setZoomKey] = useState<ZoomKey>("all");
  const [viewStart, setViewStart] = useState(0);
  const [viewEnd, setViewEnd] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [visibleOverlays, setVisibleOverlays] = useState<Record<OverlayKey, boolean>>({
    ma20: true,
    ma50: true,
    ma100: false,
    ma200: true,
    ema20: false,
    bollinger: true,
    crashes: true,
    crossovers: true,
    volume: true,
  });

  const monthlyCandles = useMemo(() => buildMonthlyCandles(data, crashEvents), [data, crashEvents]);
  const selectedRange = rangeFilters.find((filter) => filter.key === selectedRangeKey) ?? rangeFilters[0];
  const compareRange = rangeFilters.find((filter) => filter.key === compareRangeKey) ?? rangeFilters[2] ?? rangeFilters[0];

  const filteredCandles = useMemo(
    () => monthlyCandles.filter((candle) => candle.year >= selectedRange.start && candle.year <= selectedRange.end),
    [monthlyCandles, selectedRange.end, selectedRange.start],
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const target = wrapperRef.current;
    if (!target) return undefined;

    const updateSize = () => setContainerWidth(Math.max(target.clientWidth, 320));
    updateSize();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const previous = document.body.style.overflow;
    if (isFullscreen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const resolvedBucketSize = useMemo(() => {
    if (selectedTimeframeKey === "month") return 1;
    if (selectedTimeframeKey === "quarter") return 3;
    if (selectedTimeframeKey === "year") return 12;

    const spanYears = selectedRange.end - selectedRange.start + 1;
    if (spanYears >= 55) return 12;
    if (spanYears >= 22) return 3;
    return 1;
  }, [selectedRange.end, selectedRange.start, selectedTimeframeKey]);

  const displayCandles = useMemo(() => aggregateCandles(filteredCandles, resolvedBucketSize), [filteredCandles, resolvedBucketSize]);
  const milestoneMap = useMemo(() => new Map(milestones.map((item) => [item.year, item])), [milestones]);
  const annotationMap = useMemo(() => new Map(annotations.map((item) => [item.year, item])), [annotations]);
  const crashMap = useMemo(() => new Map(crashEvents.map((item) => [item.year, item])), [crashEvents]);

  const displayLength = displayCandles.length;
  const minimumWindow = Math.max(Math.min(displayLength, resolvedBucketSize >= 12 ? 6 : resolvedBucketSize >= 3 ? 10 : 18), 2);

  useEffect(() => {
    const lastIndex = Math.max(displayLength - 1, 0);
    setActiveIndex(lastIndex);
    setViewStart(0);
    setViewEnd(lastIndex);
    setZoomKey("all");
    setIsHovering(false);
  }, [displayLength, selectedRangeKey, selectedTimeframeKey]);

  if (filteredCandles.length === 0 || displayLength === 0) {
    return <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">No chart data available for the selected window.</div>;
  }

  const setClampedWindow = (start: number, end: number) => {
    const lastIndex = Math.max(displayLength - 1, 0);
    let nextStart = clamp(Math.round(start), 0, lastIndex);
    let nextEnd = clamp(Math.round(end), 0, lastIndex);

    if (nextStart > nextEnd) {
      const temp = nextStart;
      nextStart = nextEnd;
      nextEnd = temp;
    }

    const minSpan = Math.min(lastIndex, Math.max(minimumWindow - 1, 1));
    if (nextEnd - nextStart < minSpan) {
      if (nextStart === 0) nextEnd = Math.min(lastIndex, nextStart + minSpan);
      else if (nextEnd === lastIndex) nextStart = Math.max(0, nextEnd - minSpan);
      else nextEnd = Math.min(lastIndex, nextStart + minSpan);
    }

    setViewStart(nextStart);
    setViewEnd(nextEnd);
    setActiveIndex((current) => clamp(current, nextStart, nextEnd));
  };

  const applyZoom = (key: ZoomKey) => {
    setZoomKey(key);
    if (key === "all") {
      setClampedWindow(0, displayLength - 1);
      return;
    }

    const option = zoomOptions.find((item) => item.key === key) ?? zoomOptions[0];
    const targetLength = Math.max(Math.round(displayLength * option.fraction), minimumWindow);
    const center = clamp(activeIndex, 0, Math.max(displayLength - 1, 0));
    const nextStart = clamp(center - Math.floor(targetLength / 2), 0, Math.max(displayLength - targetLength, 0));
    const nextEnd = Math.min(displayLength - 1, nextStart + targetLength - 1);
    setClampedWindow(nextStart, nextEnd);
  };

  const shiftWindow = (direction: -1 | 1) => {
    const span = viewEnd - viewStart + 1;
    const shift = Math.max(Math.floor(span * 0.24), 1);
    const nextStart = viewStart + shift * direction;
    const nextEnd = viewEnd + shift * direction;
    setClampedWindow(nextStart, nextEnd);
  };

  const visibleCandles = displayCandles.slice(viewStart, viewEnd + 1);
  const closeValues = displayCandles.map((candle) => candle.close);
  const ma20 = buildSma(closeValues, 20);
  const ma50 = buildSma(closeValues, 50);
  const ma100 = buildSma(closeValues, 100);
  const ma200 = buildSma(closeValues, 200);
  const ema20 = buildEma(closeValues, 20);
  const rsi14 = buildRsi(closeValues, 14);
  const macdSeries = buildMacd(closeValues);
  const bollinger = buildBollinger(closeValues, 20, 2);
  const volatility20 = buildVolatility(closeValues, 20);
  const drawdownSeries = buildDrawdown(closeValues);
  const crossoverSignals = useMemo(
    () => [...buildCrossovers(ma20, ma50, "20/50"), ...buildCrossovers(ma50, ma200, "50/200")].sort((a, b) => a.index - b.index),
    [ma20, ma50, ma200],
  );

  const compareCandles = useMemo(() => {
    const scoped = monthlyCandles.filter((candle) => candle.year >= compareRange.start && candle.year <= compareRange.end);
    return aggregateCandles(scoped, resolvedBucketSize);
  }, [compareRange.end, compareRange.start, monthlyCandles, resolvedBucketSize]);

  const visibleMa20 = safeSlice(ma20, viewStart, viewEnd);
  const visibleMa50 = safeSlice(ma50, viewStart, viewEnd);
  const visibleMa100 = safeSlice(ma100, viewStart, viewEnd);
  const visibleMa200 = safeSlice(ma200, viewStart, viewEnd);
  const visibleEma20 = safeSlice(ema20, viewStart, viewEnd);
  const visibleRsi14 = safeSlice(rsi14, viewStart, viewEnd);
  const visibleMacd = safeSlice(macdSeries.macd, viewStart, viewEnd);
  const visibleSignal = safeSlice(macdSeries.signal, viewStart, viewEnd);
  const visibleHistogram = safeSlice(macdSeries.histogram, viewStart, viewEnd);
  const visibleBollinger = safeSlice(bollinger, viewStart, viewEnd);
  const visibleVolatility = safeSlice(volatility20, viewStart, viewEnd);
  const visibleDrawdown = safeSlice(drawdownSeries, viewStart, viewEnd);

  const firstYear = visibleCandles[0]?.year ?? selectedRange.start;
  const lastYear = visibleCandles[visibleCandles.length - 1]?.year ?? selectedRange.end;
  const visibleCount = visibleCandles.length;

  const priceBottom = pricePanelHeight;
  const volumeTop = priceBottom + panelGap;
  const volumeBottom = volumeTop + volumePanelHeight;
  const rsiTop = volumeBottom + panelGap;
  const rsiBottom = rsiTop + rsiPanelHeight;
  const macdTop = rsiBottom + panelGap;
  const macdBottom = macdTop + macdPanelHeight;
  const chartHeight = macdBottom + padding.bottom;

  const visiblePriceExtremes = [
    ...visibleCandles.flatMap((candle) => [candle.high, candle.low]),
    ...visibleMa20.filter((value): value is number => value != null),
    ...visibleMa50.filter((value): value is number => value != null),
    ...visibleMa100.filter((value): value is number => value != null),
    ...visibleMa200.filter((value): value is number => value != null),
    ...visibleEma20.filter((value): value is number => value != null),
    ...visibleBollinger.flatMap((entry) => [entry.upper, entry.lower]).filter((value): value is number => value != null),
  ];

  const maxHigh = Math.max(...visiblePriceExtremes) * 1.08;
  const minLow = Math.max(1, Math.min(...visiblePriceExtremes) * 0.86);
  const logMin = Math.log10(minLow);
  const logMax = Math.log10(maxHigh);
  const maxVolume = Math.max(...visibleCandles.map((candle) => candle.volume), 1);

  const chartInnerMinWidth = resolvedBucketSize >= 12 ? 1080 : resolvedBucketSize >= 3 ? 1240 : 1520;
  const pixelsPerBar = resolvedBucketSize >= 12 ? 18 : resolvedBucketSize >= 3 ? 14 : 11;
  const chartWidth = Math.max(chartInnerMinWidth, Math.min(5800, Math.max(containerWidth - 16, visibleCount * pixelsPerBar + padding.left + padding.right)));
  const drawableWidth = chartWidth - padding.left - padding.right;
  const step = drawableWidth / Math.max(visibleCount, 1);
  const candleWidth = clamp(step * (resolvedBucketSize >= 12 ? 0.44 : resolvedBucketSize >= 3 ? 0.56 : 0.68), 3, 20);

  const xAt = (index: number) => padding.left + index * step + step / 2;
  const priceY = (value: number) => {
    const safeValue = Math.max(value, minLow);
    return priceBottom - ((Math.log10(safeValue) - logMin) / Math.max(logMax - logMin, 0.00001)) * (priceBottom - padding.top);
  };
  const volumeY = (volume: number) => volumeBottom - (volume / maxVolume) * volumePanelHeight;
  const rsiY = (value: number) => rsiBottom - (value / 100) * (rsiBottom - rsiTop);

  const macdValues = [...visibleMacd, ...visibleSignal, ...visibleHistogram].filter((value): value is number => value != null && Number.isFinite(value));
  const rawMacdMin = macdValues.length ? Math.min(...macdValues) : -1;
  const rawMacdMax = macdValues.length ? Math.max(...macdValues) : 1;
  const macdAbsMax = Math.max(Math.abs(rawMacdMin), Math.abs(rawMacdMax), 1);
  const macdMin = -macdAbsMax * 1.15;
  const macdMax = macdAbsMax * 1.15;
  const macdY = (value: number) => macdBottom - ((value - macdMin) / Math.max(macdMax - macdMin, 0.00001)) * (macdBottom - macdTop);

  const guides = buildLogGuides(minLow, maxHigh);
  const yearTicks = buildYearTicks(firstYear, lastYear);
  const filteredRegimes = regimes.filter((regime) => {
    const { start, end } = parseRegimeYears(regime.years);
    return start <= lastYear && end >= firstYear;
  });

  const yearIndexMap = new Map<number, number>();
  visibleCandles.forEach((candle, index) => {
    if (!yearIndexMap.has(candle.year)) yearIndexMap.set(candle.year, index);
  });

  const lineSeries = {
    ma20: seriesPath(visibleMa20, xAt, priceY),
    ma50: seriesPath(visibleMa50, xAt, priceY),
    ma100: seriesPath(visibleMa100, xAt, priceY),
    ma200: seriesPath(visibleMa200, xAt, priceY),
    ema20: seriesPath(visibleEma20, xAt, priceY),
    rsi14: seriesPath(visibleRsi14, xAt, rsiY),
    macd: seriesPath(visibleMacd, xAt, macdY),
    signal: seriesPath(visibleSignal, xAt, macdY),
  };

  const bollingerUpper = visibleBollinger.map((entry) => entry.upper);
  const bollingerLower = visibleBollinger.map((entry) => entry.lower);
  const bollingerPath = bandPath(bollingerUpper, bollingerLower, xAt, priceY);

  const safeGlobalIndex = clamp(activeIndex, viewStart, viewEnd);
  const activeLocalIndex = safeGlobalIndex - viewStart;
  const activeCandle = visibleCandles[activeLocalIndex] ?? visibleCandles[visibleCandles.length - 1];
  const activeMilestone = milestoneMap.get(activeCandle.year);
  const activeAnnotation = annotationMap.get(activeCandle.year);
  const activeCrash = crashMap.get(activeCandle.year);
  const activeTitle = activeMilestone?.label ?? activeAnnotation?.title ?? activeCrash?.name ?? activeCandle.label;
  const densityLabel = resolvedBucketSize >= 12 ? "Yearly aggregated candle" : resolvedBucketSize >= 3 ? "Quarterly aggregated candle" : "Reconstructed monthly candle";
  const activeDetail = activeMilestone?.detail ?? activeAnnotation?.detail ?? activeCrash?.note ?? `${densityLabel} derived from the long-run annual index series.`;
  const activeX = xAt(activeLocalIndex);
  const activeY = priceY(activeCandle.close);
  const tooltipLeft = (activeX / chartWidth) * 100;
  const tooltipTop = (activeY / chartHeight) * 100;
  const tooltipTransform = activeX > chartWidth * 0.78 ? "translate(-100%, -112%)" : activeX < chartWidth * 0.24 ? "translate(0%, -112%)" : "translate(-50%, -112%)";

  const crashMarkerPoints = crashEvents
    .filter((event) => event.year >= firstYear && event.year <= lastYear)
    .map((event) => {
      const yearCandles = visibleCandles.map((candle, index) => ({ candle, index })).filter((entry) => entry.candle.year === event.year);
      if (yearCandles.length === 0) return null;
      const trough = yearCandles.reduce((lowest, current) => (current.candle.low < lowest.candle.low ? current : lowest), yearCandles[0]);
      return { event, ...trough };
    })
    .filter(Boolean) as Array<{ event: CrashEvent; candle: Candle; index: number }>;

  const handlePointerMove = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const localIndex = Math.round(ratio * (visibleCandles.length - 1));
    setActiveIndex(viewStart + clamp(localIndex, 0, visibleCandles.length - 1));
    setIsHovering(true);
  };

  const visibleStartClose = visibleCandles[0]?.close ?? activeCandle.close;
  const visibleEndClose = visibleCandles[visibleCandles.length - 1]?.close ?? activeCandle.close;
  const visibleYears = Math.max(visibleCandles.length / Math.max(12 / resolvedBucketSize, 1), 1);
  const windowCagr = (Math.pow(visibleEndClose / Math.max(visibleStartClose, 1), 1 / visibleYears) - 1) * 100;
  const totalMove = (visibleEndClose / Math.max(visibleStartClose, 1) - 1) * 100;
  const activeReturn = (activeCandle.close / Math.max(activeCandle.open, 1) - 1) * 100;
  const activeMa20 = visibleMa20[activeLocalIndex] ?? null;
  const activeMa50 = visibleMa50[activeLocalIndex] ?? null;
  const activeMa100 = visibleMa100[activeLocalIndex] ?? null;
  const activeMa200 = visibleMa200[activeLocalIndex] ?? null;
  const activeEma20 = visibleEma20[activeLocalIndex] ?? null;
  const activeRsi = visibleRsi14[activeLocalIndex] ?? null;
  const activeMacdHist = visibleHistogram[activeLocalIndex] ?? null;
  const activeMacd = visibleMacd[activeLocalIndex] ?? null;
  const activeSignal = visibleSignal[activeLocalIndex] ?? null;
  const activeVolatility = visibleVolatility[activeLocalIndex] ?? null;
  const activeDrawdown = visibleDrawdown[activeLocalIndex] ?? 0;
  const activeBandWidth = visibleBollinger[activeLocalIndex]?.width ?? null;
  const activeTrend = trendLabel(activeCandle.close, activeMa20, activeMa50, activeMa100, activeMa200);
  const trendTone = activeTrend === "Bullish stack" ? "text-emerald-300" : activeTrend === "Bearish stack" ? "text-rose-300" : "text-amber-300";

  const visibleCrossovers = crossoverSignals.filter((signal) => signal.index >= viewStart && signal.index <= viewEnd);
  const latestVisibleSignal = visibleCrossovers[visibleCrossovers.length - 1] ?? null;

  const summarizeRange = (candles: Candle[]) => {
    if (!candles.length) {
      return {
        years: "—",
        cagr: null,
        total: null,
        maxDrawdown: null,
        avgVolatility: null,
        sparklinePath: "",
        startLabel: "—",
        endLabel: "—",
      };
    }

    const closes = candles.map((candle) => candle.close);
    const start = closes[0] ?? 1;
    const end = closes[closes.length - 1] ?? start;
    const years = Math.max(candles.length / Math.max(12 / resolvedBucketSize, 1), 1);
    const drawdowns = buildDrawdown(closes);
    const vols = buildVolatility(closes, Math.min(20, Math.max(3, Math.floor(closes.length / 5)))).filter((value): value is number => value != null);
    return {
      years: `${candles[0]?.year ?? "—"}–${candles[candles.length - 1]?.year ?? "—"}`,
      cagr: (Math.pow(end / Math.max(start, 1), 1 / years) - 1) * 100,
      total: (end / Math.max(start, 1) - 1) * 100,
      maxDrawdown: Math.min(...drawdowns),
      avgVolatility: vols.length ? vols.reduce((total, value) => total + value, 0) / vols.length : null,
      sparklinePath: buildSparklinePath(closes, 220, 56),
      startLabel: candles[0]?.label ?? "—",
      endLabel: candles[candles.length - 1]?.label ?? "—",
    };
  };

  const primarySummary = summarizeRange(visibleCandles);
  const compareSummary = summarizeRange(compareCandles);

  const exportCurrentChart = async (format: "png" | "svg") => {
    if (typeof window === "undefined") return;
    const svgNode = svgRef.current;
    if (!svgNode) return;

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgNode);
    if (!source.includes("xmlns=\"http://www.w3.org/2000/svg\"")) {
      source = source.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.includes("xmlns:xlink")) {
      source = source.replace("<svg", '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    if (format === "svg") {
      const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `india-market-chart-${selectedRange.key}.svg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return;
    }

    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const viewBox = svgNode.viewBox.baseVal;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(Math.round(viewBox.width), 1200);
      canvas.height = Math.max(Math.round(viewBox.height), 800);
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        return;
      }
      context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--chart-panel-bg").trim() || "#020617";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `india-market-chart-${selectedRange.key}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    };
    image.src = url;
  };

  const overviewWidth = Math.max(containerWidth - 12, 320);
  const overviewHeight = 96;
  const overviewCloseValues = displayCandles.map((candle) => candle.close);
  const overviewMin = Math.max(1, Math.min(...overviewCloseValues) * 0.92);
  const overviewMax = Math.max(...overviewCloseValues) * 1.04;
  const overviewLogMin = Math.log10(overviewMin);
  const overviewLogMax = Math.log10(overviewMax);
  const overviewXAt = (index: number) => navigatorPadding.left + index * ((overviewWidth - navigatorPadding.left - navigatorPadding.right) / Math.max(displayLength - 1, 1));
  const overviewYAt = (value: number) => overviewHeight - navigatorPadding.bottom - ((Math.log10(Math.max(value, overviewMin)) - overviewLogMin) / Math.max(overviewLogMax - overviewLogMin, 0.00001)) * (overviewHeight - navigatorPadding.top - navigatorPadding.bottom);
  const overviewPath = seriesPath(overviewCloseValues, overviewXAt, overviewYAt);
  const overviewViewportX = overviewXAt(viewStart);
  const overviewViewportEnd = overviewXAt(viewEnd);
  const overviewViewportWidth = Math.max(overviewViewportEnd - overviewViewportX, 8);

  const handleNavigatorJump = (clientX: number, element: HTMLDivElement) => {
    const rect = element.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const center = Math.round(ratio * (displayLength - 1));
    const span = viewEnd - viewStart + 1;
    const nextStart = clamp(center - Math.floor(span / 2), 0, Math.max(displayLength - span, 0));
    const nextEnd = Math.min(displayLength - 1, nextStart + span - 1);
    setClampedWindow(nextStart, nextEnd);
  };

  const chartScroller = (
    <div className="mt-5 space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {rangeFilters.map((filter) => {
            const active = filter.key === selectedRangeKey;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setSelectedRangeKey(filter.key)}
                className={active ? "rounded-full border border-sky-400/30 bg-sky-400/12 px-3 py-1.5 text-xs font-medium text-sky-200" : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          {timeframeOptions.map((option) => {
            const active = option.key === selectedTimeframeKey;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelectedTimeframeKey(option.key)}
                className={active ? "rounded-full border border-fuchsia-400/35 bg-fuchsia-400/12 px-3 py-1.5 text-xs font-medium text-fuchsia-200" : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"}
                title={option.description}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          {overlayMeta.map((overlay) => {
            const active = visibleOverlays[overlay.key];
            return (
              <button
                key={overlay.key}
                type="button"
                onClick={() => setVisibleOverlays((current) => ({ ...current, [overlay.key]: !current[overlay.key] }))}
                className={active ? "rounded-full border px-3 py-1.5 text-xs font-medium text-white" : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/10"}
                style={active ? { borderColor: `${overlay.color}55`, background: `${overlay.color}20`, color: overlay.color } : undefined}
              >
                {overlay.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">Zoom</span>
          {zoomOptions.map((option) => {
            const currentlyMatches = option.key === "all" ? viewStart === 0 && viewEnd === displayLength - 1 : zoomKey === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => applyZoom(option.key)}
                className={currentlyMatches ? "rounded-full border border-emerald-400/35 bg-emerald-400/12 px-3 py-1.5 text-xs font-medium text-emerald-200" : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"}
              >
                {option.label}
              </button>
            );
          })}
          <button type="button" onClick={() => shiftWindow(-1)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10">← Pan</button>
          <button type="button" onClick={() => shiftWindow(1)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10">Pan →</button>
          <button type="button" onClick={() => setClampedWindow(0, displayLength - 1)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10">Reset window</button>
          <button type="button" onClick={() => setIsFullscreen((current) => !current)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10">{isFullscreen ? "Exit fullscreen" : "Fullscreen"}</button>
          <button type="button" onClick={() => exportCurrentChart("png")} className="rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-200 transition hover:bg-sky-400/15">Export PNG</button>
          <button type="button" onClick={() => exportCurrentChart("svg")} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10">Export SVG</button>
        </div>

        <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Candlestick + subpanels</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Density: {resolvedBucketSize >= 12 ? "Yearly" : resolvedBucketSize >= 3 ? "Quarterly" : "Monthly"}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Visible window: {formatNumber(visibleCount)} candles</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">RSI 14 + MACD panels</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Navigator + dual sliders</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Crossovers: {formatNumber(visibleCrossovers.length)}</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Compare eras</p>
                <p className="mt-1 text-sm text-white">Split-view analytics</p>
              </div>
              <button
                type="button"
                onClick={() => setCompareMode((current) => !current)}
                className={compareMode ? "rounded-full border border-fuchsia-400/35 bg-fuchsia-400/12 px-3 py-1.5 font-medium text-fuchsia-200" : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300 transition hover:bg-white/10"}
              >
                {compareMode ? "Compare on" : "Compare off"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {rangeFilters.map((filter) => {
                const active = filter.key === compareRangeKey;
                const disabled = filter.key === selectedRangeKey;
                return (
                  <button
                    key={`compare-${filter.key}`}
                    type="button"
                    disabled={disabled}
                    onClick={() => setCompareRangeKey(filter.key)}
                    className={active ? "rounded-full border border-fuchsia-400/35 bg-fuchsia-400/12 px-3 py-1.5 text-[11px] font-medium text-fuchsia-200" : "rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-white/8 bg-black/10 p-3">
        <div
          className="rounded-2xl border border-white/8 bg-white/[0.03] p-3"
          onMouseDown={(event) => handleNavigatorJump(event.clientX, event.currentTarget)}
          onTouchStart={(event) => handleNavigatorJump(event.touches[0].clientX, event.currentTarget)}
        >
          <div className="mb-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <span>Overview navigator</span>
            <span>{visibleCandles[0]?.label} → {visibleCandles[visibleCandles.length - 1]?.label}</span>
          </div>
          <svg viewBox={`0 0 ${overviewWidth} ${overviewHeight}`} className="block h-[96px] w-full overflow-visible">
            <defs>
              <linearGradient id="overview-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.03" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width={overviewWidth} height={overviewHeight} rx="18" fill="rgba(255,255,255,0.02)" />
            <path d={`${overviewPath} L ${overviewXAt(displayLength - 1)} ${overviewHeight - navigatorPadding.bottom} L ${overviewXAt(0)} ${overviewHeight - navigatorPadding.bottom} Z`} fill="url(#overview-fill)" />
            <path d={overviewPath} fill="none" stroke="#38bdf8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <rect x={overviewViewportX} y="8" width={overviewViewportWidth} height={overviewHeight - 16} rx="12" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.45)" />
            <line x1={overviewViewportX} y1="10" x2={overviewViewportX} y2={overviewHeight - 10} stroke="rgba(255,255,255,0.55)" strokeDasharray="4 6" />
            <line x1={overviewViewportX + overviewViewportWidth} y1="10" x2={overviewViewportX + overviewViewportWidth} y2={overviewHeight - 10} stroke="rgba(255,255,255,0.55)" strokeDasharray="4 6" />
          </svg>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-400">
              Start window
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={Math.max(displayLength - 1, 0)}
                value={viewStart}
                onChange={(event) => setClampedWindow(Number(event.target.value), viewEnd)}
              />
              <span className="mt-1 block text-[11px] text-slate-500">{visibleCandles[0]?.label}</span>
            </label>
            <label className="text-xs text-slate-400">
              End window
              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={Math.max(displayLength - 1, 0)}
                value={viewEnd}
                onChange={(event) => setClampedWindow(viewStart, Number(event.target.value))}
              />
              <span className="mt-1 block text-[11px] text-slate-500">{visibleCandles[visibleCandles.length - 1]?.label}</span>
            </label>
          </div>
        </div>
      </div>

      <div ref={wrapperRef} className="relative overflow-x-auto rounded-[28px] border border-white/8 bg-black/10 p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="block h-auto"
          style={{ width: `${chartWidth}px`, minWidth: `${Math.min(chartWidth, 1080)}px` }}
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={(event) => handlePointerMove(event.clientX)}
          onMouseLeave={() => setIsHovering(false)}
          onTouchStart={(event) => handlePointerMove(event.touches[0].clientX)}
          onTouchMove={(event) => handlePointerMove(event.touches[0].clientX)}
        >
          <defs>
            <linearGradient id="candle-bull" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="candle-bear" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#fb7185" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="bollinger-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f472b6" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#f472b6" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {filteredRegimes.map((regime) => {
            const { start, end } = parseRegimeYears(regime.years);
            const startIndex = visibleCandles.findIndex((candle) => candle.year >= Math.max(start, firstYear));
            const endIndexFromLeft = [...visibleCandles].reverse().findIndex((candle) => candle.year <= Math.min(end, lastYear));
            const endIndex = endIndexFromLeft === -1 ? visibleCandles.length - 1 : visibleCandles.length - 1 - endIndexFromLeft;
            if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) return null;

            const x = xAt(startIndex) - step / 2;
            const width = Math.max(xAt(endIndex) - xAt(startIndex) + step, 12);
            return (
              <g key={regime.id}>
                <rect x={x} y={padding.top - 14} width={width} height={priceBottom - padding.top + 16} rx="14" fill={regimeFills[regime.tone]} />
                {width > 84 ? <text x={x + 10} y={24} fill="var(--chart-subtle-text)" fontSize="12" fontWeight="600">{regime.name}</text> : null}
              </g>
            );
          })}

          {guides.map((guide) => {
            const y = priceY(guide);
            return (
              <g key={guide}>
                <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="var(--chart-grid)" strokeDasharray="4 8" />
                <text x={14} y={y + 4} fill="var(--chart-axis-text)" fontSize="12">{formatNumber(guide)}</text>
              </g>
            );
          })}

          {yearTicks.map((year) => {
            const tickIndex = yearIndexMap.get(year);
            if (tickIndex == null) return null;
            const x = xAt(tickIndex);
            return (
              <g key={year}>
                <line x1={x} y1={padding.top - 8} x2={x} y2={macdBottom} stroke="var(--chart-grid-soft)" />
                <text x={x} y={chartHeight - 14} textAnchor="middle" fill="var(--chart-axis-text)" fontSize="12">{year}</text>
              </g>
            );
          })}

          <line x1={padding.left} y1={volumeTop - 10} x2={chartWidth - padding.right} y2={volumeTop - 10} stroke="var(--chart-grid)" strokeDasharray="4 8" />
          <text x={14} y={volumeTop - 16} fill="var(--chart-axis-text)" fontSize="12">Volume</text>

          {[30, 50, 70].map((value) => (
            <g key={value}>
              <line x1={padding.left} y1={rsiY(value)} x2={chartWidth - padding.right} y2={rsiY(value)} stroke={value === 50 ? "var(--chart-grid)" : "var(--chart-grid-soft)"} strokeDasharray="4 8" />
              <text x={14} y={rsiY(value) + 4} fill="var(--chart-axis-text)" fontSize="12">{value}</text>
            </g>
          ))}
          <text x={14} y={rsiTop - 10} fill="var(--chart-axis-text)" fontSize="12">RSI 14</text>

          {[macdMin, 0, macdMax].map((value, index) => (
            <g key={`${value}-${index}`}>
              <line x1={padding.left} y1={macdY(value)} x2={chartWidth - padding.right} y2={macdY(value)} stroke={value === 0 ? "rgba(255,255,255,0.35)" : "var(--chart-grid-soft)"} strokeDasharray="4 8" />
              <text x={14} y={macdY(value) + 4} fill="var(--chart-axis-text)" fontSize="12">{formatNumber(value, 1)}</text>
            </g>
          ))}
          <text x={14} y={macdTop - 10} fill="var(--chart-axis-text)" fontSize="12">MACD</text>

          {visibleOverlays.bollinger && bollingerPath ? <path d={bollingerPath} fill="url(#bollinger-fill)" /> : null}

          {visibleCandles.map((candle, index) => {
            const x = xAt(index);
            const bodyTop = priceY(Math.max(candle.open, candle.close));
            const bodyBottom = priceY(Math.min(candle.open, candle.close));
            const wickTop = priceY(candle.high);
            const wickBottom = priceY(candle.low);
            const bullish = candle.close >= candle.open;
            const fill = bullish ? "url(#candle-bull)" : "url(#candle-bear)";
            const stroke = bullish ? "#34d399" : "#fb7185";
            const histValue = visibleHistogram[index] ?? 0;
            const histBase = macdY(0);
            const histY = macdY(histValue);

            return (
              <g key={`${candle.year}-${candle.month}-${index}`}>
                {visibleOverlays.volume ? (
                  <rect
                    x={x - Math.max(candleWidth * 0.34, 1)}
                    y={volumeY(candle.volume)}
                    width={Math.max(candleWidth * 0.68, 1.5)}
                    height={Math.max(volumeBottom - volumeY(candle.volume), 1)}
                    fill={bullish ? "rgba(52,211,153,0.28)" : "rgba(251,113,133,0.28)"}
                    opacity={0.82}
                  />
                ) : null}

                <line x1={x} y1={wickTop} x2={x} y2={wickBottom} stroke={stroke} strokeWidth={Math.max(candleWidth * 0.18, 1)} strokeLinecap="round" />
                <rect
                  x={x - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={Math.max(bodyBottom - bodyTop, 1.6)}
                  rx={Math.min(candleWidth * 0.2, 2)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={0.45}
                />

                <rect
                  x={x - Math.max(candleWidth * 0.32, 1)}
                  y={Math.min(histBase, histY)}
                  width={Math.max(candleWidth * 0.64, 1.4)}
                  height={Math.max(Math.abs(histBase - histY), 1)}
                  rx="1.5"
                  fill={histValue >= 0 ? "rgba(52,211,153,0.55)" : "rgba(251,113,133,0.55)"}
                />
              </g>
            );
          })}

          {visibleOverlays.ma20 && lineSeries.ma20 ? <path d={lineSeries.ma20} fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {visibleOverlays.ma50 && lineSeries.ma50 ? <path d={lineSeries.ma50} fill="none" stroke="#38bdf8" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {visibleOverlays.ma100 && lineSeries.ma100 ? <path d={lineSeries.ma100} fill="none" stroke="#a78bfa" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {visibleOverlays.ma200 && lineSeries.ma200 ? <path d={lineSeries.ma200} fill="none" stroke="#34d399" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {visibleOverlays.ema20 && lineSeries.ema20 ? <path d={lineSeries.ema20} fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="7 5" /> : null}
          {lineSeries.rsi14 ? <path d={lineSeries.rsi14} fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {lineSeries.macd ? <path d={lineSeries.macd} fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {lineSeries.signal ? <path d={lineSeries.signal} fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 5" /> : null}

          {crashMarkerPoints.map(({ event, candle, index }) => {
            if (!visibleOverlays.crashes) return null;
            const x = xAt(index);
            const y = priceY(candle.low);
            const size = 8;
            return (
              <g key={`${event.name}-${event.year}`}>
                <polygon points={`${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`} fill="#fb7185" opacity="0.9" />
                <text x={x} y={y - 13} textAnchor="middle" fill="rgba(251,113,133,0.95)" fontSize="11" fontWeight="700">{event.decline}%</text>
              </g>
            );
          })}

          {visibleCrossovers.map((signal) => {
            if (!visibleOverlays.crossovers) return null;
            const localIndex = signal.index - viewStart;
            const candle = visibleCandles[localIndex];
            if (!candle) return null;
            const x = xAt(localIndex);
            const bullish = signal.type === "bullish";
            const y = bullish ? priceY(candle.low) + 18 : priceY(candle.high) - 18;
            const fill = bullish ? "#22c55e" : "#ef4444";
            const triangle = bullish
              ? `${x},${y + 9} ${x + 9},${y - 7} ${x - 9},${y - 7}`
              : `${x},${y - 9} ${x + 9},${y + 7} ${x - 9},${y + 7}`;
            return (
              <g key={`${signal.family}-${signal.type}-${signal.index}`}>
                <polygon points={triangle} fill={fill} opacity="0.95" />
                <circle cx={x} cy={y} r="12" fill={fill} opacity="0.12" />
              </g>
            );
          })}

          {milestones
            .filter((item) => item.year >= firstYear && item.year <= lastYear)
            .map((milestone) => {
              const yearIndex = visibleCandles.findIndex((candle) => candle.year === milestone.year);
              if (yearIndex === -1) return null;
              const x = xAt(yearIndex);
              const y = priceY(visibleCandles[yearIndex].close);
              return (
                <g key={milestone.year}>
                  <circle cx={x} cy={y} r="5.5" fill={milestoneColors[milestone.tone]} />
                  <circle cx={x} cy={y} r="11.5" fill={milestoneColors[milestone.tone]} opacity="0.12" />
                </g>
              );
            })}

          <g>
            <line x1={activeX} y1={padding.top - 8} x2={activeX} y2={macdBottom} stroke="var(--chart-active-line)" strokeDasharray="6 6" />
            <circle cx={activeX} cy={activeY} r="5.5" fill="#ffffff" />
            <circle cx={activeX} cy={activeY} r="12" fill="#ffffff" opacity="0.1" />
            <circle cx={activeX} cy={rsiY(activeRsi ?? 50)} r="4.5" fill="#fbbf24" />
            <circle cx={activeX} cy={macdY(activeMacd ?? 0)} r="4.5" fill="#38bdf8" />
          </g>
        </svg>

        <div
          className="pointer-events-none absolute z-10 max-w-[340px] rounded-2xl border border-white/10 p-4 shadow-2xl backdrop-blur-xl"
          style={{
            left: `${tooltipLeft}%`,
            top: `${Math.max(tooltipTop, 15)}%`,
            transform: tooltipTransform,
            opacity: isHovering ? 1 : 0.97,
            background: "var(--chart-tooltip-bg)",
            color: "var(--chart-tooltip-text)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{activeTitle}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">{activeCandle.label}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300">{activeReturn >= 0 ? "+" : ""}{formatPercent(activeReturn, 1)}</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-white/8 bg-white/5 p-2.5"><p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Open</p><p className="mt-1 font-semibold">{formatNumber(activeCandle.open)}</p></div>
            <div className="rounded-xl border border-white/8 bg-white/5 p-2.5"><p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Close</p><p className="mt-1 font-semibold">{formatNumber(activeCandle.close)}</p></div>
            <div className="rounded-xl border border-white/8 bg-white/5 p-2.5"><p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">High</p><p className="mt-1 font-semibold">{formatNumber(activeCandle.high)}</p></div>
            <div className="rounded-xl border border-white/8 bg-white/5 p-2.5"><p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Low</p><p className="mt-1 font-semibold">{formatNumber(activeCandle.low)}</p></div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
            <div>MA20: <span className="font-medium text-white">{formatNumber(activeMa20)}</span></div>
            <div>MA50: <span className="font-medium text-white">{formatNumber(activeMa50)}</span></div>
            <div>MA100: <span className="font-medium text-white">{formatNumber(activeMa100)}</span></div>
            <div>MA200: <span className="font-medium text-white">{formatNumber(activeMa200)}</span></div>
            <div>EMA20: <span className="font-medium text-white">{formatNumber(activeEma20)}</span></div>
            <div>RSI14: <span className="font-medium text-white">{formatNumber(activeRsi, 1)}</span></div>
            <div>MACD: <span className="font-medium text-white">{formatNumber(activeMacd, 1)}</span></div>
            <div>Signal: <span className="font-medium text-white">{formatNumber(activeSignal, 1)}</span></div>
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-300">{activeDetail}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative overflow-hidden rounded-[32px] p-4 sm:p-6" style={{ background: "var(--chart-panel-bg)", boxShadow: "var(--chart-panel-shadow)" }}>
      {isFullscreen ? <div className="fixed inset-0 z-[70] bg-slate-950/75 backdrop-blur-md" onClick={() => setIsFullscreen(false)} /> : null}

      <div className={isFullscreen ? "fixed inset-3 z-[80] overflow-y-auto rounded-[32px] border border-white/10 p-4 sm:inset-4 sm:p-6" : "relative"} style={isFullscreen ? { background: "var(--chart-panel-bg)", boxShadow: "var(--chart-panel-shadow)" } : undefined}>
        {chartScroller}
        {isFullscreen ? (
          <div className="sticky bottom-3 mt-4 flex justify-end">
            <button type="button" onClick={() => setIsFullscreen(false)} className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100 backdrop-blur">Close fullscreen</button>
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Visible window</p>
          <p className="mt-2 text-2xl font-semibold text-white">{firstYear}–{lastYear}</p>
          <p className="mt-2 text-sm text-slate-300">{selectedRange.note}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Window CAGR</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatPercent(windowCagr, 1)}</p>
          <p className="mt-2 text-sm text-slate-300">Annualized move across the currently zoomed candle window.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Total move</p>
          <p className="mt-2 text-2xl font-semibold text-white">{totalMove >= 0 ? "+" : ""}{formatPercent(totalMove, 0)}</p>
          <p className="mt-2 text-sm text-slate-300">Cumulative change between the first and last visible close.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">RSI 14</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(activeRsi, 1)}</p>
          <p className="mt-2 text-sm text-slate-300">Momentum snapshot from the RSI subpanel.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">MACD histogram</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(activeMacdHist, 1)}</p>
          <p className="mt-2 text-sm text-slate-300">Positive suggests momentum expansion; negative suggests fade.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Trend stack</p>
          <p className={`mt-2 text-2xl font-semibold ${trendTone}`}>{activeTrend}</p>
          <p className="mt-2 text-sm text-slate-300">Derived from close relative to the major moving averages.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Drawdown from local peak</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatPercent(activeDrawdown, 1)}</p>
          <p className="mt-2 text-sm text-slate-300">How far the active candle sits below the highest close in the visible window.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">20-period volatility</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatPercent(activeVolatility, 1)}</p>
          <p className="mt-2 text-sm text-slate-300">Annualized volatility estimate based on reconstructed candle returns.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Bollinger width</p>
          <p className="mt-2 text-xl font-semibold text-white">{formatPercent(activeBandWidth, 1)}</p>
          <p className="mt-2 text-sm text-slate-300">Compression versus expansion at the active candle.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">Latest visible signal</p>
          <p className={`mt-2 text-xl font-semibold ${latestVisibleSignal?.type === "bullish" ? "text-emerald-300" : latestVisibleSignal?.type === "bearish" ? "text-rose-300" : "text-white"}`}>{latestVisibleSignal ? latestVisibleSignal.label : "No crossover"}</p>
          <p className="mt-2 text-sm text-slate-300">{latestVisibleSignal ? `${latestVisibleSignal.detail} on ${displayCandles[latestVisibleSignal.index]?.label ?? "visible chart"}.` : "Turn on crossover markers to inspect MA 20/50 and MA 50/200 signals."}</p>
        </div>
      </div>

      {compareMode ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Primary window</p>
                <h4 className="mt-1 text-lg font-semibold text-white">{selectedRange.label}</h4>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{primarySummary.years}</span>
            </div>
            <svg viewBox="0 0 220 56" className="mt-4 h-16 w-full overflow-visible">
              <path d={primarySummary.sparklinePath} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-white/8 bg-white/5 p-3"><p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">CAGR</p><p className="mt-1 font-semibold text-white">{formatPercent(primarySummary.cagr, 1)}</p></div>
              <div className="rounded-xl border border-white/8 bg-white/5 p-3"><p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Total move</p><p className="mt-1 font-semibold text-white">{formatPercent(primarySummary.total, 0)}</p></div>
              <div className="rounded-xl border border-white/8 bg-white/5 p-3"><p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Max drawdown</p><p className="mt-1 font-semibold text-white">{formatPercent(primarySummary.maxDrawdown, 1)}</p></div>
              <div className="rounded-xl border border-white/8 bg-white/5 p-3"><p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Avg volatility</p><p className="mt-1 font-semibold text-white">{formatPercent(primarySummary.avgVolatility, 1)}</p></div>
            </div>
            <p className="mt-3 text-sm text-slate-300">{primarySummary.startLabel} → {primarySummary.endLabel}</p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Comparison window</p>
                <h4 className="mt-1 text-lg font-semibold text-white">{compareRange.label}</h4>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{compareSummary.years}</span>
            </div>
            <svg viewBox="0 0 220 56" className="mt-4 h-16 w-full overflow-visible">
              <path d={compareSummary.sparklinePath} fill="none" stroke="#e879f9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-white/8 bg-white/5 p-3"><p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">CAGR</p><p className="mt-1 font-semibold text-white">{formatPercent(compareSummary.cagr, 1)}</p></div>
              <div className="rounded-xl border border-white/8 bg-white/5 p-3"><p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Total move</p><p className="mt-1 font-semibold text-white">{formatPercent(compareSummary.total, 0)}</p></div>
              <div className="rounded-xl border border-white/8 bg-white/5 p-3"><p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Max drawdown</p><p className="mt-1 font-semibold text-white">{formatPercent(compareSummary.maxDrawdown, 1)}</p></div>
              <div className="rounded-xl border border-white/8 bg-white/5 p-3"><p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Avg volatility</p><p className="mt-1 font-semibold text-white">{formatPercent(compareSummary.avgVolatility, 1)}</p></div>
            </div>
            <p className="mt-3 text-sm text-slate-300">{compareSummary.startLabel} → {compareSummary.endLabel}</p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-slate-400">Important note</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">This is a <span className="font-semibold text-white">technical reconstruction</span> built from the long-run annual index series. It now supports MA crossover markers, exported chart snapshots, split-era comparison, zoom, navigator analysis, and RSI/MACD subpanels across 1947–2025, not exchange-traded monthly OHLC bars.</p>
      </div>
    </div>
  );
}
