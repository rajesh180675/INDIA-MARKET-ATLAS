import { describe, expect, it } from "vitest";
import {
  Series,
  cagr,
  compoundAtRate,
  correlationMatrix,
  deflate,
  denominate,
  drawdownSeries,
  pearson,
  priceLevelFromInflation,
  rollingCagr,
  sipReturns,
  totalReturn,
  yoy,
} from "./series";

const mk = (pts: Array<[number, number | null]>) =>
  new Series("t", "Test", "u", pts.map(([year, value]) => ({ year, value })));

describe("Series basics", () => {
  it("drops null/non-finite values and sorts years", () => {
    const s = mk([
      [2000, 10],
      [1999, null],
      [2001, 20],
    ]);
    expect(s.years).toEqual([2000, 2001]);
    expect(s.at(1999)).toBeUndefined();
  });

  it("rebases to a base year = 100", () => {
    const s = mk([
      [2000, 50],
      [2001, 100],
      [2002, 25],
    ]).rebase(2000, 100);
    expect(s.at(2000)).toBeCloseTo(100);
    expect(s.at(2001)).toBeCloseTo(200);
    expect(s.at(2002)).toBeCloseTo(50);
  });

  it("windows inclusively", () => {
    const s = mk([
      [2000, 1],
      [2001, 2],
      [2002, 3],
      [2003, 4],
    ]).window(2001, 2002);
    expect(s.years).toEqual([2001, 2002]);
  });
});

describe("growth math", () => {
  it("computes CAGR correctly (doubling over 2 years)", () => {
    const s = mk([
      [2000, 100],
      [2002, 400],
    ]);
    // 400/100 = 4x over 2 years => 100% CAGR
    expect(cagr(s, 2000, 2002)).toBeCloseTo(100, 5);
  });

  it("computes total return multiple", () => {
    const s = mk([
      [2000, 100],
      [2010, 250],
    ]);
    expect(totalReturn(s, 2000, 2010)).toBeCloseTo(2.5);
  });

  it("computes YoY % changes", () => {
    const s = mk([
      [2000, 100],
      [2001, 110],
      [2002, 99],
    ]);
    const y = yoy(s);
    expect(y.at(2001)).toBeCloseTo(10);
    expect(y.at(2002)).toBeCloseTo(-10);
  });

  it("computes rolling N-year CAGR labelled at window end", () => {
    const s = mk([
      [2000, 100],
      [2001, 200],
      [2002, 400],
    ]);
    const r = rollingCagr(s, 1);
    expect(r.at(2001)).toBeCloseTo(100);
    expect(r.at(2002)).toBeCloseTo(100);
    expect(r.at(2000)).toBeUndefined();
  });
});

describe("drawdowns", () => {
  it("tracks running peak and drawdown %", () => {
    const dd = drawdownSeries(
      mk([
        [2000, 100],
        [2001, 120],
        [2002, 60],
        [2003, 90],
      ]),
    );
    expect(dd[1].drawdownPct).toBeCloseTo(0); // new peak
    expect(dd[2].drawdownPct).toBeCloseTo(-50); // 60 vs peak 120
    expect(dd[3].drawdownPct).toBeCloseTo(-25); // 90 vs peak 120
  });
});

describe("real / denominated transforms", () => {
  it("builds a CPI price level by compounding inflation", () => {
    const infl = mk([
      [2000, 0],
      [2001, 10],
      [2002, 10],
    ]);
    const level = priceLevelFromInflation(infl, 2000);
    expect(level.at(2000)).toBeCloseTo(100);
    expect(level.at(2001)).toBeCloseTo(110);
    expect(level.at(2002)).toBeCloseTo(121);
  });

  it("deflate removes inflation: equal nominal+inflation => flat real", () => {
    const nominal = mk([
      [2000, 100],
      [2001, 110],
      [2002, 121],
    ]);
    const infl = mk([
      [2000, 0],
      [2001, 10],
      [2002, 10],
    ]);
    const level = priceLevelFromInflation(infl, 2000);
    const real = deflate(nominal, level, 2000);
    // nominal grew exactly with inflation => real index stays at 100
    expect(real.at(2000)).toBeCloseTo(100);
    expect(real.at(2001)).toBeCloseTo(100);
    expect(real.at(2002)).toBeCloseTo(100);
  });

  it("denominate converts by a divisor series and rebases", () => {
    const inr = mk([
      [2000, 100],
      [2001, 200],
    ]);
    const fx = mk([
      [2000, 10],
      [2001, 10],
    ]);
    // 100/10=10, 200/10=20 => rebased: 100, 200
    const usd = denominate(inr, fx, 2000);
    expect(usd.at(2000)).toBeCloseTo(100);
    expect(usd.at(2001)).toBeCloseTo(200);
  });

  it("compoundAtRate grows base value by an annual rate series", () => {
    const rate = mk([
      [2000, 0],
      [2001, 10],
      [2002, 5],
    ]);
    const grown = compoundAtRate(rate, 2000, { baseValue: 100 });
    expect(grown.at(2000)).toBeCloseTo(100);
    expect(grown.at(2001)).toBeCloseTo(110);
    expect(grown.at(2002)).toBeCloseTo(115.5);
  });

  it("compoundAtRate is consistent with priceLevelFromInflation when inputs match", () => {
    const infl = mk([
      [2000, 0],
      [2001, 7],
      [2002, 7],
    ]);
    const compounded = compoundAtRate(infl, 2000, { baseValue: 100 });
    const level = priceLevelFromInflation(infl, 2000);
    expect(compounded.at(2002)).toBeCloseTo(level.at(2002)!);
  });
});

describe("correlation", () => {
  it("pearson(x, x) = 1 for any non-constant series", () => {
    const x = mk([
      [2000, 1],
      [2001, 2],
      [2002, 3],
      [2003, 5],
    ]);
    expect(pearson(x, x)).toBeCloseTo(1);
  });

  it("pearson detects perfect anti-correlation", () => {
    const x = mk([
      [2000, 1],
      [2001, 2],
      [2002, 3],
    ]);
    const y = mk([
      [2000, 6],
      [2001, 4],
      [2002, 2],
    ]);
    expect(pearson(x, y)).toBeCloseTo(-1);
  });

  it("pearson returns null on zero-variance series", () => {
    const flat = mk([
      [2000, 5],
      [2001, 5],
      [2002, 5],
    ]);
    const x = mk([
      [2000, 1],
      [2001, 2],
      [2002, 3],
    ]);
    expect(pearson(flat, x)).toBeNull();
  });

  it("pearson honors the [from, to] window", () => {
    const x = mk([
      [2000, 1],
      [2001, 2],
      [2002, 3],
      [2003, 4],
    ]);
    const y = mk([
      [2000, 4],
      [2001, 3],
      [2002, 2],
      [2003, 1],
    ]);
    // Full range: -1
    expect(pearson(x, y)).toBeCloseTo(-1);
    // Subset 2000-2001 still anti-correlated
    expect(pearson(x, y, 2000, 2001)).toBeCloseTo(-1);
  });

  it("correlationMatrix is N*N with diagonal = 1", () => {
    const x = mk([[2000, 1], [2001, 2], [2002, 3]]);
    const y = mk([[2000, 2], [2001, 4], [2002, 6]]);
    const m = correlationMatrix([x, y]);
    expect(m).toHaveLength(4);
    const diag = m.filter((c) => c.a === c.b);
    expect(diag.every((c) => c.r === 1)).toBe(true);
  });
});

describe("sipReturns", () => {
  it("on a flat series, SIP and lumpsum both break even", () => {
    const flat = mk([
      [2000, 100],
      [2001, 100],
      [2002, 100],
      [2003, 100],
    ]);
    const r = sipReturns(flat, 2000, 2003)!;
    expect(r.sipMultiple).toBeCloseTo(1);
    expect(r.lumpsumMultiple).toBeCloseTo(1);
    expect(r.sipIrrPct).toBeCloseTo(0);
    expect(r.sipAdvantagePct).toBeCloseTo(0);
  });

  it("on a steadily rising series, lumpsum beats SIP", () => {
    // Doubles each year: SIP buys later units at higher prices, lumpsum
    // captures all the early growth.
    const rising = mk([
      [2000, 100],
      [2001, 200],
      [2002, 400],
      [2003, 800],
    ]);
    const r = sipReturns(rising, 2000, 2003)!;
    expect(r.lumpsumFinalValue).toBeGreaterThan(r.sipFinalValue);
    expect(r.sipAdvantagePct).toBeLessThan(0);
  });

  it("on a V-shaped series, SIP can beat lumpsum (rupee-cost averaging)", () => {
    // Crashes 80% then fully recovers: lumpsum just breaks even, SIP buys
    // more units at the bottom.
    const v = mk([
      [2000, 100],
      [2001, 20],
      [2002, 100],
    ]);
    const r = sipReturns(v, 2000, 2002)!;
    expect(r.lumpsumMultiple).toBeCloseTo(1);
    expect(r.sipMultiple).toBeGreaterThan(1);
    expect(r.sipAdvantagePct).toBeGreaterThan(0);
  });

  it("returns null for invalid windows or missing data", () => {
    const s = mk([[2000, 100], [2001, 110]]);
    expect(sipReturns(s, 2001, 2000)).toBeNull(); // end ≤ start
    expect(sipReturns(s, 2000, 2005)).toBeNull(); // missing end
  });
});
