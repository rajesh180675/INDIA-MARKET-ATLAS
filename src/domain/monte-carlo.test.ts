import { describe, expect, it } from "vitest";
import {
  MonthlySeries,
  monteCarloProjection,
  monthKey,
  monthlyLogReturnArray,
  mulberry32,
} from "./monthly";

describe("mulberry32", () => {
  it("is deterministic given the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it("produces values in [0, 1)", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("different seeds produce different sequences", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const va = Array.from({ length: 10 }, () => a());
    const vb = Array.from({ length: 10 }, () => b());
    expect(va).not.toEqual(vb);
  });
});

describe("monthlyLogReturnArray", () => {
  it("computes log returns for valid pairs", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2024, 1), value: 100 },
      { key: monthKey(2024, 2), value: 110 },
      { key: monthKey(2024, 3), value: 121 },
    ]);
    const rets = monthlyLogReturnArray(s);
    expect(rets).toHaveLength(2);
    expect(rets[0]).toBeCloseTo(Math.log(110 / 100), 10);
    expect(rets[1]).toBeCloseTo(Math.log(121 / 110), 10);
  });

  it("returns empty for series with fewer than 2 points", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2024, 1), value: 100 },
    ]);
    expect(monthlyLogReturnArray(s)).toEqual([]);
  });

  it("skips non-positive values", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2024, 1), value: 100 },
      { key: monthKey(2024, 2), value: 0 },
      { key: monthKey(2024, 3), value: 110 },
    ]);
    expect(monthlyLogReturnArray(s)).toEqual([]);
  });
});

describe("monteCarloProjection", () => {
  // A simple symmetric return distribution: ±1% with equal probability
  const symmetric = [0.01, -0.01, 0.01, -0.01];

  it("returns empty result for empty historical returns", () => {
    const r = monteCarloProjection([], 100, 12, 100);
    expect(r.bands).toEqual([]);
    expect(r.finalValues).toEqual([]);
  });

  it("returns empty result for non-positive startValue", () => {
    const r = monteCarloProjection(symmetric, 0, 12, 100);
    expect(r.bands).toEqual([]);
    expect(r.finalValues).toEqual([]);
  });

  it("month 0 always equals startValue across all bands", () => {
    const r = monteCarloProjection(symmetric, 100, 24, 50, mulberry32(7));
    expect(r.bands[0].p5).toBe(100);
    expect(r.bands[0].p25).toBe(100);
    expect(r.bands[0].p50).toBe(100);
    expect(r.bands[0].p75).toBe(100);
    expect(r.bands[0].p95).toBe(100);
  });

  it("is deterministic with the same seed", () => {
    const r1 = monteCarloProjection(symmetric, 100, 24, 50, mulberry32(42));
    const r2 = monteCarloProjection(symmetric, 100, 24, 50, mulberry32(42));
    expect(r1.bands).toEqual(r2.bands);
    expect(r1.finalValues).toEqual(r2.finalValues);
  });

  it("p50 converges to historical median geometric path", () => {
    // With symmetric ±1% returns, expected median path is roughly flat at 100.
    // 2000 paths × 60 months should give a median within 5% of start.
    const r = monteCarloProjection(symmetric, 100, 60, 2000, mulberry32(1));
    const finalP50 = r.bands[60].p50;
    expect(finalP50).toBeGreaterThan(95);
    expect(finalP50).toBeLessThan(105);
  });

  it("bands widen monotonically with horizon (variance accumulates)", () => {
    const r = monteCarloProjection(symmetric, 100, 60, 2000, mulberry32(3));
    // Width = p95 - p5. Should be ~0 at month 0, grow with month.
    const w0 = r.bands[0].p95 - r.bands[0].p5;
    const w12 = r.bands[12].p95 - r.bands[12].p5;
    const w36 = r.bands[36].p95 - r.bands[36].p5;
    const w60 = r.bands[60].p95 - r.bands[60].p5;
    expect(w0).toBe(0);
    expect(w12).toBeGreaterThan(0);
    expect(w36).toBeGreaterThan(w12);
    expect(w60).toBeGreaterThan(w36);
  });

  it("bands are properly ordered: p5 ≤ p25 ≤ p50 ≤ p75 ≤ p95", () => {
    const r = monteCarloProjection(symmetric, 100, 36, 500, mulberry32(11));
    for (const b of r.bands) {
      expect(b.p5).toBeLessThanOrEqual(b.p25);
      expect(b.p25).toBeLessThanOrEqual(b.p50);
      expect(b.p50).toBeLessThanOrEqual(b.p75);
      expect(b.p75).toBeLessThanOrEqual(b.p95);
    }
  });

  it("median grows when historical drift is positive", () => {
    // Distribution with positive mean log return: μ = +0.5%/month → ≈6%/yr
    const positiveDrift = [0.02, 0.01, 0.0, -0.01]; // mean = 0.005
    const r = monteCarloProjection(positiveDrift, 100, 60, 2000, mulberry32(5));
    const final = r.bands[60].p50;
    // Expected: 100 × exp(0.005 × 60) ≈ 134.99
    expect(final).toBeGreaterThan(125);
    expect(final).toBeLessThan(145);
  });

  it("returns one finalValue per path", () => {
    const r = monteCarloProjection(symmetric, 100, 24, 137, mulberry32(9));
    expect(r.finalValues).toHaveLength(137);
    expect(r.paths).toBe(137);
    expect(r.historicalN).toBe(symmetric.length);
  });

  it("finalValues is sorted ascending", () => {
    const r = monteCarloProjection(symmetric, 100, 36, 200, mulberry32(13));
    for (let i = 1; i < r.finalValues.length; i++) {
      expect(r.finalValues[i]).toBeGreaterThanOrEqual(r.finalValues[i - 1]);
    }
  });
});
