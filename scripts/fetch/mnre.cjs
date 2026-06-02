/**
 * MNRE (Ministry of New and Renewable Energy) fetch script
 * Source: api.mospi.gov.in/api/mnre/getDataByEnergy
 * Verified 2026-06-02: returns real JSON, paginated (40586 total records)
 */

const { fetchWithRetry, saveRawResponse } = require("./lib/http.cjs");
const { buildArtifact, saveArtifact, updateCatalog, ensureDir } = require("./lib/artifact.cjs");
const path = require("path");
const crypto = require("crypto");

const DATASET_ID = "MNRE";
const API_BASE = "https://api.mospi.gov.in/api/mnre/getDataByEnergy";
const RAW_DIR = path.resolve(__dirname, "../../data/raw/mospi/mnre");
const SOURCE_RUN_ID = `mospi-mnre-${new Date().toISOString().slice(0, 10)}`;

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
  };
  const key = (name || "").toLowerCase().trim();
  return map[key] || null;
}

function parseMnrePage(body) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    throw new Error(`Invalid JSON response: ${e.message}`);
  }

  const data = parsed.data || [];
  const meta = parsed.meta_data || parsed.metadata || {};

  const observations = [];
  const indicatorMap = new Map();

  for (const row of data) {
    const year = row.year;
    const month = row.month;
    const stateName = row.state;
    if (!year || !month) continue;

    const geoId = normalizeGeography(stateName) || "IN";
    const monthNum = new Date(`${month} 1, 2000`).getMonth() + 1;
    const monthStr = String(monthNum).padStart(2, "0");
    const periodId = `${year}-${monthStr}`;

    const energyType = (row.type_of_renewable_energy || "unknown").replace(/\s+/g, "_").toLowerCase();
    const category = (row.category || "all").replace(/\s+/g, "_").toLowerCase();

    const indicatorCode = `${energyType}.${category}`;
    const indicatorId = `MNRE.${indicatorCode}.mw.monthly`;

    if (!indicatorMap.has(indicatorId)) {
      indicatorMap.set(indicatorId, {
        id: indicatorId,
        dataset: DATASET_ID,
        source_dataset_code: API_BASE,
        indicator_code: indicatorCode,
        name: `${row.type_of_renewable_energy || "Renewable"} — ${row.category || "All"}`,
        unit: "MW",
        frequency: "monthly",
        geography_level: geoId === "IN" ? "india" : "state",
        dimensions_schema: ["energy_type", "category"],
        source_url: API_BASE,
        release_policy: "MNRE upstream mirror",
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
      unit: "MW",
      dimensions: {
        energy_type: row.type_of_renewable_energy || "unknown",
        category: row.category || "all",
      },
      source_run_id: SOURCE_RUN_ID,
      quality_flags: ["PAGINATED_SOURCE"],
    });
  }

  return { observations, indicators: Array.from(indicatorMap.values()), meta };
}

async function fetchAllPages() {
  const allObservations = [];
  const allIndicators = new Map();
  let page = 1;
  let totalPages = 1;
  let totalRecords = 0;
  const rawPaths = [];

  do {
    const url = `${API_BASE}?page=${page}`;
    console.log(`  Fetching page ${page}...`);

    const response = await fetchWithRetry(url);
    if (response.statusCode !== 200) {
      throw new Error(`HTTP ${response.statusCode} on page ${page}`);
    }

    const { filepath, meta } = saveRawResponse(RAW_DIR, url, response);
    rawPaths.push(filepath);

    const { observations, indicators, meta: pageMeta } = parseMnrePage(response.body);
    console.log(`    Page ${page}: ${observations.length} observations, ${indicators.length} indicators`);

    for (const obs of observations) allObservations.push(obs);
    for (const ind of indicators) allIndicators.set(ind.id, ind);

    totalPages = pageMeta.totalPages || pageMeta.totalpages || totalPages;
    totalRecords = pageMeta.totalRecords || pageMeta.totalrecords || totalRecords;

    page++;
  } while (page <= totalPages && page <= 5); // Cap at 5 pages for MVP (avoid ~40k records)

  if (totalPages > 5) {
    console.warn(`  WARNING: ${totalPages} total pages; MVP capped at 5 pages. Use full fetch for production.`);
  }

  return {
    observations: allObservations,
    indicators: Array.from(allIndicators.values()),
    totalPages,
    totalRecords,
    rawPaths,
  };
}

async function main() {
  console.log(`[${DATASET_ID}] Fetching from ${API_BASE}`);
  ensureDir(RAW_DIR);

  const { observations, indicators, totalPages, totalRecords, rawPaths } = await fetchAllPages();
  console.log(`  Total: ${observations.length} observations, ${indicators.length} indicators (${totalPages} pages, ${totalRecords} records)`);

  const sourceRun = {
    run_id: SOURCE_RUN_ID,
    fetched_at: new Date().toISOString(),
    source_url: API_BASE,
    content_hash: crypto.createHash("sha256").update(rawPaths.join(""), "utf-8").digest("hex"),
    parser_version: "mnre-api-v1",
    row_count: observations.length,
    warnings: totalPages > 5 ? [`Capped at 5 pages of ${totalPages}; ${totalRecords} total records`] : [],
    errors: [],
  };

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
    title: "Ministry of New and Renewable Energy Statistics",
    source_status: observations.length > 0 ? "ready" : "source_unavailable",
    source_run: sourceRun,
    geographies,
    indicators,
    observations,
  });

  const artifactPath = saveArtifact(DATASET_ID, artifact);
  console.log(`  Artifact saved: ${artifactPath}`);

  updateCatalog(DATASET_ID, "Ministry of New and Renewable Energy Statistics", artifactPath, artifact.source_status, observations.length);
  console.log(`  Catalog updated`);

  return artifact;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[${DATASET_ID}] FAILED: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { main, parseMnrePage };
