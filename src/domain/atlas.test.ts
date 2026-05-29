import { describe, expect, it } from "vitest";
import {
  BASE_YEAR,
  MAX_YEAR,
  MIN_YEAR,
  cpiLevel,
  indexInDenomination,
  macroCatalog,
  nominalIndex,
} from "./atlas";
import { cagr } from "./series";

describe("atlas adapter wiring (real inherited data)", () => {
  it("spans 1947..2025", () => {
    expect(MIN_YEAR).toBe(1947);
    expect(MAX_YEAR).toBe(2025);
    expect(BASE_YEAR).toBe(1947);
  });

  it("nominal index anchors at 100 in 1947 and ~149298 in 2025", () => {
    expect(nominalIndex.at(1947)).toBeCloseTo(100);
    expect(nominalIndex.at(2025)).toBeCloseTo(149298);
  });

  it("nominal full-period CAGR is ~9.8% (matches published headline)", () => {
    const c = cagr(nominalIndex, 1947, 2025)!;
    expect(c).toBeGreaterThan(9.3);
    expect(c).toBeLessThan(10.2);
  });

  it("all four denominations rebase to 100 at the base year", () => {
    for (const d of ["nominal", "real", "usd", "gold"] as const) {
      expect(indexInDenomination(d).at(1947)).toBeCloseTo(100);
    }
  });

  it("real index ends below nominal (inflation erodes nominal gains)", () => {
    const nom = indexInDenomination("nominal").at(2025)!;
    const real = indexInDenomination("real").at(2025)!;
    expect(real).toBeLessThan(nom);
    expect(real).toBeGreaterThan(100); // still positive real growth
  });

  it("CPI price level rises monotonically and is well above 100 by 2025", () => {
    expect(cpiLevel.at(1947)).toBeCloseTo(100);
    expect(cpiLevel.at(2025)!).toBeGreaterThan(1000);
  });

  it("exposes all 16 macro indicators with non-empty series", () => {
    expect(macroCatalog.length).toBe(16);
    for (const m of macroCatalog) {
      expect(m.series.years.length).toBeGreaterThan(0);
    }
  });
});
