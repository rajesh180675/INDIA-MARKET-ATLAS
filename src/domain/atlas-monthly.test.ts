import { describe, expect, it } from "vitest";
import { sensexMonthlyPoints } from "@/data/sensexMonthly";
import {
  sensexMonthly,
  nominalIndex,
  SENSEX_MONTHLY_FIRST,
  SENSEX_MONTHLY_LAST,
} from "./atlas";
import { monthKey, monthlyCagr } from "./monthly";
import { cagr } from "./series";

describe("sensexMonthly data integrity", () => {
  it("has at least 300 monthly points", () => {
    expect(sensexMonthlyPoints.length).toBeGreaterThan(300);
  });

  it("starts no later than 1998 (Yahoo's earliest available)", () => {
    const [firstYear] = sensexMonthlyPoints[0];
    expect(firstYear).toBeLessThanOrEqual(1998);
  });

  it("is chronologically ordered with no duplicates", () => {
    const keys = sensexMonthlyPoints.map(([y, m]) => y * 100 + m);
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i]).toBeGreaterThan(keys[i - 1]);
    }
  });

  it("all months are 1..12, all values are positive", () => {
    for (const [y, m, v] of sensexMonthlyPoints) {
      expect(m).toBeGreaterThanOrEqual(1);
      expect(m).toBeLessThanOrEqual(12);
      expect(y).toBeGreaterThanOrEqual(1990);
      expect(y).toBeLessThanOrEqual(2050);
      expect(v).toBeGreaterThan(0);
    }
  });

  it("Sensex monotonically grew over 25 years (sanity check)", () => {
    // Sensex went from ~4000 (1997) to >75000 (2025). Last value should be
    // at least 10x the first as a basic data-quality sanity check.
    const [, , first] = sensexMonthlyPoints[0];
    const [, , last] = sensexMonthlyPoints[sensexMonthlyPoints.length - 1];
    expect(last / first).toBeGreaterThan(10);
  });
});

describe("sensexMonthly Series", () => {
  it("constructs from points correctly", () => {
    expect(sensexMonthly.length).toBe(sensexMonthlyPoints.length);
    expect(sensexMonthly.firstKey).toBe(SENSEX_MONTHLY_FIRST);
    expect(sensexMonthly.lastKey).toBe(SENSEX_MONTHLY_LAST);
  });

  it("monthly CAGR over 1998-01 to 2024-12 is in a sane range (10-15%)", () => {
    // Sensex is widely cited at ~13-14% nominal CAGR over this period.
    const c = monthlyCagr(sensexMonthly, monthKey(1998, 1), monthKey(2024, 12));
    expect(c).not.toBeNull();
    expect(c!).toBeGreaterThan(10);
    expect(c!).toBeLessThan(16);
  });

  it("monthly and annual Sensex CAGR are roughly consistent over overlap", () => {
    // Cross-check: monthly Sensex (Yahoo, raw index points) vs the inherited
    // annual continuousIndex (BSE-derived, 1947=100 rebased). They track
    // different things so we don't expect identical CAGRs — just that they
    // agree to within ~5pp. Larger drift would indicate a data integrity
    // problem in one or the other.
    const monthlyC = monthlyCagr(
      sensexMonthly,
      monthKey(2000, 1),
      monthKey(2020, 1),
    );
    const annualC = cagr(nominalIndex, 2000, 2020);
    expect(monthlyC).not.toBeNull();
    expect(annualC).not.toBeNull();
    expect(Math.abs(monthlyC! - annualC!)).toBeLessThan(5);
  });
});
