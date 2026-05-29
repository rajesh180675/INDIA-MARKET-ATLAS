// Monthly series algebra. Parallel to the annual Series but keyed on
// (year, month) — needed because the annual frequency suppresses volatility,
// truncates drawdowns, and prevents proper Sharpe estimation.
//
// Why a separate class instead of a generic Series<TKey>?
//
//   The math actually differs by frequency. Monthly volatility annualizes as
//   σ × √12; monthly CAGR uses ((1+r)^12 − 1); annualized Sharpe needs the
//   √n factor. A shared abstraction would push that complexity into every
//   callsite. Two narrow classes that share an interface shape is simpler
//   than one generic class that hides the frequency dimension.
//
// Encoding: MonthKey = year * 100 + month (1..12). Integer math, fast Map
// keys, natural sort order. 2024-03 → 202403. Pre-1900 dates not supported.

export type MonthKey = number;

/** Construct a MonthKey. Throws on invalid month. */
export function monthKey(year: number, month: number): MonthKey {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`month must be 1..12, got ${month}`);
  }
  if (!Number.isInteger(year) || year < 1900) {
    throw new RangeError(`year must be a 4-digit integer ≥ 1900, got ${year}`);
  }
  return year * 100 + month;
}

export function fromMonthKey(k: MonthKey): { year: number; month: number } {
  return { year: Math.floor(k / 100), month: k % 100 };
}

/** Number of full months between two keys (b - a). 2024-03 → 2024-06 = 3. */
export function monthsBetween(a: MonthKey, b: MonthKey): number {
  const A = fromMonthKey(a);
  const B = fromMonthKey(b);
  return (B.year - A.year) * 12 + (B.month - A.month);
}

/** Add `n` months to a key (n may be negative). */
export function addMonths(k: MonthKey, n: number): MonthKey {
  const { year, month } = fromMonthKey(k);
  const total = year * 12 + (month - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12 + 12) % 12 + 1;
  return monthKey(ny, nm);
}

export interface MonthPoint {
  key: MonthKey;
  value: number;
}

/** A month-indexed numeric series. Missing months are simply absent. */
export class MonthlySeries {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  private readonly map: Map<MonthKey, number>;
  private _keys: MonthKey[] | null = null;

  constructor(
    id: string,
    label: string,
    unit: string,
    points: ReadonlyArray<{ key: MonthKey; value: number | null }>,
  ) {
    this.id = id;
    this.label = label;
    this.unit = unit;
    this.map = new Map();
    for (const p of points) {
      if (p.value != null && Number.isFinite(p.value)) {
        this.map.set(p.key, p.value);
      }
    }
  }

  get keys(): MonthKey[] {
    if (!this._keys) {
      this._keys = Array.from(this.map.keys()).sort((a, b) => a - b);
    }
    return this._keys;
  }

  get points(): MonthPoint[] {
    return this.keys.map((key) => ({ key, value: this.map.get(key)! }));
  }

  get firstKey(): MonthKey | undefined {
    return this.keys[0];
  }

  get lastKey(): MonthKey | undefined {
    const ks = this.keys;
    return ks[ks.length - 1];
  }

  get length(): number {
    return this.map.size;
  }

  at(key: MonthKey): number | undefined {
    return this.map.get(key);
  }

  has(key: MonthKey): boolean {
    return this.map.has(key);
  }

  /** Inclusive [from, to] window. */
  window(from: MonthKey, to: MonthKey): MonthlySeries {
    return new MonthlySeries(
      this.id,
      this.label,
      this.unit,
      this.points.filter((p) => p.key >= from && p.key <= to),
    );
  }

  /** Map values, preserving keys. */
  mapValues(
    fn: (value: number, key: MonthKey) => number,
    opts?: { unit?: string; label?: string },
  ): MonthlySeries {
    return new MonthlySeries(
      this.id,
      opts?.label ?? this.label,
      opts?.unit ?? this.unit,
      this.points.map((p) => ({ key: p.key, value: fn(p.value, p.key) })),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Frequency-correct primitives
// ─────────────────────────────────────────────────────────────────────────

/**
 * CAGR (in percent) computed from monthly observations. Uses actual elapsed
 * months between the endpoints rather than assuming evenly spaced data.
 *
 *   CAGR = ((end / start)^(12 / months) - 1) * 100
 *
 * Returns percentage to match the annual `cagr()` API and `rollingMonthlyCagr`.
 */
export function monthlyCagr(
  series: MonthlySeries,
  from: MonthKey,
  to: MonthKey,
): number | null {
  const start = series.at(from);
  const end = series.at(to);
  if (start == null || end == null || start <= 0 || end <= 0) return null;
  const months = monthsBetween(from, to);
  if (months <= 0) return null;
  return (Math.pow(end / start, 12 / months) - 1) * 100;
}

/** Total return (in percent) from start to end. */
export function monthlyTotalReturn(
  series: MonthlySeries,
  from: MonthKey,
  to: MonthKey,
): number | null {
  const start = series.at(from);
  const end = series.at(to);
  if (start == null || end == null || start <= 0) return null;
  return (end / start - 1) * 100;
}

/**
 * Period-over-period log returns for each consecutive pair of months.
 * Log returns are used (rather than simple returns) because they sum cleanly
 * across months and are the conventional input to vol/Sharpe calculations.
 */
export function monthlyLogReturns(series: MonthlySeries): MonthlySeries {
  const pts = series.points;
  const out: MonthPoint[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1].value;
    const b = pts[i].value;
    if (a > 0 && b > 0) {
      out.push({ key: pts[i].key, value: Math.log(b / a) });
    }
  }
  return new MonthlySeries(
    `${series.id}:log-ret`,
    `${series.label} (log return)`,
    "log return",
    out,
  );
}

/**
 * Annualized volatility from monthly observations.
 *
 *   σ_annual = σ_monthly × √12
 *
 * Returns the volatility of LOG returns (the conventional definition).
 * Window-restrict the series first if you want a sub-period.
 */
export function annualizedVolatility(series: MonthlySeries): number | null {
  const rets = monthlyLogReturns(series).points.map((p) => p.value);
  if (rets.length < 2) return null;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance =
    rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(12);
}

/**
 * Annualized Sharpe ratio from monthly observations.
 *
 *   Sharpe = (annualized excess return) / (annualized volatility)
 *
 * `riskFreePct` is the annual risk-free rate in percent (e.g. 6 = 6%).
 * Excess returns are computed in log space, then annualized as mean × 12.
 */
export function annualizedSharpe(
  series: MonthlySeries,
  riskFreePct = 6,
): number | null {
  const rets = monthlyLogReturns(series).points.map((p) => p.value);
  if (rets.length < 2) return null;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance =
    rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  const sd = Math.sqrt(variance);
  if (sd === 0) return null;
  // Convert annual risk-free pct to monthly log-equivalent
  const rfMonthly = Math.log(1 + riskFreePct / 100) / 12;
  const annualizedExcess = (mean - rfMonthly) * 12;
  const annualizedSd = sd * Math.sqrt(12);
  return annualizedExcess / annualizedSd;
}

export interface MonthlyDrawdownPoint {
  key: MonthKey;
  drawdown: number; // negative percentage from running peak
}

/**
 * Drawdown series from running peak. Far more honest than annual drawdowns —
 * captures intra-month troughs that annual data smooths over.
 */
export function monthlyDrawdownSeries(
  series: MonthlySeries,
): MonthlyDrawdownPoint[] {
  let peak = -Infinity;
  return series.points.map(({ key, value }) => {
    peak = Math.max(peak, value);
    return {
      key,
      drawdown: peak > 0 ? (value / peak - 1) * 100 : 0,
    };
  });
}

/**
 * Rolling N-month CAGR. Each output point is the annualized return over the
 * trailing `windowMonths` window ending at that month.
 */
export function rollingMonthlyCagr(
  series: MonthlySeries,
  windowMonths: number,
): MonthlySeries {
  const pts = series.points;
  const out: MonthPoint[] = [];
  for (let i = windowMonths; i < pts.length; i++) {
    const start = pts[i - windowMonths].value;
    const end = pts[i].value;
    if (start > 0 && end > 0) {
      out.push({
        key: pts[i].key,
        value: (Math.pow(end / start, 12 / windowMonths) - 1) * 100,
      });
    }
  }
  return new MonthlySeries(
    `${series.id}:rolling-cagr-${windowMonths}m`,
    `${series.label} (rolling ${windowMonths}M CAGR %)`,
    "% annualized",
    out,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Cross-frequency helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Resample a monthly series to annual. Aggregation methods:
 *   - "last": end-of-year value (December if present, else latest in year)
 *   - "avg":  arithmetic mean of all months in that year
 *   - "sum":  sum of months in that year (for flow series like inflation)
 *
 * Returns plain {year, value}[] suitable for passing to the annual Series
 * constructor — keeps this module's import surface minimal (no dep on series.ts).
 */
export function toAnnualPoints(
  series: MonthlySeries,
  aggregation: "last" | "avg" | "sum",
): Array<{ year: number; value: number }> {
  const byYear = new Map<number, number[]>();
  for (const { key, value } of series.points) {
    const { year } = fromMonthKey(key);
    const arr = byYear.get(year) ?? [];
    arr.push(value);
    byYear.set(year, arr);
  }
  const out: Array<{ year: number; value: number }> = [];
  Array.from(byYear.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([year, vals]) => {
      let v: number;
      if (aggregation === "last") v = vals[vals.length - 1];
      else if (aggregation === "sum") v = vals.reduce((s, x) => s + x, 0);
      else v = vals.reduce((s, x) => s + x, 0) / vals.length;
      out.push({ year, value: v });
    });
  return out;
}
