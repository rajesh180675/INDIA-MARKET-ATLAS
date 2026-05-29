import { describe, expect, it } from "vitest";
import {
  MonthlySeries,
  addMonths,
  annualizedSharpe,
  annualizedVolatility,
  fromMonthKey,
  monthKey,
  monthlyCagr,
  monthlyDrawdownSeries,
  monthlyLogReturns,
  monthlyTotalReturn,
  monthsBetween,
  rollingMonthlyCagr,
  toAnnualPoints,
} from "./monthly";

describe("MonthKey", () => {
  it("encodes year and month into a sortable integer", () => {
    expect(monthKey(2024, 3)).toBe(202403);
    expect(monthKey(1979, 1)).toBe(197901);
    expect(monthKey(2024, 12)).toBe(202412);
  });

  it("rejects invalid months", () => {
    expect(() => monthKey(2024, 0)).toThrow();
    expect(() => monthKey(2024, 13)).toThrow();
    expect(() => monthKey(2024, 1.5)).toThrow();
  });

  it("rejects pre-1900 years", () => {
    expect(() => monthKey(1899, 6)).toThrow();
  });

  it("decodes back to year/month", () => {
    expect(fromMonthKey(202403)).toEqual({ year: 2024, month: 3 });
    expect(fromMonthKey(197901)).toEqual({ year: 1979, month: 1 });
  });

  it("MonthKey ordering matches calendar ordering", () => {
    expect(monthKey(2023, 12) < monthKey(2024, 1)).toBe(true);
    expect(monthKey(2024, 3) < monthKey(2024, 4)).toBe(true);
  });
});

describe("monthsBetween / addMonths", () => {
  it("monthsBetween counts elapsed months", () => {
    expect(monthsBetween(monthKey(2024, 3), monthKey(2024, 6))).toBe(3);
    expect(monthsBetween(monthKey(2023, 11), monthKey(2024, 2))).toBe(3);
    expect(monthsBetween(monthKey(2020, 1), monthKey(2025, 1))).toBe(60);
  });

  it("addMonths handles year rollover both ways", () => {
    expect(addMonths(monthKey(2024, 11), 3)).toBe(monthKey(2025, 2));
    expect(addMonths(monthKey(2024, 2), -3)).toBe(monthKey(2023, 11));
    expect(addMonths(monthKey(2024, 6), 0)).toBe(monthKey(2024, 6));
  });
});

describe("MonthlySeries", () => {
  const mk = (rows: Array<[number, number, number | null]>) =>
    new MonthlySeries(
      "test",
      "Test series",
      "value",
      rows.map(([y, m, v]) => ({ key: monthKey(y, m), value: v })),
    );

  it("filters out null and non-finite values at construction", () => {
    const s = mk([
      [2024, 1, 100],
      [2024, 2, null],
      [2024, 3, NaN],
      [2024, 4, Infinity],
      [2024, 5, 110],
    ]);
    expect(s.length).toBe(2);
    expect(s.has(monthKey(2024, 2))).toBe(false);
    expect(s.has(monthKey(2024, 5))).toBe(true);
  });

  it("keys are sorted ascending regardless of input order", () => {
    const s = mk([
      [2024, 5, 110],
      [2024, 1, 100],
      [2024, 3, 105],
    ]);
    expect(s.keys).toEqual([
      monthKey(2024, 1),
      monthKey(2024, 3),
      monthKey(2024, 5),
    ]);
  });

  it("window restricts to inclusive [from, to]", () => {
    const s = mk([
      [2023, 12, 1],
      [2024, 1, 2],
      [2024, 6, 3],
      [2024, 12, 4],
      [2025, 1, 5],
    ]);
    const w = s.window(monthKey(2024, 1), monthKey(2024, 12));
    expect(w.length).toBe(3);
    expect(w.firstKey).toBe(monthKey(2024, 1));
    expect(w.lastKey).toBe(monthKey(2024, 12));
  });
});

describe("monthlyCagr / monthlyTotalReturn", () => {
  it("a series doubling over 12 months gives CAGR ≈ 100%", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2024, 1), value: 100 },
      { key: monthKey(2025, 1), value: 200 },
    ]);
    const c = monthlyCagr(s, monthKey(2024, 1), monthKey(2025, 1));
    expect(c).toBeCloseTo(1.0, 5);
  });

  it("a series unchanged over 24 months gives CAGR = 0", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2020, 1), value: 50 },
      { key: monthKey(2022, 1), value: 50 },
    ]);
    expect(monthlyCagr(s, monthKey(2020, 1), monthKey(2022, 1))).toBe(0);
  });

  it("CAGR over 6 months annualizes correctly: 1.10 over 6m → ~21%", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2024, 1), value: 100 },
      { key: monthKey(2024, 7), value: 110 },
    ]);
    // (1.10)^(12/6) - 1 = 1.21 - 1 = 0.21
    const c = monthlyCagr(s, monthKey(2024, 1), monthKey(2024, 7));
    expect(c).toBeCloseTo(0.21, 5);
  });

  it("returns null for missing endpoints or non-positive values", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2024, 1), value: 100 },
    ]);
    expect(monthlyCagr(s, monthKey(2024, 1), monthKey(2025, 1))).toBeNull();
  });

  it("totalReturn is end/start - 1, no annualization", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2024, 1), value: 100 },
      { key: monthKey(2024, 7), value: 110 },
    ]);
    expect(
      monthlyTotalReturn(s, monthKey(2024, 1), monthKey(2024, 7)),
    ).toBeCloseTo(0.1, 10);
  });
});

describe("monthlyLogReturns", () => {
  it("log returns sum to log(end/start)", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2024, 1), value: 100 },
      { key: monthKey(2024, 2), value: 105 },
      { key: monthKey(2024, 3), value: 110 },
      { key: monthKey(2024, 4), value: 120 },
    ]);
    const rets = monthlyLogReturns(s).points.map((p) => p.value);
    const sum = rets.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(Math.log(120 / 100), 10);
  });

  it("first month has no log return (no prior point)", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2024, 1), value: 100 },
      { key: monthKey(2024, 2), value: 105 },
    ]);
    expect(monthlyLogReturns(s).length).toBe(1);
  });
});

describe("annualizedVolatility", () => {
  it("zero-variance series has zero vol", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2024, 1), value: 100 },
      { key: monthKey(2024, 2), value: 100 },
      { key: monthKey(2024, 3), value: 100 },
      { key: monthKey(2024, 4), value: 100 },
    ]);
    expect(annualizedVolatility(s)).toBe(0);
  });

  it("annualizes monthly stdev by √12", () => {
    // Construct series with monthly log returns of fixed magnitude alternating ±0.01
    // sample stdev (n-1) for [0.01,-0.01,0.01,-0.01,...] with mean 0 ≈ 0.01 × sqrt(n/(n-1))
    const points = [{ key: monthKey(2024, 1), value: 100 }];
    let v = 100;
    for (let i = 2; i <= 13; i++) {
      v = v * (i % 2 === 0 ? Math.exp(0.01) : Math.exp(-0.01));
      points.push({ key: monthKey(2024, i > 12 ? i - 12 : i), value: v });
    }
    // Skipping rigorous closed-form; just verify scale: should be roughly 0.01 × √12 ≈ 0.0346
    const s = new MonthlySeries("x", "x", "u", points);
    const vol = annualizedVolatility(s);
    expect(vol).not.toBeNull();
    expect(vol!).toBeGreaterThan(0.025);
    expect(vol!).toBeLessThan(0.05);
  });
});

describe("annualizedSharpe", () => {
  it("returns null for fewer than 2 returns", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2024, 1), value: 100 },
    ]);
    expect(annualizedSharpe(s)).toBeNull();
  });

  it("constant series has null sharpe (zero stdev)", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2024, 1), value: 100 },
      { key: monthKey(2024, 2), value: 100 },
      { key: monthKey(2024, 3), value: 100 },
    ]);
    expect(annualizedSharpe(s)).toBeNull();
  });

  it("sharpe is positive when monthly returns exceed monthly risk-free", () => {
    // Build a series compounding at ~1% per month (~12.7% annualized, comfortably > 6% rf)
    const points = [{ key: monthKey(2024, 1), value: 100 }];
    let v = 100;
    for (let i = 2; i <= 24; i++) {
      const noise = (i % 3 === 0 ? 1.005 : 1.015); // mild dispersion around 1.01
      v *= noise;
      const my = 2024 + Math.floor((i - 1) / 12);
      const mm = ((i - 1) % 12) + 1;
      points.push({ key: monthKey(my, mm), value: v });
    }
    const s = new MonthlySeries("x", "x", "u", points);
    const sharpe = annualizedSharpe(s, 6);
    expect(sharpe).not.toBeNull();
    expect(sharpe!).toBeGreaterThan(0);
  });
});

describe("monthlyDrawdownSeries", () => {
  it("monotonically increasing series has zero drawdown", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2024, 1), value: 100 },
      { key: monthKey(2024, 2), value: 105 },
      { key: monthKey(2024, 3), value: 110 },
    ]);
    const dd = monthlyDrawdownSeries(s);
    expect(dd.every((p) => p.drawdown === 0)).toBe(true);
  });

  it("captures peak-to-trough drawdown correctly", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2024, 1), value: 100 },
      { key: monthKey(2024, 2), value: 120 }, // peak
      { key: monthKey(2024, 3), value: 90 }, // trough: -25%
      { key: monthKey(2024, 4), value: 100 }, // partial recovery
    ]);
    const dd = monthlyDrawdownSeries(s);
    expect(dd[2].drawdown).toBeCloseTo(-25, 5);
    // Recovery to 100 from peak of 120: (100-120)/120 = -16.67%
    expect(dd[3].drawdown).toBeCloseTo(-100 / 6, 5);
  });
});

describe("rollingMonthlyCagr", () => {
  it("rolling 12M CAGR of 10% YoY series is ~10%", () => {
    const points: Array<{ key: number; value: number }> = [];
    let v = 100;
    for (let m = 0; m < 36; m++) {
      const y = 2020 + Math.floor(m / 12);
      const mo = (m % 12) + 1;
      points.push({ key: monthKey(y, mo), value: v });
      v *= Math.pow(1.10, 1 / 12); // monthly compounding to 10% annualized
    }
    const s = new MonthlySeries("x", "x", "u", points);
    const rolling = rollingMonthlyCagr(s, 12);
    rolling.points.forEach((p) => {
      expect(p.value).toBeCloseTo(10, 1); // ≈10% annualized
    });
  });
});

describe("toAnnualPoints", () => {
  const s = new MonthlySeries("x", "x", "u", [
    { key: monthKey(2023, 6), value: 50 },
    { key: monthKey(2023, 12), value: 100 },
    { key: monthKey(2024, 1), value: 110 },
    { key: monthKey(2024, 6), value: 130 },
    { key: monthKey(2024, 12), value: 150 },
  ]);

  it("'last' takes the latest month in the year", () => {
    expect(toAnnualPoints(s, "last")).toEqual([
      { year: 2023, value: 100 },
      { year: 2024, value: 150 },
    ]);
  });

  it("'avg' averages months in the year", () => {
    const annual = toAnnualPoints(s, "avg");
    expect(annual[0].value).toBeCloseTo((50 + 100) / 2, 5);
    expect(annual[1].value).toBeCloseTo((110 + 130 + 150) / 3, 5);
  });

  it("'sum' aggregates months in the year (for flow series)", () => {
    expect(toAnnualPoints(s, "sum")).toEqual([
      { year: 2023, value: 150 },
      { year: 2024, value: 390 },
    ]);
  });

  it("output is sorted by year regardless of input order", () => {
    const unordered = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2024, 1), value: 1 },
      { key: monthKey(2022, 1), value: 1 },
      { key: monthKey(2023, 1), value: 1 },
    ]);
    const annual = toAnnualPoints(unordered, "last");
    expect(annual.map((a) => a.year)).toEqual([2022, 2023, 2024]);
  });
});
