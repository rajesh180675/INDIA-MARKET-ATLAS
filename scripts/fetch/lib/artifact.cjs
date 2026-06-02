/**
 * MoSPI artifact builder
 * Reads existing artifact, merges new observations, writes updated file.
 * Manages catalog.json updates.
 */

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, "public/data/mospi");
const CATALOG_PATH = path.join(PUBLIC_DATA_DIR, "catalog.json");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) {
    return {
      schema_version: "2026-06-mospi-public-catalog-v2",
      datasets: [],
    };
  }
  return JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
}

function saveCatalog(catalog) {
  ensureDir(PUBLIC_DATA_DIR);
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf-8");
}

function loadArtifact(datasetId) {
  const artifactPath = path.join(PUBLIC_DATA_DIR, `${datasetId.toLowerCase().replace(/_/g, "-")}-mvp.json`);
  if (!fs.existsSync(artifactPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
}

function buildArtifact({
  dataset,
  title,
  source_status,
  source_run,
  geographies,
  indicators,
  observations,
}) {
  const qualityReport = {
    validation_status: "passed",
    duplicate_count: 0,
    null_count: observations.filter((o) => o.value === null || o.value === undefined).length,
    outlier_count: 0,
    coverage: {},
  };

  // Check for duplicates on identity key
  const seen = new Set();
  for (const obs of observations) {
    const key = `${obs.indicator_id}|${obs.geography_id}|${obs.period_id}`;
    if (seen.has(key)) {
      qualityReport.duplicate_count++;
      obs.quality_flags = [...(obs.quality_flags || []), "DUPLICATE_KEY"];
    }
    seen.add(key);
  }

  if (qualityReport.duplicate_count > 0) {
    qualityReport.validation_status = "warning";
  }

  // Simple outlier check: reject NaN / Infinity
  for (const obs of observations) {
    if (typeof obs.value === "number" && (!Number.isFinite(obs.value) || Number.isNaN(obs.value))) {
      qualityReport.outlier_count++;
      obs.quality_flags = [...(obs.quality_flags || []), "NON_FINITE_VALUE"];
    }
  }

  if (qualityReport.outlier_count > 0) {
    qualityReport.validation_status = qualityReport.validation_status === "warning" ? "failed" : "warning";
  }

  return {
    schema_version: "2026-06-mospi-nas-gdp-mvp-v2",
    dataset,
    title,
    generated_at: new Date().toISOString(),
    source_status,
    source_runs: [source_run],
    geographies,
    indicators,
    observations,
    quality_report: qualityReport,
    warnings: source_status === "source_unavailable" ? ["Source returned no data"] : [],
  };
}

function saveArtifact(datasetId, artifact) {
  const filename = `${datasetId.toLowerCase().replace(/_/g, "-")}-mvp.json`;
  const artifactPath = path.join(PUBLIC_DATA_DIR, filename);
  ensureDir(PUBLIC_DATA_DIR);
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2) + "\n", "utf-8");
  return artifactPath;
}

function updateCatalog(datasetId, title, artifactPath, sourceStatus, observationCount) {
  const catalog = loadCatalog();
  const existingIndex = catalog.datasets.findIndex((d) => d.id === datasetId);
  const entry = {
    id: datasetId,
    title: title || datasetId,
    artifact: `/data/mospi/${path.basename(artifactPath)}`,
    source_status: sourceStatus,
    observation_count: observationCount,
  };

  if (existingIndex >= 0) {
    catalog.datasets[existingIndex] = entry;
  } else {
    catalog.datasets.push(entry);
  }

  saveCatalog(catalog);
}

module.exports = {
  loadCatalog,
  saveCatalog,
  loadArtifact,
  buildArtifact,
  saveArtifact,
  updateCatalog,
  ensureDir,
};
