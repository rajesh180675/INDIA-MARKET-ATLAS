import type {
  Geography,
  MospiObservation,
  ObservationValidationReport,
} from "./types";
import { hasGeographyId } from "./geography";

export function buildObservationKey(observation: MospiObservation): string {
  const priceBasis = observation.dimensions.price_basis ?? "";
  const revision = observation.dimensions.revision ?? "";
  return [
    observation.indicator_id,
    observation.geography_id,
    observation.period_id,
    priceBasis,
    revision,
  ].join("|");
}

export function validateMospiObservations(
  observations: ReadonlyArray<MospiObservation>,
  geographies: ReadonlyArray<Geography>,
): ObservationValidationReport {
  const seen = new Set<string>();
  const warnings: string[] = [];
  let duplicateCount = 0;
  let invalidGeographyCount = 0;
  let invalidValueCount = 0;

  for (const observation of observations) {
    const key = buildObservationKey(observation);
    if (seen.has(key)) {
      duplicateCount++;
      warnings.push(`Duplicate observation key: ${key}`);
    } else {
      seen.add(key);
    }

    if (!hasGeographyId(geographies, observation.geography_id)) {
      invalidGeographyCount++;
      warnings.push(`Unknown geography_id ${observation.geography_id} for ${key}`);
    }

    if (observation.value !== null && !Number.isFinite(observation.value)) {
      invalidValueCount++;
      warnings.push(`Non-finite value for ${key}`);
    }
  }

  const failed = duplicateCount > 0 || invalidGeographyCount > 0 || invalidValueCount > 0;

  return {
    validation_status: failed ? "failed" : warnings.length > 0 ? "warning" : "passed",
    row_count: observations.length,
    duplicate_count: duplicateCount,
    invalid_geography_count: invalidGeographyCount,
    invalid_value_count: invalidValueCount,
    warnings,
  };
}
