import { describe, expect, test } from "vitest";
import { z } from "zod";
import { sensexOHLC, getAnnualReturn, getVolatility, getUpperShadow, getLowerShadow } from "./sensexOHLC";

const OHLCSchema = z.object({
  year: z.number().int().min(1979).max(2025),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
});

describe("sensexOHLC", () => {
  test("has 47 years of data (1979-2025)", () => {
    expect(sensexOHLC.length).toBe(47);
  });

  test("all entries pass schema validation", () => {
    for (const d of sensexOHLC) {
      expect(() => OHLCSchema.parse(d)).not.toThrow();
    }
  });

  test("years are sequential and unique", () => {
    const years = sensexOHLC.map((d) => d.year);
    for (let i = 1; i < years.length; i++) {
      expect(years[i]).toBe(years[i - 1] + 1);
    }
  });

  test("high >= max(open, close) and low <= min(open, close)", () => {
    for (const d of sensexOHLC) {
      expect(d.high).toBeGreaterThanOrEqual(Math.max(d.open, d.close));
      expect(d.low).toBeLessThanOrEqual(Math.min(d.open, d.close));
    }
  });

  test("known data points match", () => {
    const find = (y: number) => sensexOHLC.find((d) => d.year === y)!;
    expect(find(1979).close).toBe(100);
    expect(find(1992).high).toBe(4546);
    expect(find(1992).close).toBe(2615);
    expect(find(2008).low).toBe(7697);
    expect(find(2008).close).toBe(9647);
    expect(find(2020).low).toBe(25639);
    expect(find(2024).high).toBe(85978);
    expect(find(2024).close).toBe(78139);
  });

  test("open of year N+1 approximately equals close of year N", () => {
    // Allow 5% gap (market can gap open)
    for (let i = 0; i < sensexOHLC.length - 1; i++) {
      const close = sensexOHLC[i].close;
      const nextOpen = sensexOHLC[i + 1].open;
      const gap = Math.abs(nextOpen - close) / close;
      expect(gap).toBeLessThan(0.05);
    }
  });

  test("getAnnualReturn computes correctly", () => {
    const d2008 = sensexOHLC.find((d) => d.year === 2008)!;
    const ret = getAnnualReturn(d2008);
    // 2008: open 20287, close 9647 → -52.4%
    expect(ret).toBeCloseTo(-52.4, 0);
  });

  test("getVolatility computes intra-year range", () => {
    const d2008 = sensexOHLC.find((d) => d.year === 2008)!;
    const vol = getVolatility(d2008);
    // (21207 - 7697) / 20287 * 100 = 66.6%
    expect(vol).toBeCloseTo(66.6, 0);
  });

  test("getUpperShadow and getLowerShadow are non-negative", () => {
    for (const d of sensexOHLC) {
      expect(getUpperShadow(d)).toBeGreaterThanOrEqual(0);
      expect(getLowerShadow(d)).toBeGreaterThanOrEqual(0);
    }
  });
});
