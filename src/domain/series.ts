// Core series algebra for the India Market Atlas research console.
//
// A Series is a sparse, year-keyed numeric vector. Every analytical figure in
// the app is DERIVED from these primitives — nothing downstream hardcodes a
// CAGR, a real-return, or a drawdown. Add a year or an indicator to the raw
// data modules and every view recomputes.

export type Year = number;

export interface Point {
  year: Year;
  value: number;
}

/** A named, year-indexed numeric series. Missing years are simply absent. */
export class Series {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  private readonly map: Map<Year, number>;

  constructor(
    id: string,
    label: string,
    unit: string,
    points: ReadonlyArray<{ year: Year; value: number | null }>,
  ) {
    this.id = id;
    this.label = label;
    this.unit = unit;
    this.map = new Map();
    for (const p of points) {
      if (p.value != null && Number.isFinite(p.value)) {
        this.map.set(p.year, p.value);
      }
    }
  }

  get years(): Year[] {
    return Array.from(this.map.keys()).sort((a, b) => a - b);
  }

  get points(): Point[] {
    return this.years.map((year) => ({ year, value: this.map.get(year)! }));
  }

  get firstYear(): Year | undefined {
    return this.years[0];
  }

  get lastYear(): Year | undefined {
    const ys = this.years;
    return ys[ys.length - 1];
  }

  at(year: Year): number | undefined {
    return this.map.get(year);
  }

  has(year: Year): boolean {
    return this.map.has(year);
  }

  /** Restrict to an inclusive [from, to] year window. */
  window(from: Year, to: Year): Series {
    return new Series(
      this.id,
      this.label,
      this.unit,
      this.points.filter((p) => p.year >= from && p.year <= to),
    );
  }

  /** Map values, preserving years. */
  mapValues(fn: (value: number, year: Year) => number, opts?: { unit?: string; label?: string }): Series {
    return new Series(
      this.id,
      opts?.label ?? this.label,
      opts?.unit ?? this.unit,
      this.points.map((p) => ({ year: p.year, value: fn(p.value, p.year) })),
    );
  }

  /**
   * Rebase the series so that `baseValue` is assigned at `baseYear`, scaling
   * all other points proportionally. If baseYear is absent, the nearest later
   * year is used as the anchor.
   */
  rebase(baseYear: Year, baseValue = 100): Series {
    const anchor = this.at(baseYear) ?? this.firstOnOrAfter(baseYear);
    if (anchor == null || anchor === 0) return this;
    return this.mapValues((v) => (v / anchor) * baseValue, {
      unit: `index (${baseYear}=${baseValue})`,
    });
  }

  private firstOnOrAfter(year: Year): number | undefined {
    for (const y of this.years) if (y >= year) return this.map.get(y);
    return undefined;
  }
}

/** Build a CPI price-level series (base year = 100) by compounding annual CPI %. */
export function priceLevelFromInflation(
  inflationPct: Series,
  baseYear: Year,
): Series {
  const years = inflationPct.years;
  const level = new Map<Year, number>();
  // Anchor base year at 100, walk forward and backward.
  level.set(baseYear, 100);
  const sorted = years.slice().sort((a, b) => a - b);

  // Forward from baseYear
  let prev = 100;
  for (const y of sorted) {
    if (y <= baseYear) continue;
    const infl = inflationPct.at(y) ?? 0;
    prev = prev * (1 + infl / 100);
    level.set(y, prev);
  }
  // Backward from baseYear
  prev = 100;
  for (const y of sorted.slice().reverse()) {
    if (y >= baseYear) continue;
    // value[y] such that value[y]*(1+infl[y+1]/100)=value[y+1]; simpler: use infl[y]
    const inflNext = inflationPct.at(y + 1) ?? inflationPct.at(y) ?? 0;
    const next = level.get(y + 1) ?? prev;
    prev = next / (1 + inflNext / 100);
    level.set(y, prev);
  }

  return new Series(
    "cpi-level",
    "CPI Price Level",
    `index (${baseYear}=100)`,
    Array.from(level.entries()).map(([year, value]) => ({ year, value })),
  );
}

/**
 * Deflate a nominal series into real terms using a price-level series, then
 * rebase real values to the chosen base year so the chart starts at 100.
 */
export function deflate(nominal: Series, priceLevel: Series, baseYear: Year): Series {
  const baseLevel = priceLevel.at(baseYear);
  if (baseLevel == null) return nominal;
  return nominal
    .mapValues((v, y) => {
      const level = priceLevel.at(y);
      if (level == null) return NaN;
      return v * (baseLevel / level);
    })
    .rebase(baseYear);
}

/**
 * Express an INR-denominated series in a foreign/asset unit by dividing by a
 * conversion series (e.g. USD/INR, or gold INR/10g), then rebase to baseYear.
 */
export function denominate(inr: Series, converter: Series, baseYear: Year): Series {
  return inr
    .mapValues((v, y) => {
      const c = converter.at(y);
      if (c == null || c === 0) return NaN;
      return v / c;
    })
    .rebase(baseYear);
}

/** Compound annual growth rate (%) between two years of a series. */
export function cagr(series: Series, from: Year, to: Year): number | null {
  const start = series.at(from);
  const end = series.at(to);
  if (start == null || end == null || start <= 0 || to <= from) return null;
  return (Math.pow(end / start, 1 / (to - from)) - 1) * 100;
}

/** Total return multiple (end / start) between two years. */
export function totalReturn(series: Series, from: Year, to: Year): number | null {
  const start = series.at(from);
  const end = series.at(to);
  if (start == null || end == null || start <= 0) return null;
  return end / start;
}

/** Year-over-year percentage change series. */
export function yoy(series: Series): Series {
  const pts: Point[] = [];
  const ys = series.years;
  for (let i = 1; i < ys.length; i++) {
    const prev = series.at(ys[i - 1])!;
    const cur = series.at(ys[i])!;
    if (prev !== 0) pts.push({ year: ys[i], value: ((cur - prev) / prev) * 100 });
  }
  return new Series(`${series.id}-yoy`, `${series.label} YoY`, "% YoY", pts);
}

/** Rolling N-year CAGR series (labelled at the window end year). */
export function rollingCagr(series: Series, windowYears: number): Series {
  const pts: Point[] = [];
  for (const end of series.years) {
    const start = end - windowYears;
    const c = cagr(series, start, end);
    if (c != null) pts.push({ year: end, value: c });
  }
  return new Series(
    `${series.id}-roll${windowYears}`,
    `${windowYears}Y rolling CAGR`,
    "% CAGR",
    pts,
  );
}

export interface DrawdownPoint {
  year: Year;
  value: number;
  peak: number;
  drawdownPct: number; // <= 0
}

/** Running peak-to-trough drawdown (%) at each year. */
export function drawdownSeries(series: Series): DrawdownPoint[] {
  let peak = -Infinity;
  return series.points.map((p) => {
    peak = Math.max(peak, p.value);
    const drawdownPct = peak > 0 ? ((p.value - peak) / peak) * 100 : 0;
    return { year: p.year, value: p.value, peak, drawdownPct };
  });
}

/** Annualized volatility proxy: stdev of YoY returns over a window. */
export function volatility(series: Series, from: Year, to: Year): number | null {
  const rets = yoy(series)
    .window(from, to)
    .points.map((p) => p.value);
  if (rets.length < 2) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance);
}

/** Sharpe-like ratio: (mean YoY return − riskFree) / stdev of YoY returns. */
export function sharpe(series: Series, from: Year, to: Year, riskFreePct = 6): number | null {
  const rets = yoy(series)
    .window(from, to)
    .points.map((p) => p.value);
  if (rets.length < 2) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const vol = volatility(series, from, to);
  if (vol == null || vol === 0) return null;
  return (mean - riskFreePct) / vol;
}

/**
 * Align multiple series onto a shared year axis (intersection by default,
 * or union with nulls). Returns rows suitable for tabular/Plot consumption.
 */
export function alignSeries(
  serieses: Series[],
  mode: "intersection" | "union" = "union",
): Array<Record<string, number | null> & { year: Year }> {
  const yearSets = serieses.map((s) => new Set(s.years));
  let years: Year[];
  if (mode === "intersection") {
    years = serieses[0]?.years.filter((y) => yearSets.every((set) => set.has(y))) ?? [];
  } else {
    const all = new Set<Year>();
    serieses.forEach((s) => s.years.forEach((y) => all.add(y)));
    years = Array.from(all).sort((a, b) => a - b);
  }
  return years.map((year) => {
    const row: Record<string, number | null> & { year: Year } = { year };
    serieses.forEach((s) => {
      row[s.id] = s.at(year) ?? null;
    });
    return row;
  });
}
