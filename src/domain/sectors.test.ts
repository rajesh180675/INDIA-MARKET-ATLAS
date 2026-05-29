import { describe, expect, it } from "vitest";
import {
  MonthlySeries,
  monthKey,
  periodReturnPct,
  rebaseTo100,
  relativeStrength,
} from "./monthly";

describe("rebaseTo100", () => {
  it("anchor month equals 100 after rebasing", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2020, 1), value: 50 },
      { key: monthKey(2020, 2), value: 75 },
      { key: monthKey(2020, 3), value: 100 },
    ]);
    const r = rebaseTo100(s, monthKey(2020, 1));
    expect(r).not.toBeNull();
    expect(r!.at(monthKey(2020, 1))).toBe(100);
    expect(r!.at(monthKey(2020, 2))).toBe(150);
    expect(r!.at(monthKey(2020, 3))).toBe(200);
  });

  it("drops points before the anchor (no extrapolation)", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2019, 1), value: 25 },
      { key: monthKey(2020, 1), value: 50 },
      { key: monthKey(2020, 2), value: 75 },
    ]);
    const r = rebaseTo100(s, monthKey(2020, 1));
    expect(r!.points).toHaveLength(2);
    expect(r!.at(monthKey(2019, 1))).toBeUndefined();
  });

  it("returns null when anchor is missing", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2020, 1), value: 50 },
    ]);
    expect(rebaseTo100(s, monthKey(2021, 1))).toBeNull();
  });

  it("returns null for non-positive anchor", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2020, 1), value: 0 },
      { key: monthKey(2020, 2), value: 75 },
    ]);
    expect(rebaseTo100(s, monthKey(2020, 1))).toBeNull();
  });
});

describe("relativeStrength", () => {
  it("anchor month is exactly 100", () => {
    const a = new MonthlySeries("a", "a", "u", [
      { key: monthKey(2020, 1), value: 100 },
      { key: monthKey(2020, 2), value: 110 },
    ]);
    const b = new MonthlySeries("b", "b", "u", [
      { key: monthKey(2020, 1), value: 100 },
      { key: monthKey(2020, 2), value: 100 },
    ]);
    const rs = relativeStrength(a, b, monthKey(2020, 1));
    expect(rs!.at(monthKey(2020, 1))).toBe(100);
  });

  it("rising series outperforming flat series produces RS > 100", () => {
    const a = new MonthlySeries("a", "a", "u", [
      { key: monthKey(2020, 1), value: 100 },
      { key: monthKey(2020, 2), value: 120 }, // +20%
    ]);
    const b = new MonthlySeries("b", "b", "u", [
      { key: monthKey(2020, 1), value: 100 },
      { key: monthKey(2020, 2), value: 100 }, // flat
    ]);
    const rs = relativeStrength(a, b, monthKey(2020, 1));
    expect(rs!.at(monthKey(2020, 2))).toBeCloseTo(120, 5);
  });

  it("inner-joins on dates present in BOTH series", () => {
    const a = new MonthlySeries("a", "a", "u", [
      { key: monthKey(2020, 1), value: 100 },
      { key: monthKey(2020, 2), value: 110 },
      { key: monthKey(2020, 3), value: 121 }, // a-only
    ]);
    const b = new MonthlySeries("b", "b", "u", [
      { key: monthKey(2020, 1), value: 100 },
      { key: monthKey(2020, 2), value: 100 },
    ]);
    const rs = relativeStrength(a, b, monthKey(2020, 1));
    expect(rs!.points).toHaveLength(2);
    expect(rs!.at(monthKey(2020, 3))).toBeUndefined();
  });

  it("returns null when anchor missing in either series", () => {
    const a = new MonthlySeries("a", "a", "u", [
      { key: monthKey(2020, 1), value: 100 },
    ]);
    const b = new MonthlySeries("b", "b", "u", [
      { key: monthKey(2021, 1), value: 100 },
    ]);
    expect(relativeStrength(a, b, monthKey(2020, 1))).toBeNull();
  });
});

describe("periodReturnPct", () => {
  it("100 → 150 over any window = 50%", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2020, 1), value: 100 },
      { key: monthKey(2024, 1), value: 150 },
    ]);
    expect(
      periodReturnPct(s, monthKey(2020, 1), monthKey(2024, 1)),
    ).toBeCloseTo(50, 8);
  });

  it("100 → 50 = -50%", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2020, 1), value: 100 },
      { key: monthKey(2024, 1), value: 50 },
    ]);
    expect(
      periodReturnPct(s, monthKey(2020, 1), monthKey(2024, 1)),
    ).toBeCloseTo(-50, 8);
  });

  it("returns null for missing endpoints", () => {
    const s = new MonthlySeries("x", "x", "u", [
      { key: monthKey(2020, 1), value: 100 },
    ]);
    expect(
      periodReturnPct(s, monthKey(2020, 1), monthKey(2024, 1)),
    ).toBeNull();
  });
});
