/**
 * Generic indicator-code-based fetch script template
 * Used for: AISHE, UDISE, ENVSTATS, RBI
 * Each endpoint needs a numeric/string code parameter.
 * This script tries a default set; if they fail, marks source_unavailable.
 */

const { fetchWithRetry, saveRawResponse } = require("./lib/http.cjs");
const { buildArtifact, saveArtifact, updateCatalog, ensureDir } = require("./lib/artifact.cjs");
const path = require("path");
const crypto = require("crypto");

function makeFetcher(config) {
  const { datasetId, title, apiBase, rawSubdir, codeParamName, defaultCodes, codeType } = config;

  return async function main() {
    const SOURCE_RUN_ID = `mospi-${datasetId.toLowerCase()}-${new Date().toISOString().slice(0, 10)}`;
    const RAW_DIR = path.resolve(__dirname, `../../data/raw/mospi/${rawSubdir}`);
    console.log(`[${datasetId}] Probing ${codeParamName} values...`);
    ensureDir(RAW_DIR);

    let bestResponse = null;
    let bestCode = null;
    let bestObsCount = 0;

    for (const code of defaultCodes) {
      const url = `${apiBase}?${codeParamName}=${encodeURIComponent(code)}`;
      console.log(`  Trying ${codeParamName}=${code}`);
      try {
        const response = await fetchWithRetry(url, { retries: 2 });
        const { filepath } = saveRawResponse(RAW_DIR, url, response);
        console.log(`    Raw saved: ${filepath}`);
        if (response.statusCode === 200) {
          let parsed;
          try { parsed = JSON.parse(response.body); } catch { parsed = null; }
          const data = parsed?.data;
          const obsCount = Array.isArray(data) ? data.length : 0;
          console.log(`    Response: ${obsCount} records`);
          if (obsCount > bestObsCount) {
            bestObsCount = obsCount;
            bestResponse = { response, data };
            bestCode = code;
          }
        }
      } catch (err) { console.warn(`    Failed: ${err.message}`); }
    }

    if (!bestResponse || bestObsCount === 0) {
      console.error(`[${datasetId}] No valid data. API may be rate-limited or codes incorrect.`);
      const artifact = buildArtifact({
        dataset: datasetId, title, source_status: "source_unavailable",
        source_run: { run_id: SOURCE_RUN_ID, fetched_at: new Date().toISOString(), source_url: apiBase,
          parser_version: `${rawSubdir}-api-v1`, row_count: 0,
          warnings: ["API returned errors for all known code values"], errors: ["Code discovery needed"] },
        geographies: [{ geography_id: "IN", name: "India", type: "india", code_system: "ISO-3166-1", aliases: ["All India"] }],
        indicators: [], observations: [],
      });
      const artifactPath = saveArtifact(datasetId, artifact);
      updateCatalog(datasetId, title, artifactPath, "source_unavailable", 0);
      return artifact;
    }

    // Parse observations from best response
    const observations = [];
    const indicatorMap = new Map();
    const data = bestResponse.data || [];

    for (const row of data) {
      const year = row.year || row.academic_year || row.fiscal_year;
      if (!year) continue;
      const periodId = String(year);

      const name = (row.indicator || row.name || row.sub_indicator || "unknown").replace(/\s+/g, "_").toLowerCase().substring(0, 40);
      const indicatorCode = `${name}.${bestCode}`;
      const indicatorId = `${datasetId}.${indicatorCode}.value.annual`;

      if (!indicatorMap.has(indicatorId)) {
        indicatorMap.set(indicatorId, {
          id: indicatorId, dataset: datasetId, source_dataset_code: apiBase,
          indicator_code: indicatorCode, name: row.indicator || row.name || `${datasetId} indicator`,
          unit: "value", frequency: "annual", geography_level: "india",
          dimensions_schema: [codeParamName], source_url: apiBase,
          release_policy: `${codeParamName}=${bestCode}`, default_transform: "level",
        });
      }

      const value = parseFloat(row.value || row.number || row.count);
      if (Number.isNaN(value)) continue;

      observations.push({
        indicator_id: indicatorId, geography_id: "IN", period_id: periodId,
        value, unit: "value", dimensions: { [codeParamName]: bestCode },
        source_run_id: SOURCE_RUN_ID, quality_flags: [],
      });
    }

    const sourceRun = {
      run_id: SOURCE_RUN_ID, fetched_at: new Date().toISOString(),
      source_url: `${apiBase}?${codeParamName}=${bestCode}`,
      content_hash: crypto.createHash("sha256").update(bestResponse.response.body, "utf-8").digest("hex"),
      parser_version: `${rawSubdir}-api-v1`, row_count: observations.length, warnings: [], errors: [],
    };
    const artifact = buildArtifact({
      dataset: datasetId, title, source_status: "ready",
      source_run: sourceRun, geographies: [{ geography_id: "IN", name: "India", type: "india", code_system: "ISO-3166-1", aliases: ["All India"] }],
      indicators: Array.from(indicatorMap.values()), observations,
    });
    const artifactPath = saveArtifact(datasetId, artifact);
    updateCatalog(datasetId, title, artifactPath, "ready", observations.length);
    console.log(`  Artifact saved: ${artifactPath}`);
    return artifact;
  };
}

module.exports = { makeFetcher };
