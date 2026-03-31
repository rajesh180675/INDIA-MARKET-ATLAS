import { describe, expect, test } from "vitest";
import {
  aggregateCandles,
  buildDrawdown,
  buildMonthlyCandles,
  summarizeSeries,
  type Candle,
} from "./marketChartUtils";

describe("marketChartUtils", () => {
  test("buildDrawdown tracks the running peak correctly", () => {
    expect(buildDrawdown([100, 120, 90, 150, 120])).toEqual(
      expect.arrayContaining([0, 0, -25, 0]),
    );
    expect(buildDrawdown([100, 120, 90, 150, 120])[4]).toBeCloseTo(-20, 10);
  });

  test("summarizeSeries calculates cagr, total move, and drawdown", () => {
    const summary = summarizeSeries(
      [100, 121, 144],
      ["2023", "2024", "2025"],
      [2023, 2024, 2025],
    );

    expect(summary.totalMove).toBeCloseTo(44, 5);
    expect(summary.cagr).toBeCloseTo(20, 5);
    expect(summary.maxDrawdown).toBe(0);
    expect(summary.years).toBe("2023–2025");
  });

  test("aggregateCandles preserves open/high/low/close across buckets", () => {
    const candles: Candle[] = [
      {
        index: 0,
        year: 2024,
        month: 1,
        label: "Jan 2024",
        open: 100,
        high: 120,
        low: 95,
        close: 110,
        volume: 1000,
      },
      {
        index: 1,
        year: 2024,
        month: 2,
        label: "Feb 2024",
        open: 110,
        high: 125,
        low: 105,
        close: 123,
        volume: 1400,
      },
      {
        index: 2,
        year: 2024,
        month: 3,
        label: "Mar 2024",
        open: 123,
        high: 130,
        low: 118,
        close: 128,
        volume: 1600,
      },
    ];

    const aggregated = aggregateCandles(candles, 3);

    expect(aggregated).toHaveLength(1);
    expect(aggregated[0]).toMatchObject({
      open: 100,
      high: 130,
      low: 95,
      close: 128,
      volume: 4000,
      label: "Q1 2024",
    });
  });

  test("buildMonthlyCandles expands annual points into 12 monthly candles per year", () => {
    const annual = [
      { year: 2024, value: 100 },
      { year: 2025, value: 110 },
    ];

    const monthly = buildMonthlyCandles(annual, []);

    expect(monthly).toHaveLength(24);
    expect(monthly[0]?.label).toBe("Jan 2024");
    expect(monthly[11]?.year).toBe(2024);
    expect(monthly[23]?.year).toBe(2025);
    expect(monthly[23]?.close).toBe(110);
  });
});
