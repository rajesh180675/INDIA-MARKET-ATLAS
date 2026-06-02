/**
 * CPI (Consumer Price Index) fetch script — PARAMETER-AWARE
 * Known params from verification: Level (required), baseYear, sector, year, month
 * This script tries sensible defaults; if they fail, it logs the error.
 */

const { fetchWithRetry, saveRawResponse } = require("./lib/http.cjs");
const { buildArtifact, saveArtifact, updateCatalog, ensureDir } = require("./lib/artifact.cjs");
const path = require("path");
const crypto = require("crypto");

const DATASET_ID = "CPI";
const API_BASE = "https://api.mospi.gov.in/api/cpi/getCPIData";
const RAW_DIR = path.resolve(__dirname, "../../data/raw/mospi/cpi");
const SOURCE_RUN_ID = `mospi-cpi-${new Date().toISOString().slice(0, 10)}`;

// Sensible default parameter matrix (from verification error messages)
const DEFAULT_PARAMS = [
  { Level: "All India", baseYear: "2012", sector: "Rural+Urban" },
  { Level: "All India", baseYear: "2024", sector: "Rural+Urban" },
  { Level: "State", baseYear: "2012", sector: "Rural" },
];

function makeUrl(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.append(k, v);
  }
  return `${API_BASE}?${q.toString()}`;
}

function parseCpiResponse(body) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`);
  }
  const data = parsed.data || [];
  if (!Array.isArray(data) || data.length === 0) {
    return { observations: [], indicators: [] };
  }

  const observations = [];
  const indicatorMap = new Map();

  for (const row of data) {
    const year = row.year;
    const month = row.month;
    if (!year || !month) continue;

    const monthNum = new Date(`${month} 1, 2000`).getMonth() + 1;
    const monthStr = String(monthNum).padStart(2, "0");
    const periodId = `${year}-${monthStr}`;

    const sector = (row.sector || "all").replace(/\s+/g, "_").toLowerCase();
    const group = (row.group || "all").replace(/\s+/g, "_").toLowerCase();
    const baseYear = row.baseYear || row.base_year || "2012";

    const indicatorCode = `${sector}.${group}`;
    const indicatorId = `CPI.${indicatorCode}.index.${baseYear}`;

    if (!indicatorMap.has(indicatorId)) {
      indicatorMap.set(indicatorId, {
        id: indicatorId,
        dataset: DATASET_ID,
        source_dataset_code: API_BASE,
        indicator_code: indicatorCode,
        name: `CPI — ${row.sector || "All"} — ${row.group || "All"}`,
        unit: "index",
        frequency: "monthly",
        geography_level: "india", // or state depending on Level param
        dimensions_schema: ["base_year", "sector"],
        base_year: baseYear,
        source_url: API_BASE,
        release_policy: "Base-year fork: 2012 vs 2024",
        default_transform: "level",
      });
    }

    const value = parseFloat(row.index_value || row.value || row.cpi_value);
    if (Number.isNaN(value)) continue;

    observations.push({
      indicator_id: indicatorId,
      geography_id: "IN", // would be state-level if Level=State
      period_id: periodId,
      value,
      unit: "index",
      dimensions: {
        base_year: baseYear,
        sector: row.sector || "all",
      },
      source_run_id: SOURCE_RUN_ID,
      quality_flags: [],
    });
  }

  return { observations, indicators: Array.from(indicatorMap.values()) };
}

async function main() {
  console.log(`[${DATASET_ID}] Attempting fetch with known parameter patterns...`);
  ensureDir(RAW_DIR);

  let bestResponse = null;
  let bestParams = null;
  let bestObsCount = 0;

  for (const params of DEFAULT_PARAMS) {
    const url = makeUrl(params);
    console.log(`  Trying: ${url}`);

    try {
      const response = await fetchWithRetry(url, { retries: 2 });
      const { filepath } = saveRawResponse(RAW_DIR, url, response);
      console.log(`    Raw saved: ${filepath}`);

      if (response.statusCode === 200) {
        const { observations, indicators } = parseCpiResponse(response.body);
        console.log(`    Parsed ${observations.length} observations`);

        if (observations.length > bestObsCount) {
          bestObsCount = observations.length;
          bestResponse = { response, observations, indicators };
          bestParams = params;
        }
      }
    } catch (err) {
      console.warn(`    Failed: ${err.message}`);
    }
  }

  if (!bestResponse || bestObsCount === 0) {
    console.error(`[${DATASET_ID}] No valid data returned. API may be rate-limited or parameter values incorrect.`);
    console.error(`  Known required param: Level (values unknown)`);
    console.error(`  Run: node scripts/discover/all-params.cjs when API is accessible.`);

    // Write empty artifact with source_unavailable
    const artifact = buildArtifact({
      dataset: DATASET_ID,
      title: "Consumer Price Index",
      source_status: "source_unavailable",
      source_run: {
        run_id: SOURCE_RUN_ID,
        fetched_at: new Date().toISOString(),
        source_url: API_BASE,
        parser_version: "cpi-api-v1",
        row_count: 0,
        warnings: ["API returned errors for all known parameter combinations"],
        errors: ["Parameter discovery needed"],
      },
      geographies: [{ geography_id: "IN", name: "India", type: "india", code_system: "ISO-3166-1", aliases: ["All India"] }],
      indicators: [],
      observations: [],
    });
    const artifactPath = saveArtifact(DATASET_ID, artifact);
    updateCatalog(DATASET_ID, "Consumer Price Index", artifactPath, "source_unavailable", 0);
    return artifact;
  }

  const { response, observations, indicators } = bestResponse;

  const sourceRun = {
    run_id: SOURCE_RUN_ID,
    fetched_at: new Date().toISOString(),
    source_url: makeUrl(bestParams),
    content_hash: crypto.createHash("sha256").update(response.body, "utf-8").digest("hex"),
    parser_version: "cpi-api-v1",
    row_count: observations.length,
    warnings: [],
    errors: [],
  };

  const artifact = buildArtifact({
    dataset: DATASET_ID,
    title: "Consumer Price Index",
    source_status: "ready",
    source_run: sourceRun,
    geographies: [{ geography_id: "IN", name: "India", type: "india", code_system: "ISO-3166-1", aliases: ["All India"] }],
    indicators,
    observations,
  });

  const artifactPath = saveArtifact(DATASET_ID, artifact);
  updateCatalog(DATASET_ID, "Consumer Price Index", artifactPath, "ready", observations.length);
  console.log(`  Artifact saved: ${artifactPath}`);
  return artifact;
}

if (require.main === module) {
  main().catch((err) => { console.error(`[${DATASET_ID}] FAILED: ${err.message}`); process.exit(1); });
}

module.exports = { main };
