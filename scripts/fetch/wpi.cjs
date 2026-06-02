/**
 * WPI (Wholesale Price Index) fetch script
 * Source: api.mospi.gov.in/api/wpi/getWpiRecords
 * Verified 2026-06-02: returns real JSON with no auth
 */

const { fetchWithRetry, saveRawResponse } = require("./lib/http.cjs");
const { buildArtifact, saveArtifact, updateCatalog, ensureDir } = require("./lib/artifact.cjs");
const path = require("path");
const fs = require("fs");

const DATASET_ID = "WPI";
const API_URL = "https://api.mospi.gov.in/api/wpi/getWpiRecords";
const RAW_DIR = path.resolve(__dirname, "../../data/raw/mospi/wpi");
const SOURCE_RUN_ID = `mospi-wpi-${new Date().toISOString().slice(0, 10)}`;

function parseWpiResponse(body) {
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
    const month = row.month;
    if (!year || !month) continue;

    // Build period_id: YYYY-MM
    const monthNum = new Date(`${month} 1, 2000`).getMonth() + 1;
    const monthStr = String(monthNum).padStart(2, "0");
    const periodId = `${year}-${monthStr}`;

    // Build indicator from hierarchy
    const parts = ["WPI"];
    if (row.majorgroup) parts.push(row.majorgroup.replace(/\s+/g, "_").toLowerCase());
    if (row.group) parts.push(row.group.replace(/\s+/g, "_").toLowerCase());
    if (row.subgroup) parts.push(row.subgroup.replace(/\s+/g, "_").toLowerCase());
    if (row.sub_subgroup) parts.push(row.sub_subgroup.replace(/\s+/g, "_").toLowerCase());
    if (row.item) parts.push(row.item.replace(/\s+/g, "_").toLowerCase());

    const indicatorCode = parts.slice(1).join(".") || "all";
    const indicatorId = `WPI.${indicatorCode}.index.2011-12`;

    // Track unique indicators
    if (!indicatorMap.has(indicatorId)) {
      indicatorMap.set(indicatorId, {
        id: indicatorId,
        dataset: DATASET_ID,
        source_dataset_code: API_URL,
        indicator_code: indicatorCode,
        name: row.item || row.sub_subgroup || row.subgroup || row.group || row.majorgroup || "Wholesale Price Index",
        unit: "index",
        frequency: "monthly",
        geography_level: "india",
        dimensions_schema: ["base_year"],
        base_year: "2011-12",
        source_url: API_URL,
        release_policy: "DPIIT/OEA custodian; MoSPI mirror",
        default_transform: "level",
      });
    }

    const value = parseFloat(row.index_value);
    if (Number.isNaN(value)) continue;

    observations.push({
      indicator_id: indicatorId,
      geography_id: "IN",
      period_id: periodId,
      value,
      unit: "index",
      dimensions: {
        base_year: "2011-12",
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

  const { observations, indicators } = parseWpiResponse(response.body);
  console.log(`  Parsed ${observations.length} observations, ${indicators.length} indicators`);

  const sourceRun = {
    run_id: SOURCE_RUN_ID,
    fetched_at: new Date().toISOString(),
    source_url: API_URL,
    content_hash: require("crypto").createHash("sha256").update(response.body, "utf-8").digest("hex"),
    parser_version: "wpi-api-v1",
    row_count: observations.length,
    warnings: [],
    errors: [],
  };

  const artifact = buildArtifact({
    dataset: DATASET_ID,
    title: "Wholesale Price Index",
    source_status: observations.length > 0 ? "ready" : "source_unavailable",
    source_run: sourceRun,
    geographies: [
      {
        geography_id: "IN",
        name: "India",
        type: "india",
        code_system: "ISO-3166-1",
        aliases: ["All India", "National"],
      },
    ],
    indicators,
    observations,
  });

  const artifactPath = saveArtifact(DATASET_ID, artifact);
  console.log(`  Artifact saved: ${artifactPath}`);

  updateCatalog(DATASET_ID, "Wholesale Price Index", artifactPath, artifact.source_status, observations.length);
  console.log(`  Catalog updated`);

  return artifact;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[${DATASET_ID}] FAILED: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { main, parseWpiResponse };
