/**
 * IIP (Index of Industrial Production) fetch script — PARAMETER-AWARE
 * Known params from verification: frequency (required), baseYear
 */

const { fetchWithRetry, saveRawResponse } = require("./lib/http.cjs");
const { buildArtifact, saveArtifact, updateCatalog, ensureDir } = require("./lib/artifact.cjs");
const path = require("path");
const crypto = require("crypto");

const DATASET_ID = "IIP";
const API_BASE = "https://api.mospi.gov.in/api/iip/getIipData";
const RAW_DIR = path.resolve(__dirname, "../../data/raw/mospi/iip");
const SOURCE_RUN_ID = `mospi-iip-${new Date().toISOString().slice(0, 10)}`;

const DEFAULT_PARAMS = [
  { frequency: "monthly", baseYear: "2011-12" },
  { frequency: "monthly", baseYear: "2022-23" },
  { frequency: "quarterly", baseYear: "2011-12" },
];

function makeUrl(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.append(k, v);
  }
  return `${API_BASE}?${q.toString()}`;
}

function parseIipResponse(body) {
  let parsed;
  try { parsed = JSON.parse(body); } catch (e) { throw new Error(`Invalid JSON: ${e.message}`); }
  const data = parsed.data || [];
  if (!Array.isArray(data) || data.length === 0) return { observations: [], indicators: [] };

  const observations = [];
  const indicatorMap = new Map();

  for (const row of data) {
    const year = row.year;
    const month = row.month;
    if (!year) continue;
    const monthStr = month ? String(new Date(`${month} 1, 2000`).getMonth() + 1).padStart(2, "0") : "01";
    const periodId = month ? `${year}-${monthStr}` : `${year}`;

    const sector = (row.sector || row.industry || "all").replace(/\s+/g, "_").toLowerCase();
    const baseYear = row.baseYear || row.base_year || "2011-12";
    const indicatorCode = sector;
    const indicatorId = `IIP.${indicatorCode}.index.${baseYear}`;

    if (!indicatorMap.has(indicatorId)) {
      indicatorMap.set(indicatorId, {
        id: indicatorId, dataset: DATASET_ID, source_dataset_code: API_BASE,
        indicator_code: indicatorCode, name: `IIP — ${row.sector || row.industry || "All"}`,
        unit: "index", frequency: "monthly", geography_level: "india",
        dimensions_schema: ["base_year"], base_year: baseYear,
        source_url: API_BASE, release_policy: "Base flip 1 Jun 2026: 2011-12 -> 2022-23",
        default_transform: "level",
      });
    }

    const value = parseFloat(row.index_value || row.value || row.iip_value);
    if (Number.isNaN(value)) continue;

    observations.push({
      indicator_id: indicatorId, geography_id: "IN", period_id: periodId,
      value, unit: "index", dimensions: { base_year: baseYear },
      source_run_id: SOURCE_RUN_ID, quality_flags: [],
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
        const { observations, indicators } = parseIipResponse(response.body);
        console.log(`    Parsed ${observations.length} observations`);
        if (observations.length > bestObsCount) {
          bestObsCount = observations.length;
          bestResponse = { response, observations, indicators };
          bestParams = params;
        }
      }
    } catch (err) { console.warn(`    Failed: ${err.message}`); }
  }

  if (!bestResponse || bestObsCount === 0) {
    console.error(`[${DATASET_ID}] No valid data. API may be rate-limited.`);
    const artifact = buildArtifact({
      dataset: DATASET_ID, title: "Index of Industrial Production", source_status: "source_unavailable",
      source_run: { run_id: SOURCE_RUN_ID, fetched_at: new Date().toISOString(), source_url: API_BASE,
        parser_version: "iip-api-v1", row_count: 0,
        warnings: ["API returned errors for all known parameter combinations"], errors: ["Parameter discovery needed"] },
      geographies: [{ geography_id: "IN", name: "India", type: "india", code_system: "ISO-3166-1", aliases: ["All India"] }],
      indicators: [], observations: [],
    });
    const artifactPath = saveArtifact(DATASET_ID, artifact);
    updateCatalog(DATASET_ID, "Index of Industrial Production", artifactPath, "source_unavailable", 0);
    return artifact;
  }

  const { response, observations, indicators } = bestResponse;
  const sourceRun = {
    run_id: SOURCE_RUN_ID, fetched_at: new Date().toISOString(),
    source_url: makeUrl(bestParams),
    content_hash: crypto.createHash("sha256").update(response.body, "utf-8").digest("hex"),
    parser_version: "iip-api-v1", row_count: observations.length, warnings: [], errors: [],
  };
  const artifact = buildArtifact({
    dataset: DATASET_ID, title: "Index of Industrial Production", source_status: "ready",
    source_run, geographies: [{ geography_id: "IN", name: "India", type: "india", code_system: "ISO-3166-1", aliases: ["All India"] }],
    indicators, observations,
  });
  const artifactPath = saveArtifact(DATASET_ID, artifact);
  updateCatalog(DATASET_ID, "Index of Industrial Production", artifactPath, "ready", observations.length);
  console.log(`  Artifact saved: ${artifactPath}`);
  return artifact;
}

if (require.main === module) {
  main().catch((err) => { console.error(`[${DATASET_ID}] FAILED: ${err.message}`); process.exit(1); });
}

module.exports = { main };
