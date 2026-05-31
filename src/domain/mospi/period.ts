import type { MospiPeriod } from "./types";

const FISCAL_YEAR_RE = /^(?:FY)?(\d{4})-(\d{2})$/;

export function fiscalYearPeriod(label: string): MospiPeriod {
  const trimmed = label.trim();
  const match = FISCAL_YEAR_RE.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid fiscal year label: ${label}`);
  }

  const startYear = Number(match[1]);
  const endYear = startYear + 1;
  const shortEnd = String(endYear).slice(-2);
  const fiscalYear = `${startYear}-${shortEnd}`;

  return {
    period_id: `FY${fiscalYear}`,
    frequency: "annual",
    year: startYear,
    fiscal_year: fiscalYear,
    label: fiscalYear,
    start_date: `${startYear}-04-01`,
    end_date: `${endYear}-03-31`,
  };
}

export function fiscalYearStart(periodId: string): number | null {
  const match = FISCAL_YEAR_RE.exec(periodId.trim());
  if (!match) return null;
  return Number(match[1]);
}
