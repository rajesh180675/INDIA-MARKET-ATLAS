import { useEffect, useMemo, useState } from "react";
import * as Plot from "@observablehq/plot";
import { downloadCsv } from "@/lib/csv";
import { FieldLabel, Readout } from "../controls";
import PlotFigure from "../PlotFigure";
import { atlasColors } from "../theme-colors";
import { readString, useAtlasState } from "../url-state";

type SourceStatus = "ready" | "source_unavailable" | "declared_not_ingested" | "error";

interface MospiDataset {
  id: string;
  title: string;
  artifact: string;
  source_status: SourceStatus;
  observation_count: number;
}

interface MospiCatalog {
  schema_version: string;
  datasets: MospiDataset[];
}

interface MospiIndicator {
  id: string;
  dataset: string;
  indicator_code: string;
  name: string;
  unit: string;
  base_year?: string;
  price_basis?: string;
  frequency?: string;
  geography_level?: string;
  source_url?: string;
  dimensions_schema?: string[];
}

interface MospiArtifact {
  schema_version: string;
  dataset: string;
  title: string;
  source_status: SourceStatus;
  indicators: MospiIndicator[];
  geographies: Array<{
    geography_id: string;
    name: string;
    type: string;
  }>;
  observations: Array<{
    indicator_id: string;
    geography_id: string;
    period_id: string;
    value: number | null;
    unit: string;
    dimensions: Record<string, string | number | boolean | null>;
    source_run_id: string;
  }>;
  quality_report: {
    validation_status: string;
    duplicate_count: number;
    null_count: number;
    outlier_count: number;
    coverage: Record<string, string | number>;
  };
  source_runs: Array<{
    run_id: string;
    fetched_at: string;
    source_url: string;
    parser_version: string;
    row_count: number;
    warnings: string[];
    errors: string[];
  }>;
  warnings: string[];
}

interface LoadedArtifact extends MospiDataset {
  artifactData: MospiArtifact | null;
  loadError: string | null;
}

const CATALOG_URL = "/data/mospi/catalog.json";

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
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--ink)",
          background: "var(--surface)",
        }}
      >
        {children}
      </select>
    </label>
  );
}

export default function MospiExplorer({ theme }: { theme: string }) {
  const { state, setParam } = useAtlasState();
  const selectedDataset = readString(state.params, "mospi_dataset", "all");
  const searchQuery = readString(state.params, "mospi_search", "").toLowerCase().trim();
  const selectedIndicatorId = readString(state.params, "mospi_indicator", "all");
  const selectedGeography = readString(state.params, "mospi_geo", "all");

  const colors = useMemo(() => atlasColors(), [theme]);

  const [catalog, setCatalog] = useState<MospiCatalog | null>(null);
  const [artifacts, setArtifacts] = useState<LoadedArtifact[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Load catalog
  useEffect(() => {
    let alive = true;
    fetch(CATALOG_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<MospiCatalog>;
      })
      .then((data) => {
        if (!alive) return;
        setCatalog(data);
        setCatalogError(null);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setCatalogError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Load each artifact
  useEffect(() => {
    if (!catalog) return;
    let alive = true;
    const promises = catalog.datasets.map(async (dataset) => {
      try {
        const res = await fetch(dataset.artifact);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const artifact: MospiArtifact = await res.json();
        return { ...dataset, artifactData: artifact, loadError: null } as LoadedArtifact;
      } catch (e) {
        return { ...dataset, artifactData: null, loadError: (e as Error).message } as LoadedArtifact;
      }
    });
    Promise.all(promises).then((results) => {
      if (!alive) return;
      setArtifacts(results);
    });
    return () => {
      alive = false;
    };
  }, [catalog]);

  const allIndicators = useMemo(() => {
    const result: (MospiIndicator & { datasetId: string; artifactStatus: SourceStatus; source_url?: string })[] = [];
    artifacts.forEach((a) => {
      if (!a.artifactData) return;
      a.artifactData.indicators.forEach((ind) => {
        result.push({
          ...ind,
          datasetId: a.id,
          artifactStatus: a.artifactData?.source_status ?? a.source_status,
          source_url: ind.source_url ?? (a.artifactData?.source_runs[0]?.source_url),
        });
      });
    });
    return result;
  }, [artifacts]);

  // Auto-select first indicator when dataset changes (so chart appears immediately)
  useEffect(() => {
    if (selectedDataset === "all") return;
    const firstInd = allIndicators.find((i) => i.dataset === selectedDataset);
    if (firstInd && selectedIndicatorId !== firstInd.id) {
      setParam("mospi_indicator", firstInd.id);
    }
  }, [selectedDataset, allIndicators, selectedIndicatorId, setParam]);

  const filteredIndicators = useMemo(() => {
    return allIndicators.filter((ind) => {
      if (selectedDataset !== "all" && ind.dataset !== selectedDataset) return false;
      if (searchQuery) {
        const haystack = `${ind.name} ${ind.indicator_code} ${ind.id}`.toLowerCase();
        if (!haystack.includes(searchQuery)) return false;
      }
      return true;
    });
  }, [allIndicators, selectedDataset, searchQuery]);

  const selectedIndicator = useMemo(() => {
    if (selectedIndicatorId === "all") return null;
    return allIndicators.find((i) => i.id === selectedIndicatorId) ?? null;
  }, [allIndicators, selectedIndicatorId]);

  const selectedArtifact = useMemo(() => {
    if (!selectedIndicator) return null;
    return artifacts.find((a) => a.id === selectedIndicator.datasetId) ?? null;
  }, [artifacts, selectedIndicator]);

  const selectedObservations = useMemo(() => {
    if (!selectedIndicator || !selectedArtifact?.artifactData) return [];
    return selectedArtifact.artifactData.observations.filter((obs) => {
      if (obs.indicator_id !== selectedIndicator.id) return false;
      if (selectedGeography !== "all" && obs.geography_id !== selectedGeography) return false;
      // Apply dynamic dimension filters
      if (selectedIndicator.dimensions_schema) {
        for (const dim of selectedIndicator.dimensions_schema as string[]) {
          const dimValue = readString(state.params, `mospi_dim_${dim}`, "all");
          if (dimValue !== "all") {
            const obsVal = obs.dimensions[dim];
            if (obsVal == null || String(obsVal) !== dimValue) return false;
          }
        }
      }
      return obs.value !== null;
    });
  }, [selectedIndicator, selectedArtifact, selectedGeography, state.params]);

  const dimensionControls = useMemo(() => {
    if (!selectedIndicator?.dimensions_schema || !selectedArtifact?.artifactData) return [];
    return selectedIndicator.dimensions_schema.map((dim) => {
      const valueSet = new Set<string>();
      selectedArtifact.artifactData!.observations
        .filter((o) => o.indicator_id === selectedIndicator.id)
        .forEach((o) => {
          const val = o.dimensions[dim];
          if (val != null) valueSet.add(String(val));
        });
      return {
        name: dim,
        label: dim.replace(/_/g, " "),
        values: Array.from(valueSet).sort(),
        selected: readString(state.params, `mospi_dim_${dim}`, "all"),
      };
    });
  }, [selectedIndicator, selectedArtifact, state.params]);

  const chartOptions = useMemo(() => {
    if (selectedObservations.length === 0) return null;

    const geoNames: Record<string, string> = {};
    selectedArtifact?.artifactData?.geographies.forEach((g: { geography_id: string; name?: string }) => {
      geoNames[g.geography_id] = g.name || g.geography_id;
    });

    // --- Robust period parsing ---
    function parseYear(pid: string): number {
      // FY2024-25, Q1_FY2025-26, FY2025_26, etc.
      const fyMatch = pid.match(/FY(\d{4})/i);
      if (fyMatch) return Number(fyMatch[1]);
      // Plain year prefix: 2024-25, 2026-04, 2025
      const yearMatch = pid.match(/^(\d{4})/);
      if (yearMatch) return Number(yearMatch[1]);
      return 0;
    }

    // --- Detect data shape ---
    const uniquePeriods = new Set(selectedObservations.map((o) => o.period_id)).size;
    const uniqueGeographies = new Set(selectedObservations.map((o) => o.geography_id)).size;

    const isTimeSeries = uniquePeriods >= 2 && selectedObservations.length >= 2;
    const isPanelGeo = uniqueGeographies >= 3;

    const c = colors;

    if (isTimeSeries && !isPanelGeo) {
      // Classic line chart: one indicator across time
      const points = selectedObservations
        .map((obs) => ({
          year: parseYear(obs.period_id),
          value: obs.value!,
          geography: geoNames[obs.geography_id] ?? obs.geography_id,
        }))
        .filter((p) => p.year > 0);
      if (points.length === 0) return null;
      return {
        height: 320,
        marginLeft: 64,
        marginBottom: 42,
        grid: true,
        color: { legend: true, range: c.cat },
        x: { label: "Year", tickFormat: (d: number) => String(d) },
        y: { label: selectedIndicator?.unit ?? "value" },
        marks: [
          Plot.ruleY([0], { stroke: c.rule }),
          Plot.lineY(points, { x: "year", y: "value", stroke: "geography", strokeWidth: 2, curve: "monotone-x" }),
          Plot.dot(points, { x: "year", y: "value", stroke: "geography", fill: "geography", r: 3 }),
        ],
      };
    }

    if (isPanelGeo) {
      // Many geographies — grouped bar or dot plot
      const points = selectedObservations.map((obs) => ({
        geography: geoNames[obs.geography_id] ?? obs.geography_id,
        year: parseYear(obs.period_id),
        period: obs.period_id,
        value: obs.value!,
      }));
      if (uniquePeriods >= 2) {
        // Grouped bar by geography, color by period
        return {
          height: Math.max(240, uniqueGeographies * 18 + 80),
          marginLeft: 120,
          marginBottom: 42,
          grid: true,
          color: { legend: true, range: c.cat },
          x: { label: selectedIndicator?.unit ?? "value" },
          y: { label: null },
          marks: [
            Plot.ruleX([0], { stroke: c.rule }),
            Plot.barX(points, { y: "geography", x: "value", fill: "period", sort: { y: "-x" } }),
          ],
        };
      }
      // Single period — horizontal bar sorted by value
      return {
        height: Math.max(240, uniqueGeographies * 18 + 80),
        marginLeft: 120,
        marginBottom: 42,
        grid: true,
        x: { label: selectedIndicator?.unit ?? "value" },
        y: { label: null },
        marks: [
          Plot.ruleX([0], { stroke: c.rule }),
          Plot.barX(points, { y: "geography", x: "value", fill: c.cat[0], sort: { y: "-x" } }),
          Plot.text(points, { y: "geography", x: "value", text: (d: { value: number }) => d.value.toLocaleString("en-IN"), dx: 4, textAnchor: "start", fontSize: 10, fill: c.ink }),
        ],
      };
    }

    // Fallback: dot plot for sparse / single values
    const points = selectedObservations.map((obs) => ({
      period: obs.period_id,
      value: obs.value!,
      geography: geoNames[obs.geography_id] ?? obs.geography_id,
    }));
    return {
      height: 280,
      marginLeft: 64,
      marginBottom: 42,
      grid: true,
      x: { label: "Period" },
      y: { label: selectedIndicator?.unit ?? "value" },
      marks: [
        Plot.ruleY([0], { stroke: c.rule }),
        Plot.dot(points, { x: "period", y: "value", stroke: c.cat[0], fill: c.cat[0], r: 5 }),
        Plot.text(points, { x: "period", y: "value", text: (d: { value: number }) => d.value.toLocaleString("en-IN"), dy: -10, fontSize: 10, fill: c.ink }),
      ],
    };
  }, [selectedObservations, selectedArtifact, selectedIndicator, colors]);

  // Dataset overview chart: all indicators for latest period (cross-sectional ranking)
  const datasetChart = useMemo(() => {
    if (selectedDataset === "all") return null;
    const artifact = artifacts.find((a) => a.id === selectedDataset);
    if (!artifact?.artifactData || artifact.artifactData.observations.length === 0) return null;

    // Find latest period
    const periods = [...new Set(artifact.artifactData.observations.map((o) => o.period_id))];
    const latestPeriod = periods.sort().pop();
    if (!latestPeriod) return null;

    // Aggregate: one bar per indicator, latest period only
    const indNames: Record<string, string> = {};
    artifact.artifactData.indicators.forEach((ind) => {
      indNames[ind.id] = ind.name.length > 40 ? ind.name.slice(0, 40) + "…" : ind.name;
    });

    const points = artifact.artifactData.observations
      .filter((o) => o.period_id === latestPeriod && o.value != null)
      .map((o) => ({
        indicator: indNames[o.indicator_id] ?? o.indicator_id,
        value: o.value!,
        unit: o.unit,
      }));

    if (points.length === 0) return null;

    const c = colors;
    return {
      chart: {
        height: Math.max(240, points.length * 22 + 80),
        marginLeft: 200,
        marginBottom: 42,
        grid: true,
        x: { label: points[0]?.unit ?? "value" },
        y: { label: null },
        marks: [
          Plot.ruleX([0], { stroke: c.rule }),
          Plot.barX(points, { y: "indicator", x: "value", fill: c.cat[0], sort: { y: "-x" } }),
          Plot.text(points, {
            y: "indicator",
            x: "value",
            text: (d: { value: number }) => d.value.toLocaleString("en-IN"),
            dx: 4,
            textAnchor: "start",
            fontSize: 10,
            fill: c.ink,
          }),
        ],
      } as import("@observablehq/plot").PlotOptions,
      title: `${artifact.title} — ${latestPeriod}`,
    };
  }, [selectedDataset, artifacts, colors]);

  const indicatorOptions = useMemo(() => {
    return filteredIndicators.map((i) => ({ id: i.id, label: `${i.name} (${i.indicator_code}) — ${i.datasetId}` }));
  }, [filteredIndicators]);

  const geographiesForSelected = useMemo(() => {
    if (!selectedArtifact?.artifactData) return [];
    const geoSet = new Set<string>();
    selectedArtifact.artifactData.observations
      .filter((o) => o.indicator_id === (selectedIndicator?.id ?? ""))
      .forEach((o) => geoSet.add(o.geography_id));
    return Array.from(geoSet).sort();
  }, [selectedArtifact, selectedIndicator]);

  const statusColor = (status: SourceStatus) => {
    switch (status) {
      case "ready":
        return { borderColor: "var(--pos)", background: "var(--pos-wash)" };
      case "source_unavailable":
        return { borderColor: "var(--warn)", background: "var(--warn-wash)" };
      case "declared_not_ingested":
        return { borderColor: "var(--ink-faint)", background: "var(--surface)" };
      case "error":
        return { borderColor: "var(--neg)", background: "var(--neg-wash)" };
      default:
        return { borderColor: "var(--rule)", background: "var(--surface)" };
    }
  };

  const exportCsv = () => {
    if (selectedObservations.length === 0) return;
    const rows = selectedObservations.map((obs) => ({
      indicator_id: obs.indicator_id,
      geography_id: obs.geography_id,
      period_id: obs.period_id,
      value: obs.value ?? "",
      unit: obs.unit,
      dimensions: JSON.stringify(obs.dimensions),
      source_run_id: obs.source_run_id,
    }));
    downloadCsv("mospi-explorer.csv", rows);
  };

  return (
    <div className="space-y-6">
      {/* Header: catalog status */}
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="surface p-4 sm:p-5">
          <div className="eyebrow">MOSPI Explorer</div>
          <h2 className="display mt-2 text-2xl">Dataset browser</h2>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
            Browse all available MoSPI datasets, search indicators, inspect dimensions,
            and export observations. Datasets with no observations are shown as declared
            but not yet ingested.
          </p>
          {catalogError && (
            <div
              className="mt-3 rounded px-3 py-2 text-[13px]"
              style={{ border: "1px solid var(--neg)", background: "var(--neg-wash)", color: "var(--ink)" }}
            >
              Catalog load error: {catalogError}
            </div>
          )}
        </div>

        <div className="surface grid grid-cols-2 gap-4 p-4 sm:p-5">
          <Readout
            label="datasets"
            value={catalog?.datasets.length ?? null}
            caption="in catalog"
          />
          <Readout
            label="indicators"
            value={allIndicators.length}
            caption="across all datasets"
          />
          <Readout
            label="declared"
            value={artifacts.filter((a) => a.source_status === "declared_not_ingested").length}
            caption="not yet ingested"
            tone="faint"
          />
          <Readout
            label="unavailable"
            value={artifacts.filter((a) => a.source_status === "source_unavailable").length}
            caption="source 404 / stale"
            tone="warn"
          />
        </div>
      </section>

      {/* Filters */}
      <section className="surface grid gap-4 p-4 sm:p-5 lg:grid-cols-4">
        <Select
          label="dataset"
          value={selectedDataset}
          onChange={(v) => setParam("mospi_dataset", v)}
        >
          <option value="all">All datasets</option>
          {catalog?.datasets.map((ds) => (
            <option key={ds.id} value={ds.id}>{ds.id} — {ds.title}</option>
          ))}
        </Select>

        <div className="lg:col-span-2">
          <FieldLabel>indicator search</FieldLabel>
          <input
            type="text"
            aria-label="indicator search"
            value={searchQuery}
            onChange={(e) => setParam("mospi_search", e.target.value)}
            placeholder="Search name, code, or ID..."
            className="surface w-full px-3 py-2 text-[13px]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink)", background: "var(--surface)" }}
          />
        </div>

        <Select
          label="indicator"
          value={selectedIndicatorId}
          onChange={(v) => setParam("mospi_indicator", v)}
        >
          <option value="all">All indicators</option>
          {indicatorOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </Select>

        <Select
          label="geography"
          value={selectedGeography}
          onChange={(v) => setParam("mospi_geo", v)}
        >
          <option value="all">All geographies</option>
          {geographiesForSelected.map((geo) => (
            <option key={geo} value={geo}>{geo}</option>
          ))}
        </Select>

        {dimensionControls.map((dim: { name: string; label: string; values: string[]; selected: string }) => (
          <Select
            key={dim.name}
            label={dim.label}
            value={dim.selected}
            onChange={(v) => setParam(`mospi_dim_${dim.name}`, v)}
          >
            <option value="all">All {dim.label}</option>
            {dim.values.map((val: string) => (
              <option key={val} value={val}>{val}</option>
            ))}
          </Select>
        ))}
      </section>

      {/* Dataset cards */}
      <section className="grid gap-4 lg:grid-cols-2">
        {artifacts.map((artifact) => {
          const s = artifact.artifactData?.source_status ?? artifact.source_status;
          const cols = statusColor(s);
          return (
            <div
              key={artifact.id}
              className="surface p-4 sm:p-5"
              style={{ borderLeft: `4px solid ${cols.borderColor}` }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="eyebrow">{artifact.id}</div>
                  <h3 className="display text-lg">{artifact.title}</h3>
                </div>
                <span
                  className="rounded px-2 py-1 text-[11px] uppercase tracking-wide"
                  style={{ background: cols.background, border: `1px solid ${cols.borderColor}`, color: "var(--ink)" }}
                >
                  {s.replace(/_/g, " ")}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]" style={{ color: "var(--ink-soft)" }}>
                <div>
                  <div className="eyebrow">indicators</div>
                  <div className="num">{artifact.artifactData?.indicators.length ?? 0}</div>
                </div>
                <div>
                  <div className="eyebrow">observations</div>
                  <div className="num">{artifact.artifactData?.observations.length ?? 0}</div>
                </div>
                <div>
                  <div className="eyebrow">sensor</div>
                  <div className="num">{artifact.observation_count ?? 0}</div>
                </div>
              </div>
              {artifact.loadError && (
                <div className="mt-2 text-[12px]" style={{ color: "var(--neg)" }}>
                  Load error: {artifact.loadError}
                </div>
              )}
              {artifact.artifactData?.warnings && artifact.artifactData.warnings.length > 0 && (
                <div className="mt-2 space-y-1">
                  {artifact.artifactData.warnings.map((w, i) => (
                    <div key={i} className="text-[11px]" style={{ color: "var(--warn)" }}>
                      {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Dataset overview chart */}
      {datasetChart && (
        <section className="surface p-4 sm:p-5">
          <div className="mb-3">
            <div className="eyebrow">dataset overview</div>
            <h3 className="display text-xl">{datasetChart.title}</h3>
          </div>
          <PlotFigure options={datasetChart.chart} ariaLabel="Dataset overview chart" />
        </section>
      )}

      {/* Indicator detail + observations */}
      {selectedIndicator && selectedArtifact && (
        <section className="surface p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="eyebrow">Indicator detail</div>
              <h3 className="display mt-1 text-xl">{selectedIndicator.name}</h3>
              <div className="mt-1 text-[12px]" style={{ color: "var(--ink-soft)" }}>
                <span className="num">{selectedIndicator.id}</span> · {selectedIndicator.indicator_code} · {selectedIndicator.unit}
                {selectedIndicator.base_year && ` · base year ${selectedIndicator.base_year}`}
                {selectedIndicator.price_basis && ` · ${selectedIndicator.price_basis} prices`}
              </div>
            </div>
            <button
              type="button"
              className="segmented px-3 py-2 text-[12px]"
              disabled={selectedObservations.length === 0}
              onClick={exportCsv}
            >
              CSV export
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="eyebrow" style={{ color: "var(--ink-faint)" }}>
                <tr>
                  <th className="py-2 pr-3">geography</th>
                  <th className="py-2 pr-3">period</th>
                  <th className="py-2 pr-3">value</th>
                  <th className="py-2 pr-3">unit</th>
                  <th className="py-2 pr-3">dimensions</th>
                </tr>
              </thead>
              <tbody className="num">
                {selectedObservations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="rule-t py-3" style={{ color: "var(--ink-soft)" }}>
                      No observations available for this indicator. The dataset may be declared but not yet ingested.
                    </td>
                  </tr>
                ) : (
                  selectedObservations.map((obs, idx) => (
                    <tr key={idx} className="rule-t">
                      <td className="py-2 pr-3">{obs.geography_id}</td>
                      <td className="py-2 pr-3">{obs.period_id}</td>
                      <td className="py-2 pr-3">{obs.value?.toLocaleString() ?? "—"}</td>
                      <td className="py-2 pr-3">{obs.unit}</td>
                      <td className="py-2 pr-3 font-mono text-[11px]">{JSON.stringify(obs.dimensions)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Chart */}
      {chartOptions && (
        <section className="surface p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">chart</div>
              <h3 className="display text-xl">{selectedIndicator?.name}</h3>
            </div>
          </div>
          <PlotFigure options={chartOptions} ariaLabel={`${selectedIndicator?.name} chart`} />
        </section>
      )}

      {/* Provenance panel */}
      {selectedArtifact?.artifactData && (
        <section className="surface p-4 sm:p-5">
          <details open>
            <summary className="eyebrow cursor-pointer">provenance + quality</summary>
            <div className="mt-3 grid gap-2 text-[12px] lg:grid-cols-[160px_1fr]" style={{ color: "var(--ink-soft)" }}>
              <div className="eyebrow">schema version</div>
              <div className="num">{selectedArtifact.artifactData.schema_version}</div>
              <div className="eyebrow">dataset</div>
              <div>{selectedArtifact.artifactData.title}</div>
              <div className="eyebrow">source status</div>
              <div className="num">{selectedArtifact.artifactData.source_status.replace(/_/g, " ")}</div>
              <div className="eyebrow">source runs</div>
              <div className="space-y-1">
                {selectedArtifact.artifactData.source_runs.map((run) => (
                  <div key={run.run_id}>
                    <div className="num">{run.run_id}</div>
                    <div className="text-[11px]">{run.source_url}</div>
                    <div className="text-[11px]">parser: {run.parser_version} · rows: {run.row_count}</div>
                  </div>
                ))}
              </div>
              <div className="eyebrow">quality report</div>
              <div className="grid grid-cols-3 gap-2">
                <div>duplicates: <span className="num">{selectedArtifact.artifactData.quality_report.duplicate_count}</span></div>
                <div>nulls: <span className="num">{selectedArtifact.artifactData.quality_report.null_count}</span></div>
                <div>outliers: <span className="num">{selectedArtifact.artifactData.quality_report.outlier_count}</span></div>
                <div className="col-span-3 text-[11px]">
                  validation: <span className="num">{selectedArtifact.artifactData.quality_report.validation_status}</span>
                </div>
              </div>
              <div className="eyebrow">warnings</div>
              <div className="space-y-1">
                {selectedArtifact.artifactData.warnings.length === 0 ? (
                  <div>—</div>
                ) : (
                  selectedArtifact.artifactData.warnings.map((w, i) => (
                    <div key={i} className="text-[11px]" style={{ color: "var(--warn)" }}>{w}</div>
                  ))
                )}
              </div>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
