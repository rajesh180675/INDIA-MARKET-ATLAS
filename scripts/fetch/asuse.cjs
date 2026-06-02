/**
 * ASUSE (Annual Survey of Unincorporated Sector Enterprises) fetch script
 * Source: api.mospi.gov.in/api/asuse/getAsuseRecords
 * Verified 2026-06-02: returns real JSON with no auth
 */

const { fetchWithRetry, saveRawResponse } = require("./lib/http.cjs");
const { buildArtifact, saveArtifact, updateCatalog, ensureDir } = require("./lib/artifact.cjs");
const path = require("path");
const crypto = require("crypto");

const DATASET_ID = "ASUSE";
const API_URL = "https://api.mospi.gov.in/api/asuse/getAsuseRecords";
const RAW_DIR = path.resolve(__dirname, "../../data/raw/mospi/asuse");
const SOURCE_RUN_ID = `mospi-asuse-${new Date().toISOString().slice(0, 10)}`;

function normalizeGeography(name) {
  const map = {
    "all india": "IN",
    "andhra pradesh": "IN-AP",
    "arunachal pradesh": "IN-AR",
    "assam": "IN-AS",
    "bihar": "IN-BR",
    "chhattisgarh": "IN-CT",
    "goa": "IN-GA",
    "gujarat": "IN-GJ",
    "haryana": "IN-HR",
    "himachal pradesh": "IN-HP",
    "jharkhand": "IN-JH",
    "karnataka": "IN-KA",
    "kerala": "IN-KL",
    "madhya pradesh": "IN-MP",
    "maharashtra": "IN-MH",
    "manipur": "IN-MN",
    "meghalaya": "IN-ML",
    "mizoram": "IN-MZ",
    "nagaland": "IN-NL",
    "odisha": "IN-OR",
    "punjab": "IN-PB",
    "rajasthan": "IN-RJ",
    "sikkim": "IN-SK",
    "tamil nadu": "IN-TN",
    "telangana": "IN-TG",
    "tripura": "IN-TR",
    "uttar pradesh": "IN-UP",
    "uttarakhand": "IN-UT",
    "west bengal": "IN-WB",
    "andaman and nicobar islands": "IN-AN",
    "chandigarh": "IN-CH",
    "dadra and nagar haveli": "IN-DN",
    "daman and diu": "IN-DD",
    "delhi": "IN-DL",
    "jammu and kashmir": "IN-JK",
    "ladakh": "IN-LA",
    "lakshadweep": "IN-LD",
    "puducherry": "IN-PY",
  };
  const key = (name || "").toLowerCase().trim();
  return map[key] || null;
}

function parseAsuseResponse(body) {
  let data;
  try {
    const parsed = JSON.parse(body);
    data = parsed.data;
  } catch (e) {
    throw new Error(`Invalid JSON response: ${e.message}`);
  }

  if (!Array.isArray(data)) {
    throw new Error(`Expected data array, got ${typeof data}`);
  }

  const observations = [];
  const indicatorMap = new Map();

  for (const row of data) {
    const year = row.year;
    const stateName = row["state/UT"] || row.state || row.stateUt;
    const geoId = normalizeGeography(stateName);
    if (!geoId) continue;

    const periodId = year; // e.g. "2021-22"

    // indicator = ASUSE.<indicator_snippet>.<establishment_type>
    const indicatorName = (row.indicator || "unknown").replace(/\s+/g, "_").toLowerCase().substring(0, 40);
    const estType = (row.establishment_type || "all").replace(/\s+/g, "_").toLowerCase().substring(0, 30);
    const sector = (row.sector || "all").replace(/\s+/g, "_").toLowerCase();
    const activity = (row.activity_category || "all").replace(/\s+/g, "_").toLowerCase().substring(0, 30);

    const indicatorCode = `${indicatorName}.${estType}.${sector}.${activity}`;
    const indicatorId = `ASUSE.${indicatorCode}.count.annual`;

    if (!indicatorMap.has(indicatorId)) {
      indicatorMap.set(indicatorId, {
        id: indicatorId,
        dataset: DATASET_ID,
        source_dataset_code: API_URL,
        indicator_code: indicatorCode,
        name: `${row.indicator || "ASUSE"} — ${row.establishment_type || "All"}`,
        unit: "count",
        frequency: "annual",
        geography_level: geoId === "IN" ? "india" : "state",
        dimensions_schema: ["sector", "activity_category", "establishment_type"],
        source_url: API_URL,
        release_policy: "Irregular rounds; aggregates only",
        default_transform: "level",
      });
    }

    const value = parseFloat(row.value);
    if (Number.isNaN(value)) continue;

    observations.push({
      indicator_id: indicatorId,
      geography_id: geoId,
      period_id: periodId,
      value,
      unit: "count",
      dimensions: {
        sector: row.sector || "all",
        activity_category: row.activity_category || "all",
        establishment_type: row.establishment_type || "all",
      },
      source_run_id: SOURCE_RUN_ID,
      quality_flags: [],
    });
  }

  return {
    observations,
    indicators: Array.from(indicatorMap.values()),
  };
}

async function main() {
  console.log(`[${DATASET_ID}] Fetching from ${API_URL}`);

  ensureDir(RAW_DIR);

  const response = await fetchWithRetry(API_URL);
  if (response.statusCode !== 200) {
    throw new Error(`HTTP ${response.statusCode}`);
  }

  const { filepath } = saveRawResponse(RAW_DIR, API_URL, response);
  console.log(`  Raw response saved: ${filepath}`);

  const { observations, indicators } = parseAsuseResponse(response.body);
  console.log(`  Parsed ${observations.length} observations, ${indicators.length} indicators`);

  const sourceRun = {
    run_id: SOURCE_RUN_ID,
    fetched_at: new Date().toISOString(),
    source_url: API_URL,
    content_hash: crypto.createHash("sha256").update(response.body, "utf-8").digest("hex"),
    parser_version: "asuse-api-v1",
    row_count: observations.length,
    warnings: [],
    errors: [],
  };

  // Build geographies list
  const geoSet = new Set(observations.map((o) => o.geography_id));
  const geographies = Array.from(geoSet).map((geoId) => ({
    geography_id: geoId,
    name: geoId === "IN" ? "India" : geoId,
    type: geoId === "IN" ? "india" : "state",
    code_system: "ISO-3166-2",
    aliases: [],
  }));

  const artifact = buildArtifact({
    dataset: DATASET_ID,
    title: "Annual Survey of Unincorporated Sector Enterprises",
    source_status: observations.length > 0 ? "ready" : "source_unavailable",
    source_run: sourceRun,
    geographies,
    indicators,
    observations,
  });

  const artifactPath = saveArtifact(DATASET_ID, artifact);
  console.log(`  Artifact saved: ${artifactPath}`);

  updateCatalog(DATASET_ID, "Annual Survey of Unincorporated Sector Enterprises", artifactPath, artifact.source_status, observations.length);
  console.log(`  Catalog updated`);

  return artifact;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[${DATASET_ID}] FAILED: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { main, parseAsuseResponse };
