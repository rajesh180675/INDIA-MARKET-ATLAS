import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  continuousIndex,
  crashEvents,
  decadeReturns,
  indiaVsWorld,
  insights,
  keyStats,
  marketBreadth,
  marketRegimes,
  masterTable,
  milestones,
  rollingWindows,
  scenario2050,
  sectorEvolution,
  sipDematGrowth,
  tickerStats,
  yearAnnotations,
} from "../data/indiaMarketData";

// --- Schemas ---

const MarketPointSchema = z.object({
  year: z.number().int().min(1947).max(2030),
  value: z.number().positive(),
});

const KeyStatSchema = z.object({
  label: z.string().min(1),
  value: z.number(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  decimals: z.number().optional(),
  note: z.string().min(1),
});

const RegimeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  years: z.string().regex(/^\d{4}–\d{4}$/),
  driver: z.string().min(1),
  returns: z.string().min(1),
  risk: z.string().min(1),
  lesson: z.string().min(1),
  summary: z.string().min(1),
  tone: z.enum(["red", "amber", "blue", "emerald", "violet"]),
});

const MilestoneSchema = z.object({
  year: z.number().int().min(1947).max(2030),
  value: z.number().positive(),
  label: z.string().min(1),
  detail: z.string().min(1),
  tone: z.enum(["emerald", "amber", "rose", "blue"]),
});

const CrashEventSchema = z.object({
  year: z.number().int().min(1947).max(2030),
  name: z.string().min(1),
  period: z.string().min(1),
  decline: z.number().max(0),
  monthsToBottom: z.number().int().min(1),
  monthsToRecover: z.number().int().min(1).nullable(),
  note: z.string().min(1),
});

const DecadeReturnSchema = z.object({
  period: z.string().regex(/^\d{4}–\d{4}$/),
  nominal: z.number(),
  real: z.number(),
});

const RollingWindowSchema = z.object({
  period: z.string().min(1),
  cagr: z.number(),
  verdict: z.string().min(1),
});

const SectorSnapshotSchema = z.object({
  year: z.number().int(),
  era: z.string().min(1),
  dominant: z.string().min(1),
  challengers: z.array(z.string().min(1)).min(1),
  breadthSignal: z.string().min(1),
  note: z.string().min(1),
});

const BreadthPointSchema = z.object({
  year: z.number().int(),
  marketCapLakhCr: z.number().min(0),
  marketCapToGdp: z.number().min(0),
  listedCompaniesK: z.number().min(0),
  dematCrore: z.number().min(0),
  dailyTurnoverCr: z.number().min(0),
  note: z.string().min(1),
});

const GlobalComparisonSchema = z.object({
  year: z.number().int().min(1990).max(2030),
  india: z.number().positive(),
  usa: z.number().positive(),
  china: z.number().positive(),
});

const SipGrowthSchema = z.object({
  year: z.number().int().min(2016).max(2030),
  dematCrore: z.number().positive(),
  sipMonthlyCr: z.number().positive(),
  annualSipCr: z.number().positive(),
});

const Scenario2050Schema = z.object({
  name: z.string().min(1),
  probability: z.string().min(1),
  cagr: z.number().positive(),
  inflation: z.number().positive(),
  projectedSensex2050: z.number().positive(),
  realMultiple: z.number().positive(),
  note: z.string().min(1),
  tone: z.enum(["emerald", "amber", "sky", "violet"]),
});

const InsightSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(10),
});

const YearAnnotationSchema = z.object({
  year: z.number().int().min(1947).max(2030),
  title: z.string().min(1),
  detail: z.string().min(1),
});

const MasterTableRowSchema = z.object({
  year: z.string().min(1),
  normalizedIndex: z.string().min(1),
  sensex: z.string().min(1),
  yoy: z.string().min(1),
  cagrFrom1947: z.string().min(1),
  inrUsd: z.string().min(1),
  event: z.string().min(1),
});

const TickerStatSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  change: z.string().optional(),
  tone: z.enum(["emerald", "amber", "sky", "rose", "violet"]).optional(),
});

// --- Tests ---

describe("Data schema validation", () => {
  test("continuousIndex: valid MarketPoint array covering 1947-2025", () => {
    expect(continuousIndex.length).toBeGreaterThanOrEqual(75);
    expect(continuousIndex[0].year).toBe(1947);
    expect(continuousIndex[continuousIndex.length - 1].year).toBe(2025);
    // Check that no year is out of range
    const validPoints = continuousIndex.filter((p) => p.value !== undefined);
    expect(validPoints.length).toBeGreaterThanOrEqual(75);
    for (const point of validPoints) {
      expect(point.year).toBeGreaterThanOrEqual(1947);
      expect(point.year).toBeLessThanOrEqual(2025);
      expect(point.value).toBeGreaterThan(0);
    }
  });

  test("continuousIndex: years are sequential", () => {
    const years = continuousIndex.map((p) => p.year);
    expect(years[0]).toBe(1947);
    expect(years[years.length - 1]).toBe(2025);
    for (let i = 1; i < years.length; i++) {
      expect(years[i]).toBeGreaterThan(years[i - 1]);
    }
  });

  test("keyStats: valid schema", () => {
    const result = z.array(KeyStatSchema).safeParse(keyStats);
    expect(result.success).toBe(true);
    expect(keyStats.length).toBeGreaterThanOrEqual(5);
  });

  test("marketRegimes: 5 regimes, valid schema", () => {
    expect(marketRegimes.length).toBe(5);
    const result = z.array(RegimeSchema).safeParse(marketRegimes);
    expect(result.success).toBe(true);
  });

  test("milestones: valid schema, years within range", () => {
    const result = z.array(MilestoneSchema).safeParse(milestones);
    expect(result.success).toBe(true);
    expect(milestones.length).toBeGreaterThanOrEqual(5);
  });

  test("crashEvents: valid schema, declines are negative", () => {
    const result = z.array(CrashEventSchema).safeParse(crashEvents);
    expect(result.success).toBe(true);
    crashEvents.forEach((e) => expect(e.decline).toBeLessThan(0));
  });

  test("decadeReturns: valid schema", () => {
    const result = z.array(DecadeReturnSchema).safeParse(decadeReturns);
    expect(result.success).toBe(true);
    expect(decadeReturns.length).toBe(8);
  });

  test("rollingWindows: valid schema", () => {
    const result = z.array(RollingWindowSchema).safeParse(rollingWindows);
    expect(result.success).toBe(true);
    expect(rollingWindows.length).toBe(10);
  });

  test("sectorEvolution: valid schema", () => {
    const result = z.array(SectorSnapshotSchema).safeParse(sectorEvolution);
    expect(result.success).toBe(true);
  });

  test("marketBreadth: valid schema", () => {
    const result = z.array(BreadthPointSchema).safeParse(marketBreadth);
    expect(result.success).toBe(true);
  });

  test("indiaVsWorld: 36 points (1990-2025), valid schema", () => {
    expect(indiaVsWorld.length).toBe(36);
    const result = z.array(GlobalComparisonSchema).safeParse(indiaVsWorld);
    expect(result.success).toBe(true);
  });

  test("sipDematGrowth: valid schema, annualSipCr = sipMonthlyCr * 12", () => {
    const result = z.array(SipGrowthSchema).safeParse(sipDematGrowth);
    expect(result.success).toBe(true);
    sipDematGrowth.forEach((p) => {
      expect(p.annualSipCr).toBe(p.sipMonthlyCr * 12);
    });
  });

  test("scenario2050: valid schema", () => {
    const result = z.array(Scenario2050Schema).safeParse(scenario2050);
    expect(result.success).toBe(true);
    expect(scenario2050.length).toBe(4);
  });

  test("insights: 10 insights, valid schema", () => {
    expect(insights.length).toBe(10);
    const result = z.array(InsightSchema).safeParse(insights);
    expect(result.success).toBe(true);
  });

  test("yearAnnotations: valid schema", () => {
    const result = z.array(YearAnnotationSchema).safeParse(yearAnnotations);
    expect(result.success).toBe(true);
  });

  test("masterTable: valid schema, has key years", () => {
    const result = z.array(MasterTableRowSchema).safeParse(masterTable);
    expect(result.success).toBe(true);
    const years = masterTable.map((r) => r.year);
    expect(years).toContain("1947");
    expect(years).toContain("2025 est");
  });

  test("tickerStats: valid schema", () => {
    const result = z.array(TickerStatSchema).safeParse(tickerStats);
    expect(result.success).toBe(true);
  });
});
