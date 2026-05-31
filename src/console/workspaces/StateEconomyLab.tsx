import { useEffect, useMemo, useState } from "react";
import * as Plot from "@observablehq/plot";
import { downloadCsv } from "@/lib/csv";
import { formatNumber, formatPercent } from "@/lib/format";
import { FieldLabel, Readout, Segmented } from "../controls";
import PlotFigure from "../PlotFigure";
import { atlasColors } from "../theme-colors";
import { readInt, readList, readString, useAtlasState } from "../url-state";

type SourceStatus = "ready" | "source_unavailable" | "error";

type StateSdpArtifact = {
  schema_version: string;
  dataset: string;
  title: string;
  generated_at: string;
  source_status: SourceStatus;
  source_runs: Array<{
    run_id: string;
    fetched_at: string;
    source_url: string;
    source_file?: string;
    content_hash?: string;
    parser_version: string;
    row_count: number;
    warnings: string[];
    errors: string[];
  }>;
  geographies: Array<{
    geography_id: string;
    name: string;
    type: "india" | "state" | "ut" | "district";
  }>;
  indicators: Array<{
    id: string;
    indicator_code: string;
    name: string;
    unit: string;
    base_year?: string;
    price_basis?: string;
  }>;
  observations: StateSdpObservation[];
  quality_report: {
    validation_status: string;
    duplicate_count: number;
    null_count: number;
    outlier_count: number;
    total_reconciliation?: string;
    source_hash?: string;
    coverage: Record<string, string | number>;
  };
  warnings: string[];
  manual_source_path?: string;
};

type StateSdpObservation = {
  indicator_id: string;
  geography_id: string;
  period_id: string;
  value: number | null;
  unit: string;
  dimensions: {
    price_basis?: string;
    base_year?: string;
    revision?: string;
    sector?: string;
  };
  source_run_id: string;
  quality_flags: string[];
};

type DisplayRow = {
  geography_id: string;
  state: string;
  year: number;
  value: number;
  display: number;
};

const METRIC_OPTIONS = [
  { id: "GSDP", label: "GSDP" },
  { id: "NSDP", label: "NSDP" },
  { id: "PC_NSDP", label: "per-capita NSDP" },
  { id: "MANUFACTURING_GVA", label: "Manufacturing GVA" },
  { id: "AGRICULTURE_GVA", label: "Agriculture GVA" },
  { id: "INDUSTRY_GVA", label: "Industry GVA" },
  { id: "SERVICES_GVA", label: "Services GVA" },
] as const;

const PRICE_OPTIONS = [
  { id: "constant", label: "constant" },
  { id: "current", label: "current" },
] as const;

const NORMALIZATION_OPTIONS = [
  { id: "level", label: "level" },
  { id: "indexed", label: "indexed to 100" },
  { id: "cagr", label: "CAGR" },
  { id: "yoy", label: "YoY" },
  { id: "share", label: "share of India" },
] as const;

const DEFAULT_STATES = ["IN-MH", "IN-TN", "IN-GJ"];
const ARTIFACT_URL = "/data/mospi/state-sdp-mvp.json";

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="surface w-full px-3 py-2 text-[13px]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--ink)", background: "var(--surface)" }}
      >
        {children}
      </select>
    </label>
  );
}

function periodYear(periodId: string): number | null {
  const match = /^FY(\d{4})-\d{2}$/.exec(periodId);
  return match ? Number(match[1]) : null;
}

function cagr(start: number, end: number, years: number) {
  if (start <= 0 || end <= 0 || years <= 0) return null;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

function stateName(artifact: StateSdpArtifact | null, geographyId: string) {
  return artifact?.geographies.find((geo) => geo.geography_id === geographyId)?.name ?? geographyId;
}

export default function StateEconomyLab({ theme }: { theme: string }) {
  const { state, setParam, setParams } = useAtlasState();
  const metric = readString(state.params, "metric", "GSDP");
  const price = readString(state.params, "price", "constant") as "constant" | "current";
  const baseYear = readString(state.params, "base", "2011-12");
  const normalization = readString(state.params, "norm", "level") as
    | "level"
    | "indexed"
    | "cagr"
    | "yoy"
    | "share";
  const selectedStates = readList(state.params, "states");
  const activeStates = selectedStates.length > 0 ? selectedStates : DEFAULT_STATES;
  const from = readInt(state.params, "from", 2011);
  const to = readInt(state.params, "to", 2025);

  const [artifact, setArtifact] = useState<StateSdpArtifact | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(ARTIFACT_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<StateSdpArtifact>;
      })
      .then((data) => {
        if (!alive) return;
        setArtifact(data);
        setLoadError(null);
      })
      .catch((error: Error) => {
        if (!alive) return;
        setLoadError(error.message);
      });
    return () => {
      alive = false;
    };
  }, []);

  const colors = useMemo(() => {
    void theme;
    return atlasColors();
  }, [theme]);

  const selectedIndicator = artifact?.indicators.find(
    (indicator) =>
      indicator.indicator_code === metric &&
      indicator.price_basis === price &&
      (indicator.base_year ?? "2011-12") === baseYear,
  );

  const stateOptions = useMemo(
    () => artifact?.geographies.filter((geo) => geo.type === "state" || geo.type === "ut") ?? [],
    [artifact],
  );

  const rawRows = useMemo(() => {
    if (!artifact || !selectedIndicator) return [];
    return artifact.observations
      .filter((obs) =>
        obs.indicator_id === selectedIndicator.id &&
        activeStates.includes(obs.geography_id) &&
        obs.value != null,
      )
      .map((obs) => ({
        geography_id: obs.geography_id,
        state: stateName(artifact, obs.geography_id),
        year: periodYear(obs.period_id),
        value: obs.value,
      }))
      .filter((row): row is Omit<DisplayRow, "display"> =>
        row.year != null && row.year >= from && row.year <= to,
      )
      .sort((a, b) => a.year - b.year || a.state.localeCompare(b.state));
  }, [artifact, selectedIndicator, activeStates, from, to]);

  const displayRows = useMemo<DisplayRow[]>(() => {
    if (rawRows.length === 0) return [];
    const indiaByYear = new Map<number, number>();
    rawRows
      .filter((row) => row.geography_id === "IN")
      .forEach((row) => indiaByYear.set(row.year, row.value));

    return rawRows.map((row) => {
      const firstForState = rawRows.find((candidate) => candidate.geography_id === row.geography_id);
      const previousForState = rawRows
        .filter((candidate) => candidate.geography_id === row.geography_id && candidate.year < row.year)
        .slice(-1)[0];
      const indiaValue = indiaByYear.get(row.year);
      let display = row.value;
      if (normalization === "indexed" && firstForState && firstForState.value > 0) {
        display = (row.value / firstForState.value) * 100;
      } else if (normalization === "yoy" && previousForState && previousForState.value > 0) {
        display = ((row.value / previousForState.value) - 1) * 100;
      } else if (normalization === "share" && indiaValue && indiaValue > 0) {
        display = (row.value / indiaValue) * 100;
      }
      return { ...row, display };
    });
  }, [rawRows, normalization]);

  const rankedRows = useMemo(() => {
    return activeStates
      .map((geographyId) => {
        const rows = rawRows.filter((row) => row.geography_id === geographyId);
        if (rows.length === 0) return null;
        const first = rows[0];
        const latest = rows[rows.length - 1];
        return {
          geography_id: geographyId,
          state: stateName(artifact, geographyId),
          latestYear: latest.year,
          latestValue: latest.value,
          cagr: cagr(first.value, latest.value, latest.year - first.year),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
      .sort((a, b) => b.latestValue - a.latestValue);
  }, [activeStates, artifact, rawRows]);

  const chartOptions = useMemo(() => {
    if (displayRows.length === 0) return null;
    return {
      height: 360,
      marginLeft: 64,
      marginBottom: 42,
      grid: true,
      color: { legend: true, range: colors.cat },
      x: { label: "Fiscal year" },
      y: { label: normalization === "level" ? selectedIndicator?.unit : normalization },
      marks: [
        Plot.ruleY([0], { stroke: colors.rule }),
        Plot.lineY(displayRows, { x: "year", y: "display", stroke: "state", strokeWidth: 2 }),
        Plot.dot(displayRows, { x: "year", y: "display", stroke: "state", fill: "state", r: 3 }),
      ],
    };
  }, [colors, displayRows, normalization, selectedIndicator?.unit]);

  const csvRows = displayRows.map((row) => ({
    metric,
    price_basis: price,
    base_year: baseYear,
    state: row.state,
    fiscal_year: `${row.year}-${String(row.year + 1).slice(-2)}`,
    value: row.value,
    display_value: row.display,
    normalization,
  }));

  const sourceRun = artifact?.source_runs[0];
  const sourceReady = artifact?.source_status === "ready";
  const statusText = loadError
    ? `Artifact load failed: ${loadError}`
    : artifact
      ? artifact.source_status.replace(/_/g, " ")
      : "loading artifact";

  function toggleState(geographyId: string) {
    const next = activeStates.includes(geographyId)
      ? activeStates.filter((id) => id !== geographyId)
      : [...activeStates, geographyId];
    setParam("states", next.join(","));
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="surface p-4 sm:p-5">
          <div className="eyebrow">MOSPI MVP · State SDP</div>
          <h2 className="display mt-2 text-2xl">State SDP source discovery</h2>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            This is the greenfield State Economy Lab shell for MoSPI State Domestic Product,
            separate from the curated 16-indicator Macro Lab. It is backed by the public
            artifact at <span className="num">{ARTIFACT_URL}</span> and will render normalized
            observations as soon as the State SDP workbook is available or placed in the manual raw-data path.
          </p>
          <div
            className="mt-4 rule-l px-3 py-2 text-[13px]"
            role="status"
            style={{
              borderColor: sourceReady ? "var(--pos)" : "var(--neg)",
              background: sourceReady ? "var(--pos-wash)" : "var(--neg-wash)",
              color: "var(--ink)",
            }}
          >
            Source status: <span className="num">{statusText}</span>
          </div>
        </div>

        <div className="surface grid grid-cols-2 gap-4 p-4 sm:p-5">
          <Readout
            label="observations"
            value={artifact?.observations.length ?? null}
            caption="normalized rows emitted"
          />
          <Readout
            label="duplicates"
            value={artifact?.quality_report.duplicate_count ?? null}
            caption="quality gate"
            tone={(artifact?.quality_report.duplicate_count ?? 0) > 0 ? "neg" : "pos"}
          />
          <Readout
            label="nulls"
            value={artifact?.quality_report.null_count ?? null}
            caption="explicit missing values"
          />
          <Readout
            label="outliers"
            value={artifact?.quality_report.outlier_count ?? null}
            caption="large YoY jumps flagged"
          />
        </div>
      </section>

      <section className="surface grid gap-4 p-4 sm:p-5 lg:grid-cols-4">
        <Select label="metric" value={metric} onChange={(value) => setParam("metric", value)}>
          {METRIC_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </Select>

        <div>
          <FieldLabel>price basis</FieldLabel>
          <Segmented value={price} options={PRICE_OPTIONS} onChange={(value) => setParam("price", value)} ariaLabel="price basis" />
        </div>

        <Select label="base year" value={baseYear} onChange={(value) => setParam("base", value)}>
          <option value="2011-12">2011-12</option>
        </Select>

        <Select label="normalization" value={normalization} onChange={(value) => setParam("norm", value)}>
          {NORMALIZATION_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </Select>

        <div className="lg:col-span-4">
          <div className="flex items-center justify-between gap-3">
            <FieldLabel>state/UT multi-select</FieldLabel>
            <button
              type="button"
              className="segmented px-2 py-1 text-[11px]"
              onClick={() => setParams({ states: DEFAULT_STATES.join(",") })}
            >
              reset trio
            </button>
          </div>
          <div className="grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-4">
            {stateOptions.map((geo) => (
              <label key={geo.geography_id} className="num flex items-center gap-2 text-[12px]">
                <input
                  type="checkbox"
                  checked={activeStates.includes(geo.geography_id)}
                  onChange={() => toggleState(geo.geography_id)}
                />
                <span>{geo.name}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="surface p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">line chart</div>
              <h3 className="display text-xl">{selectedIndicator?.name ?? metric}</h3>
            </div>
            <button
              type="button"
              className="segmented px-3 py-2 text-[12px]"
              disabled={csvRows.length === 0}
              onClick={() => downloadCsv("state-sdp-view.csv", csvRows)}
            >
              CSV export
            </button>
          </div>
          {chartOptions ? (
            <PlotFigure options={chartOptions} ariaLabel="State SDP line chart" />
          ) : (
            <div className="rule-t pt-4 text-[13px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              No normalized State SDP observations are available yet. The UI controls and artifact
              contract are wired; numeric views remain fail-closed until the parser emits observations.
            </div>
          )}
        </div>

        <div className="surface p-4 sm:p-5">
          <div className="eyebrow">CAGR bar chart / ranked table</div>
          <h3 className="display mt-1 text-xl">Fastest states in selected window</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="eyebrow" style={{ color: "var(--ink-faint)" }}>
                <tr>
                  <th className="py-2 pr-3">state</th>
                  <th className="py-2 pr-3">latest</th>
                  <th className="py-2 pr-3">CAGR</th>
                </tr>
              </thead>
              <tbody className="num">
                {rankedRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="rule-t py-3" style={{ color: "var(--ink-soft)" }}>
                      Waiting for parsed observations.
                    </td>
                  </tr>
                ) : rankedRows.map((row) => (
                  <tr key={row.geography_id} className="rule-t">
                    <td className="py-2 pr-3">{row.state}</td>
                    <td className="py-2 pr-3">{formatNumber(row.latestValue, 0)} ({row.latestYear})</td>
                    <td className="py-2 pr-3">{row.cagr == null ? "—" : formatPercent(row.cagr, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="surface p-4 sm:p-5">
        <details open>
          <summary className="eyebrow cursor-pointer">source/provenance drawer</summary>
          <div className="mt-3 grid gap-3 text-[12px] lg:grid-cols-[160px_1fr]" style={{ color: "var(--ink-soft)" }}>
            <div className="eyebrow">dataset</div>
            <div>{artifact?.title ?? "State Domestic Product and other aggregates, 2011-2012 series"}</div>
            <div className="eyebrow">source run</div>
            <div className="num">{sourceRun?.run_id ?? "not loaded"}</div>
            <div className="eyebrow">source URL</div>
            <div className="num break-all">{sourceRun?.source_url ?? "—"}</div>
            <div className="eyebrow">source hash</div>
            <div className="num break-all">{artifact?.quality_report.source_hash ?? "—"}</div>
            <div className="eyebrow">manual fallback</div>
            <div className="num">{artifact?.manual_source_path ?? "data/raw/mospi/STATE_SDP/manual/<file>.xls"}</div>
            <div className="eyebrow">quality gates</div>
            <ul className="m-0 pl-4">
              <li>No duplicate observation key: {artifact?.quality_report.duplicate_count === 0 ? "pass" : "not passed"}</li>
              <li>India total reconciliation: {artifact?.quality_report.total_reconciliation ?? "not run"}</li>
              <li>Validation status: {artifact?.quality_report.validation_status ?? "loading"}</li>
            </ul>
            <div className="eyebrow">parser warnings</div>
            <ul className="m-0 pl-4">
              {(artifact?.warnings ?? ["Loading public artifact…"]).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        </details>
      </section>
    </div>
  );
}
