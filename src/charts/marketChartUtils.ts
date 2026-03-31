import type { CrashEvent, MarketPoint } from "../data/indiaMarketData";

export type RangeFilter = {
  key: string;
  label: string;
  start: number;
  end: number;
  note: string;
};

export type Candle = {
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

export type TimeframeKey = "month" | "quarter" | "year";
export type ChartMode = "long" | "technical";
export type TechnicalPane = "rsi" | "macd";

export const monthLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const rangeFilters: RangeFilter[] = [
  {
    key: "all",
    label: "Full journey",
    start: 1947,
    end: 2025,
    note: "Full 1947–2025 annual record with regime shifts, crash markers, and drawdown context.",
  },
  {
    key: "pre-sensex",
    label: "1947–1979",
    start: 1947,
    end: 1979,
    note: "The suppressed-market era where policy and inflation dominated the tape.",
  },
  {
    key: "awakening",
    label: "1979–1991",
    start: 1979,
    end: 1991,
    note: "The low-base rerating and pre-liberalization breakout.",
  },
  {
    key: "reform",
    label: "1991–2003",
    start: 1991,
    end: 2003,
    note: "Liberalization, fraud shocks, and external volatility in one regime.",
  },
  {
    key: "golden-bull",
    label: "2003–2025",
    start: 2003,
    end: 2025,
    note: "The globally integrated compounding era with deeper domestic participation.",
  },
  {
    key: "modern",
    label: "2014–2025",
    start: 2014,
    end: 2025,
    note: "The modern domestic-liquidity era with stronger structural retail support.",
  },
];

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function formatNumber(value: number | null | undefined, decimals = 0) {
  if (!Number.isFinite(value)) return "—";

  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value: number | null | undefined, decimals = 1) {
  if (!Number.isFinite(value)) return "—";
  return `${Number(value).toFixed(decimals)}%`;
}

export function parseRegimeYears(years: string) {
  const [start, end] = years.split("–").map((part) => Number(part.trim()));
  return { start, end };
}

export function buildMonthlyCandles(
  yearlyData: MarketPoint[],
  crashEvents: CrashEvent[],
) {
  const crashMap = new Map(crashEvents.map((event) => [event.year, event]));
  const candles: Candle[] = [];
  let runningIndex = 0;

  yearlyData.forEach((point, pointIndex) => {
    const previous = yearlyData[pointIndex - 1]?.value ?? point.value * 0.94;
    const current = point.value;
    const annualReturn = current / Math.max(previous, 1) - 1;
    const crash = crashMap.get(point.year);
    const crashBoost = crash
      ? Math.min(Math.abs(crash.decline) / 100, 0.65)
      : 0;
    const amplitude = clamp(
      0.03 + Math.abs(annualReturn) * 0.09 + crashBoost * 0.14,
      0.025,
      0.18,
    );
    let priorClose = previous;

    for (let month = 0; month < 12; month += 1) {
      const t = (month + 1) / 12;
      const base = Math.exp(
        Math.log(Math.max(previous, 1)) +
          (Math.log(Math.max(current, 1)) - Math.log(Math.max(previous, 1))) *
            t,
      );
      const envelope = month === 11 ? 0 : Math.sin(Math.PI * t);
      const waveSeed =
        Math.sin((point.year - 1947) * 0.9 + month * 0.75) +
        Math.cos(month * 0.55 + pointIndex * 0.45);
      const waveFactor = 1 + waveSeed * amplitude * 0.16 * envelope;
      const close = month === 11 ? current : Math.max(1, base * waveFactor);
      const open = Math.max(1, priorClose);
      const wickStretch = amplitude * (0.65 + ((month % 5) + 1) / 10);
      let high = Math.max(open, close) * (1 + wickStretch);
      let low = Math.min(open, close) * (1 - wickStretch * 0.84);

      if (crash && month >= 4 && month <= 8)
        low *= 1 + (crash.decline / 100) * 0.33;
      if (crash && month >= 2 && month <= 5)
        high *= 1 + (Math.abs(crash.decline) / 100) * 0.04;

      high = Math.max(high, open, close);
      low = Math.max(1, Math.min(low, open, close));

      const turnoverBase = Math.sqrt(Math.max(open * close, 1));
      const volatilityBoost = Math.abs(close / Math.max(open, 1) - 1) * 16;
      const volume = Math.round(
        (turnoverBase * 28 + 800) * (1 + volatilityBoost + crashBoost * 1.8),
      );

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

export function aggregateCandles(candles: Candle[], bucketSize: number) {
  if (bucketSize <= 1) return candles;

  const grouped: Candle[] = [];
  for (let index = 0; index < candles.length; index += bucketSize) {
    const slice = candles.slice(index, index + bucketSize);
    if (slice.length === 0) continue;

    const first = slice[0];
    const last = slice[slice.length - 1];
    const label =
      bucketSize >= 12
        ? `${last.year}`
        : bucketSize >= 3
          ? `Q${Math.ceil(last.month / 3)} ${last.year}`
          : last.label;

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

export function bucketSizeForTimeframe(timeframe: TimeframeKey) {
  if (timeframe === "month") return 1;
  if (timeframe === "quarter") return 3;
  return 12;
}

export function buildSma(values: number[], period: number) {
  let sum = 0;
  return values.map((value, index) => {
    sum += value;
    if (index >= period) sum -= values[index - period];
    return index >= period - 1 ? sum / period : null;
  });
}

export function buildEma(values: number[], period: number) {
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
      const seed =
        values.slice(0, period).reduce((total, current) => total + current, 0) /
        period;
      running = seed;
      return running;
    }

    running = value * multiplier + (running ?? value) * (1 - multiplier);
    return running;
  });
}

export function buildRsi(values: number[], period: number) {
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
  output[period] =
    averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);

  for (let index = period + 1; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    const gain = Math.max(delta, 0);
    const loss = Math.max(-delta, 0);
    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
    output[index] =
      averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  }

  return output;
}

export function buildMacd(values: number[]) {
  const ema12 = buildEma(values, 12).map(
    (value, index) => value ?? values[index],
  );
  const ema26 = buildEma(values, 26).map(
    (value, index) => value ?? values[index],
  );
  const macd = values.map((_, index) => ema12[index] - ema26[index]);
  const signal = buildEma(macd, 9).map((value) => value ?? null);
  const histogram = macd.map((value, index) =>
    signal[index] == null ? null : value - Number(signal[index]),
  );
  return { macd, signal, histogram };
}

export function buildVolatility(values: number[], period: number) {
  const returns = values.map((value, index) => {
    if (index === 0) return 0;
    return Math.log(value / Math.max(values[index - 1], 1));
  });

  return values.map((_, index) => {
    if (index < period) return null;
    const slice = returns.slice(index - period + 1, index + 1);
    const mean =
      slice.reduce((total, current) => total + current, 0) / slice.length;
    const variance =
      slice.reduce((total, current) => total + (current - mean) ** 2, 0) /
      slice.length;
    return Math.sqrt(variance) * Math.sqrt(12) * 100;
  });
}

export function buildDrawdown(values: number[]) {
  let peak = values[0] ?? 1;
  return values.map((value) => {
    peak = Math.max(peak, value);
    return (value / Math.max(peak, 1) - 1) * 100;
  });
}

export function rangeBoundsByYear<T extends { year: number }>(
  values: T[],
  startYear: number,
  endYear: number,
) {
  if (values.length === 0) {
    return { startIndex: 0, endIndex: 0 };
  }

  let startIndex = values.findIndex((value) => value.year >= startYear);
  if (startIndex === -1) {
    startIndex = 0;
  }

  let endIndex = values.length - 1;
  while (endIndex > startIndex && values[endIndex].year > endYear) {
    endIndex -= 1;
  }

  return { startIndex, endIndex: Math.max(endIndex, startIndex) };
}

export function zoomWindowFromPercent(
  length: number,
  startPercent: number,
  endPercent: number,
) {
  if (length <= 1) {
    return { startIndex: 0, endIndex: Math.max(length - 1, 0) };
  }

  const lastIndex = length - 1;
  const startIndex = clamp(
    Math.floor((startPercent / 100) * lastIndex),
    0,
    lastIndex,
  );
  const endIndex = clamp(
    Math.ceil((endPercent / 100) * lastIndex),
    startIndex,
    lastIndex,
  );
  return { startIndex, endIndex };
}

export function summarizeSeries(
  values: number[],
  labels: string[],
  years: number[],
) {
  if (!values.length) {
    return {
      cagr: null,
      totalMove: null,
      maxDrawdown: null,
      startLabel: "—",
      endLabel: "—",
      years: "—",
    };
  }

  const start = values[0] ?? 1;
  const end = values[values.length - 1] ?? start;
  const spanYears = Math.max(
    (years[years.length - 1] ?? years[0] ?? 0) - (years[0] ?? 0),
    1,
  );
  const cagr = (Math.pow(end / Math.max(start, 1), 1 / spanYears) - 1) * 100;
  const drawdowns = buildDrawdown(values);

  return {
    cagr,
    totalMove: (end / Math.max(start, 1) - 1) * 100,
    maxDrawdown: Math.min(...drawdowns),
    startLabel: labels[0] ?? "—",
    endLabel: labels[labels.length - 1] ?? "—",
    years: `${years[0] ?? "—"}–${years[years.length - 1] ?? "—"}`,
  };
}
