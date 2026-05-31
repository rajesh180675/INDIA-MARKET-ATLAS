export type MospiFrequency = "annual" | "quarterly" | "monthly" | "survey_round";
export type GeographyType = "india" | "state" | "ut" | "district";
export type PriceBasis = "current" | "constant" | "index" | "percent" | "count";
export type ValidationStatus = "passed" | "warning" | "failed";

export interface IndicatorDefinition {
  id: string;
  dataset: string;
  source_dataset_code: string;
  indicator_code: string;
  name: string;
  description?: string;
  unit: string;
  frequency: MospiFrequency;
  geography_level: GeographyType;
  dimensions_schema: string[];
  base_year?: string;
  price_basis?: PriceBasis;
  source_url?: string;
  endpoint?: string;
  release_policy?: string;
  default_transform?: string;
}

export interface MospiObservation {
  indicator_id: string;
  geography_id: string;
  period_id: string;
  value: number | null;
  unit: string;
  dimensions: Record<string, string | number | boolean | null>;
  source_run_id: string;
  quality_flags: string[];
}

export interface Geography {
  geography_id: string;
  name: string;
  type: GeographyType;
  code_system: string;
  aliases: string[];
}

export interface MospiPeriod {
  period_id: string;
  frequency: MospiFrequency;
  year?: number;
  fiscal_year?: string;
  quarter?: number;
  month?: number;
  label: string;
  start_date: string;
  end_date: string;
}

export interface SourceRun {
  run_id: string;
  fetched_at: string;
  source_url: string;
  source_file?: string;
  content_hash?: string;
  parser_version: string;
  row_count: number;
  warnings: string[];
  errors: string[];
}

export interface MospiQualityReport {
  dataset: string;
  indicator_id?: string;
  coverage: Record<string, string | number>;
  null_count: number;
  duplicate_count: number;
  outlier_count: number;
  total_reconciliation?: string;
  source_hash?: string;
  validation_status: ValidationStatus;
}

export interface ObservationValidationReport {
  validation_status: ValidationStatus;
  row_count: number;
  duplicate_count: number;
  invalid_geography_count: number;
  invalid_value_count: number;
  warnings: string[];
}
