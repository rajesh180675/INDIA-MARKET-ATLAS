import { describe, expect, it } from "vitest";
import {
  DATASET_COVERAGE,
  DATASET_LABEL,
  DATASET_VERSION,
  isCurrentDataset,
} from "./dataset-version";

describe("dataset-version", () => {
  it("DATASET_VERSION matches YYYY-MM format", () => {
    expect(DATASET_VERSION).toMatch(/^\d{4}-\d{2}$/);
  });

  it("DATASET_LABEL is non-empty and human-readable", () => {
    expect(DATASET_LABEL.length).toBeGreaterThan(0);
    expect(DATASET_LABEL).not.toBe(DATASET_VERSION); // distinct from the slug
  });

  it("DATASET_COVERAGE has all expected series", () => {
    expect(DATASET_COVERAGE.sensexAnnual).toBeDefined();
    expect(DATASET_COVERAGE.sensexMonthly).toBeDefined();
    expect(DATASET_COVERAGE.niftyComposite).toBeDefined();
    expect(DATASET_COVERAGE.niftyBank).toBeDefined();
    expect(DATASET_COVERAGE.niftyIT).toBeDefined();
    expect(DATASET_COVERAGE.niftyPharma).toBeDefined();
    expect(DATASET_COVERAGE.macroIndicatorsAnnual).toBeDefined();
  });
});

describe("isCurrentDataset", () => {
  it("treats no pin as current (null/undefined/empty)", () => {
    expect(isCurrentDataset(null)).toBe(true);
    expect(isCurrentDataset(undefined)).toBe(true);
    expect(isCurrentDataset("")).toBe(true);
  });

  it("returns true when pin matches current version", () => {
    expect(isCurrentDataset(DATASET_VERSION)).toBe(true);
  });

  it("returns false when pin differs", () => {
    expect(isCurrentDataset("2024-01")).toBe(false);
    expect(isCurrentDataset("2099-12")).toBe(false);
    expect(isCurrentDataset("not-a-version")).toBe(false);
  });
});
