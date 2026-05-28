import { describe, expect, test } from "vitest";
import { z } from "zod";
import { macroIndicators, getIndicator, getIndicatorsByCategory } from "./macroIndicators";

const MacroDataPointSchema = z.object({
  year: z.number().int().min(1947).max(2025),
  value: z.number().nullable(),
});

const MacroIndicatorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  category: z.enum(["currency", "commodity", "inflation", "growth", "monetary", "external", "fiscal", "market", "demographic"]),
  source: z.string().min(1),
  data: z.array(MacroDataPointSchema).min(1),
});

describe("macroIndicators data validation", () => {
  test("exports 16 indicators", () => {
    expect(macroIndicators).toHaveLength(16);
  });

  test("all indicators pass Zod schema validation", () => {
    for (const ind of macroIndicators) {
      const result = MacroIndicatorSchema.safeParse(ind);
      if (!result.success) {
        throw new Error(`${ind.id}: ${result.error.message}`);
      }
    }
  });

  test("all indicator IDs are unique", () => {
    const ids = macroIndicators.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("data points are sorted by year (ascending)", () => {
    for (const ind of macroIndicators) {
      for (let i = 1; i < ind.data.length; i++) {
        expect(ind.data[i].year).toBeGreaterThan(ind.data[i - 1].year);
      }
    }
  });

  test("USD/INR starts at 3.30 in 1947 and ends above 80 in 2025", () => {
    const usd = getIndicator("usd-inr")!;
    expect(usd.data[0]).toEqual({ year: 1947, value: 3.30 });
    expect(usd.data[usd.data.length - 1].value).toBeGreaterThan(80);
  });

  test("Gold price shows 1000x+ appreciation from 1947 to 2025", () => {
    const gold = getIndicator("gold-price")!;
    const first = gold.data[0].value!;
    const last = gold.data[gold.data.length - 1].value!;
    expect(last / first).toBeGreaterThan(1000);
  });

  test("CPI inflation has negative values (deflation years exist)", () => {
    const cpi = getIndicator("cpi-inflation")!;
    const hasNegative = cpi.data.some((d) => d.value !== null && d.value < 0);
    expect(hasNegative).toBe(true);
  });

  test("GDP growth includes 2020 contraction", () => {
    const gdp = getIndicator("real-gdp-growth")!;
    const y2020 = gdp.data.find((d) => d.year === 2020);
    expect(y2020?.value).toBeLessThan(0);
  });

  test("Forex reserves grew from near-zero to 600+ billion", () => {
    const fx = getIndicator("forex-reserves")!;
    const nonNull = fx.data.filter((d) => d.value !== null);
    const last = nonNull[nonNull.length - 1].value!;
    expect(last).toBeGreaterThan(600);
  });

  test("getIndicatorsByCategory returns correct groupings", () => {
    const monetary = getIndicatorsByCategory("monetary");
    expect(monetary.length).toBeGreaterThanOrEqual(2);
    expect(monetary.every((i) => i.category === "monetary")).toBe(true);
  });

  test("Market cap/GDP peaked above 100% (2007 or 2021+)", () => {
    const mcap = getIndicator("market-cap-gdp")!;
    const peak = Math.max(...mcap.data.filter((d) => d.value !== null).map((d) => d.value!));
    expect(peak).toBeGreaterThan(100);
  });

  test("Sensex P/E has range between 12 and 44", () => {
    const pe = getIndicator("sensex-pe")!;
    const values = pe.data.filter((d) => d.value !== null).map((d) => d.value!);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(12);
    expect(Math.max(...values)).toBeLessThanOrEqual(44);
  });
});
