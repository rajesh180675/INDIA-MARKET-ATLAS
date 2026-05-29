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
  private _years: Year[] | null = null;

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
    if (!this._years) this._years = Array.from(this.map.keys()).sort((a, b) => a - b);
    return this._years;
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
 * Compound an initial value through an annual-rate series. Each year y has
 * value[y] = value[y-1] * (1 + rate[y]/100). Anchored at baseYear with
 * baseValue (default 100). Used to model FD growth from a policy-rate series,
 * notional savings, etc.
 */
export function compoundAtRate(
  ratePct: Series,
  baseYear: Year,
  opts: { id?: string; label?: string; baseValue?: number } = {},
): Series {
  const baseValue = opts.baseValue ?? 100;
  const years = ratePct.years.slice().sort((a, b) => a - b);
  const out = new Map<Year, number>();
  out.set(baseYear, baseValue);

  // Forward from baseYear: each year applies that year's rate
  let prev = baseValue;
  for (const y of years) {
    if (y <= baseYear) continue;
    const r = ratePct.at(y) ?? 0;
    prev = prev * (1 + r / 100);
    out.set(y, prev);
  }
  // Backward from baseYear: undo the rate applied for that year
  prev = baseValue;
  for (const y of years.slice().reverse()) {
    if (y >= baseYear) continue;
    const rNext = ratePct.at(y + 1) ?? ratePct.at(y) ?? 0;
    const next = out.get(y + 1) ?? prev;
    prev = next / (1 + rNext / 100);
    out.set(y, prev);
  }

  return new Series(
    opts.id ?? `${ratePct.id}-compounded`,
    opts.label ?? `${ratePct.label} compounded`,
    `value (${baseYear}=${baseValue})`,
    Array.from(out.entries()).map(([year, value]) => ({ year, value })),
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

/**
 * Pearson correlation coefficient between two series, computed on the
 * intersection of their year domains. Returns null if fewer than 2 paired
 * observations exist or either series has zero variance.
 */
export function pearson(a: Series, b: Series, from?: Year, to?: Year): number | null {
  const aw = from != null && to != null ? a.window(from, to) : a;
  const bw = from != null && to != null ? b.window(from, to) : b;
  const ays = new Set(aw.years);
  const pairs: Array<[number, number]> = [];
  for (const y of bw.years) {
    if (!ays.has(y)) continue;
    const av = aw.at(y);
    const bv = bw.at(y);
    if (av != null && bv != null) pairs.push([av, bv]);
  }
  if (pairs.length < 2) return null;
  const n = pairs.length;
  const meanA = pairs.reduce((s, [x]) => s + x, 0) / n;
  const meanB = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let num = 0;
  let varA = 0;
  let varB = 0;
  for (const [x, y] of pairs) {
    const dx = x - meanA;
    const dy = y - meanB;
    num += dx * dy;
    varA += dx * dx;
    varB += dy * dy;
  }
  if (varA === 0 || varB === 0) return null;
  return num / Math.sqrt(varA * varB);
}

/**
 * Build an N×N correlation matrix between a list of series, computed on the
 * shared intersection window (or a passed-in [from, to]). Returns long-form
 * rows {a, b, r} suitable for a Plot cell heatmap.
 */
export function correlationMatrix(
  serieses: Series[],
  from?: Year,
  to?: Year,
): Array<{ a: string; aLabel: string; b: string; bLabel: string; r: number | null }> {
  const out: Array<{ a: string; aLabel: string; b: string; bLabel: string; r: number | null }> = [];
  for (const a of serieses) {
    for (const b of serieses) {
      out.push({
        a: a.id,
        aLabel: a.label,
        b: b.id,
        bLabel: b.label,
        r: a.id === b.id ? 1 : pearson(a, b, from, to),
      });
    }
  }
  return out;
}

export interface SipResult {
  startYear: Year;
  endYear: Year;
  yearsInvested: number;
  totalContributed: number;
  /** Total terminal wealth from SIP (₹1 invested at the start of each year). */
  sipFinalValue: number;
  /** Multiple over total contributed: sipFinalValue / totalContributed. */
  sipMultiple: number;
  /** Internal rate of return for the SIP cash-flow stream (annualized %). */
  sipIrrPct: number | null;
  /** Lumpsum: same total contributed, all in at startYear. */
  lumpsumFinalValue: number;
  lumpsumMultiple: number;
  lumpsumCagrPct: number | null;
  /** SIP advantage vs lumpsum (positive = SIP won, negative = lumpsum won). */
  sipAdvantagePct: number;
}

/**
 * SIP simulation on a price-level series. ₹1 invested at the start of each
 * year from startYear to endYear (inclusive); compared to a lumpsum of equal
 * total amount placed entirely at startYear.
 *
 * Returns null if the series doesn't cover the window.
 */
export function sipReturns(price: Series, startYear: Year, endYear: Year): SipResult | null {
  if (endYear <= startYear) return null;
  const startPrice = price.at(startYear);
  const endPrice = price.at(endYear);
  if (startPrice == null || endPrice == null || startPrice <= 0) return null;

  const yearsInvested = endYear - startYear + 1;
  const totalContributed = yearsInvested;

  // SIP: ₹1 each year y grows to (endPrice / priceAt(y))
  let sipFinalValue = 0;
  for (let y = startYear; y <= endYear; y++) {
    const py = price.at(y);
    if (py == null || py <= 0) return null;
    sipFinalValue += endPrice / py;
  }
  const sipMultiple = sipFinalValue / totalContributed;

  // SIP IRR: solve f(r) = Σ_y (1+r)^(endYear - y) − sipFinalValue = 0
  // Bisection on r ∈ [-99%, +500%]
  function npv(r: number): number {
    let s = 0;
    for (let y = startYear; y <= endYear; y++) {
      s += Math.pow(1 + r, endYear - y);
    }
    return s - sipFinalValue;
  }
  let lo = -0.99;
  let hi = 5;
  let sipIrrPct: number | null = null;
  // Make sure there's a sign change
  if (npv(lo) * npv(hi) < 0) {
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (npv(mid) < 0) lo = mid;
      else hi = mid;
    }
    sipIrrPct = ((lo + hi) / 2) * 100;
  }

  // Lumpsum: same totalContributed, all at startYear, hold to endYear
  const lumpsumFinalValue = totalContributed * (endPrice / startPrice);
  const lumpsumMultiple = endPrice / startPrice;
  const lumpsumCagrPct = cagr(price, startYear, endYear);

  const sipAdvantagePct =
    ((sipFinalValue - lumpsumFinalValue) / lumpsumFinalValue) * 100;

  return {
    startYear,
    endYear,
    yearsInvested,
    totalContributed,
    sipFinalValue,
    sipMultiple,
    sipIrrPct,
    lumpsumFinalValue,
    lumpsumMultiple,
    lumpsumCagrPct,
    sipAdvantagePct,
  };
}
