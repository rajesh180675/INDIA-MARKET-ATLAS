import { describe, expect, it } from "vitest";
import { Series } from "../series";
import {
  buildObservationKey,
  findGeographyByName,
  fiscalYearPeriod,
  observationsToAnnualSeries,
  validateMospiObservations,
  type Geography,
  type MospiObservation,
} from "./index";

const geographies: Geography[] = [
  {
    geography_id: "IN-MH",
    name: "Maharashtra",
    type: "state",
    code_system: "ISO-3166-2",
    aliases: ["Maharastra"],
  },
  {
    geography_id: "IN-DL",
    name: "Delhi",
    type: "ut",
    code_system: "ISO-3166-2",
    aliases: ["NCT Delhi", "National Capital Territory of Delhi"],
  },
];

const baseObservation: MospiObservation = {
  indicator_id: "STATE_SDP.GSDP.current.2011-12",
  geography_id: "IN-MH",
  period_id: "FY2024-25",
  value: 100,
  unit: "₹ crore",
  dimensions: {
    price_basis: "current",
    base_year: "2011-12",
    revision: "latest",
  },
  source_run_id: "run-1",
  quality_flags: [],
};

describe("MOSPI domain contracts", () => {
  it("normalizes fiscal-year periods into stable ids and date bounds", () => {
    expect(fiscalYearPeriod("2024-25")).toEqual({
      period_id: "FY2024-25",
      frequency: "annual",
      year: 2024,
      fiscal_year: "2024-25",
      label: "2024-25",
      start_date: "2024-04-01",
      end_date: "2025-03-31",
    });
  });

  it("matches geographies by canonical name or alias without guessing from labels", () => {
    expect(findGeographyByName(geographies, " maharastra ")?.geography_id).toBe("IN-MH");
    expect(findGeographyByName(geographies, "NCT Delhi")?.geography_id).toBe("IN-DL");
    expect(findGeographyByName(geographies, "Bombay")).toBeNull();
  });

  it("builds duplicate-detection keys from the declared observation dimensions", () => {
    expect(buildObservationKey(baseObservation)).toBe(
      "STATE_SDP.GSDP.current.2011-12|IN-MH|FY2024-25|current|latest",
    );
  });

  it("validates numeric observations, duplicate keys, and geography coverage", () => {
    const duplicate = { ...baseObservation, value: 101 };
    const unknownGeography = { ...baseObservation, geography_id: "IN-XX", period_id: "FY2023-24" };
    const invalidNumber = { ...baseObservation, period_id: "FY2022-23", value: Number.NaN };

    const result = validateMospiObservations(
      [baseObservation, duplicate, unknownGeography, invalidNumber],
      geographies,
    );

    expect(result.validation_status).toBe("failed");
    expect(result.row_count).toBe(4);
    expect(result.duplicate_count).toBe(1);
    expect(result.invalid_geography_count).toBe(1);
    expect(result.invalid_value_count).toBe(1);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Duplicate observation key"),
        expect.stringContaining("Unknown geography_id IN-XX"),
        expect.stringContaining("Non-finite value"),
      ]),
    );
  });

  it("adapts a selected annual geography slice into the existing Series layer", () => {
    const series = observationsToAnnualSeries(
      [
        { ...baseObservation, period_id: "FY2023-24", value: 90 },
        { ...baseObservation, period_id: "FY2024-25", value: 100 },
      ],
      {
        indicatorId: "STATE_SDP.GSDP.current.2011-12",
        geographyId: "IN-MH",
        label: "Maharashtra GSDP",
        unit: "₹ crore",
      },
    );

    expect(series).toBeInstanceOf(Series);
    expect(series.years).toEqual([2023, 2024]);
    expect(series.at(2024)).toBe(100);
  });
});
