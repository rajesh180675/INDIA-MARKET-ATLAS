import { describe, expect, it } from "vitest";
import {
  Series,
  cagr,
  deflate,
  denominate,
  drawdownSeries,
  priceLevelFromInflation,
  rollingCagr,
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
});
