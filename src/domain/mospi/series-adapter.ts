import { Series } from "../series";
import type { MospiObservation } from "./types";
import { fiscalYearStart } from "./period";

export function observationsToAnnualSeries(
  observations: ReadonlyArray<MospiObservation>,
  opts: {
    indicatorId: string;
    geographyId: string;
    label: string;
    unit: string;
  },
): Series {
  const points = observations
    .filter(
      (observation) =>
        observation.indicator_id === opts.indicatorId &&
        observation.geography_id === opts.geographyId,
    )
    .map((observation) => ({
      year: fiscalYearStart(observation.period_id),
      value: observation.value,
    }))
    .filter(
      (point): point is { year: number; value: number | null } => point.year !== null,
    );

  return new Series(opts.indicatorId, opts.label, opts.unit, points);
}
