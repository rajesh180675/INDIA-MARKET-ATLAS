import { describe, expect, test } from "vitest";
import { formatNumber, formatPercent } from "./format";

describe("formatNumber", () => {
  test("formats integers with Indian locale grouping", () => {
    expect(formatNumber(1234567)).toBe("12,34,567");
  });

  test("formats with specified decimals", () => {
    expect(formatNumber(1234.567, 2)).toBe("1,234.57");
  });

  test("handles zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  test("handles string input", () => {
    expect(formatNumber("42000")).toBe("42,000");
  });

  test("returns dash for undefined/NaN/non-numeric strings", () => {
    expect(formatNumber(undefined)).toBe("—");
    expect(formatNumber(NaN)).toBe("—");
    expect(formatNumber("not a number")).toBe("—");
  });

  test("null converts to zero (Number(null) === 0)", () => {
    expect(formatNumber(null)).toBe("0");
  });

  test("handles Infinity", () => {
    expect(formatNumber(Infinity)).toBe("—");
    expect(formatNumber(-Infinity)).toBe("—");
  });

  test("handles negative numbers", () => {
    expect(formatNumber(-5000)).toBe("-5,000");
  });
});

describe("formatPercent", () => {
  test("formats with default 1 decimal", () => {
    expect(formatPercent(12.345)).toBe("12.3%");
  });

  test("formats with specified decimals", () => {
    expect(formatPercent(12.345, 2)).toBe("12.35%");
    expect(formatPercent(12.345, 0)).toBe("12%");
  });

  test("handles zero", () => {
    expect(formatPercent(0)).toBe("0.0%");
  });

  test("handles negative values", () => {
    expect(formatPercent(-5.5)).toBe("-5.5%");
  });

  test("returns dash for null/undefined", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(undefined)).toBe("—");
  });
});
