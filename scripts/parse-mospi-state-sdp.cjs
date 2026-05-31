const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const XLSX = require("xlsx");

// ─── Configuration ────────────────────────────────────────────────────────────
const DECLARED_URL =
  "https://www.mospi.gov.in/sites/default/files/press_releases_statements/State_wise_SDP_01082025N.xls";
const MANUAL_SOURCE_DIR = path.join(__dirname, "../data/raw/mospi/STATE_SDP/manual");
const OUTPUT_PATH = path.join(__dirname, "../public/data/mospi/state-sdp-mvp.json");
const GEOGRAPHY_REGISTRY_PATH = path.join(__dirname, "../data/catalog/geography_registry.json");

// State/UT name → geography_id mapping from the registry
function loadGeographyRegistry() {
  const raw = fs.readFileSync(GEOGRAPHY_REGISTRY_PATH, "utf-8");
  const registry = JSON.parse(raw);
  const map = new Map();
  registry.forEach((geo) => {
    map.set(geo.name.toLowerCase(), geo.geography_id);
    geo.aliases.forEach((alias) => map.set(alias.toLowerCase(), geo.geography_id));
  });
  return map;
}

function normalizeStateName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// ─── Network helpers ──────────────────────────────────────────────────────────
function fetchBinary(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    client
      .get(url, { timeout: 30000 }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject)
      .on("timeout", () => reject(new Error("Timeout")));
  });
}

function sha256(buffer) {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

// ─── XLS parsing ──────────────────────────────────────────────────────────────
function parseXlsBuffer(buffer, geoMap) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

  // Heuristic: look for a row that contains "State" or "UT" or "All India" as a header
  // The SDP workbook typically has:
  //   Row 0-2: title/description
  //   Row 3+:  State name | FY2020-21 | FY2021-22 | FY2022-23 | ...
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i];
    if (!row) continue;
    const firstCell = String(row[0] ?? "").toLowerCase().trim();
    if (firstCell.includes("state") || firstCell.includes("all india") || firstCell.includes("ut")) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    return { observations: [], warnings: ["Could not locate header row in SDP workbook — heuristic failed."], rowCount: rows.length };
  }

  const headerRow = rows[headerRowIdx];
  const periods = [];
  for (let c = 1; c < headerRow.length; c++) {
    const val = headerRow[c];
    if (val == null) continue;
    const str = String(val).trim();
    // Match fiscal year patterns like 2020-21, FY 2020-21, etc.
    const match = /(?:FY\s*)?(\d{4})-(\d{2,4})/.exec(str);
    if (match) {
      const startYear = Number(match[1]);
      const shortEnd = match[2].length === 2 ? match[2] : String(startYear + 1).slice(-2);
      periods.push({ col: c, label: `${startYear}-${shortEnd}`, periodId: `FY${startYear}-${shortEnd}` });
    }
  }

  if (periods.length === 0) {
    return { observations: [], warnings: ["No fiscal year columns detected in header row."], rowCount: rows.length };
  }

  const observations = [];
  const warnings = [];
  const warningSet = new Set();

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row[0] == null) continue;
    const rawStateName = String(row[0]).trim();
    const normalized = normalizeStateName(rawStateName);
    const geographyId = geoMap.get(normalized);

    if (!geographyId) {
      const w = `Unmapped state name: "${rawStateName}"`;
      if (!warningSet.has(w)) {
        warningSet.add(w);
        warnings.push(w);
      }
      continue;
    }

    periods.forEach((period) => {
      const rawValue = row[period.col];
      if (rawValue == null) return;
      const value = typeof rawValue === "number" ? rawValue : Number(String(rawValue).replace(/,/g, ""));
      if (Number.isNaN(value)) return;

      observations.push({
        indicator_id: "STATE_SDP.GSDP.current.2011-12",
        geography_id: geographyId,
        period_id: period.periodId,
        value,
        unit: "₹ crore",
        dimensions: {
          price_basis: "current",
          base_year: "2011-12",
          revision: "latest",
        },
        source_run_id: "mospi-state-sdp-parse-2026-05-31",
        quality_flags: [],
      });
    });
  }

  return { observations, warnings, rowCount: rows.length };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const geoMap = loadGeographyRegistry();
  let buffer = null;
  let sourceUrl = null;
  let sourceFile = null;
  let errors = [];
  let warnings = [];

  // Try live URL first
  try {
    console.log("Fetching from declared URL...");
    buffer = await fetchBinary(DECLARED_URL);
    sourceUrl = DECLARED_URL;
    console.log(`Fetched ${buffer.length} bytes from live URL`);
  } catch (e) {
    warnings.push(`Live URL failed: ${e.message}`);
    console.log(`Live URL failed: ${e.message}`);
  }

  // Try manual source path
  if (!buffer && fs.existsSync(MANUAL_SOURCE_DIR)) {
    const files = fs.readdirSync(MANUAL_SOURCE_DIR).filter((f) => f.endsWith(".xls") || f.endsWith(".xlsx"));
    if (files.length > 0) {
      const manualPath = path.join(MANUAL_SOURCE_DIR, files[0]);
      buffer = fs.readFileSync(manualPath);
      sourceFile = manualPath;
      console.log(`Using manual source: ${manualPath} (${buffer.length} bytes)`);
    }
  }

  // Try the existing monthly upload XLSX (administrative data — not the SDP workbook, but let's note it)
  const monthlyUpload = path.join(__dirname, "../data/raw/mospi/STATE_SDP/monthly_upload_aug_2025.xlsx");
  if (fs.existsSync(monthlyUpload)) {
    warnings.push(
      "A monthly_upload_aug_2025.xlsx exists in the raw folder but it contains administrative/HR data, not State SDP."
    );
  }

  let parseResult = { observations: [], warnings: [], rowCount: 0 };
  let contentHash = "";

  if (buffer) {
    contentHash = `sha256:${sha256(buffer)}`;
    try {
      parseResult = parseXlsBuffer(buffer, geoMap);
    } catch (e) {
      errors.push(`Parse error: ${e.message}`);
    }
  } else {
    errors.push("No State SDP workbook available from live URL or manual source path.");
    errors.push("Place a valid State_wise_SDP_*.xls file in data/raw/mospi/STATE_SDP/manual/ to populate observations.");
  }

  // Merge parser warnings
  warnings.push(...parseResult.warnings);

  const output = {
    schema_version: "2026-06-mospi-state-sdp-mvp-v2",
    dataset: "STATE_SDP",
    title: "State Domestic Product and other aggregates, 2011-2012 series",
    generated_at: new Date().toISOString(),
    source_status: parseResult.observations.length > 0 ? "ready" : "source_unavailable",
    source_runs: [
      {
        run_id: `mospi-state-sdp-parse-${new Date().toISOString().slice(0, 10)}`,
        fetched_at: new Date().toISOString(),
        source_url: sourceUrl ?? DECLARED_URL,
        source_file: sourceFile ?? undefined,
        content_hash: contentHash || undefined,
        parser_version: "state-sdp-parse-v1",
        row_count: parseResult.rowCount,
        warnings,
        errors,
      },
    ],
    // Load geographies from registry to keep them in sync
    geographies: JSON.parse(fs.readFileSync(GEOGRAPHY_REGISTRY_PATH, "utf-8")),
    indicators: [
      {
        id: "STATE_SDP.GSDP.current.2011-12",
        dataset: "STATE_SDP",
        source_dataset_code: "State Domestic Product and other aggregates, 2011-2012 series",
        indicator_code: "GSDP",
        name: "Gross State Domestic Product",
        description: "Aggregate State Domestic Product at market prices.",
        unit: "₹ crore",
        frequency: "annual",
        geography_level: "state",
        dimensions_schema: ["price_basis", "base_year", "revision", "sector"],
        base_year: "2011-12",
        price_basis: "current",
        source_url: "https://www.mospi.gov.in/publications-reports/innerpage/2707",
        release_policy: "MoSPI publication/report listing; latest revision only in the MVP.",
        default_transform: "level",
      },
      {
        id: "STATE_SDP.GSDP.constant.2011-12",
        dataset: "STATE_SDP",
        source_dataset_code: "State Domestic Product and other aggregates, 2011-2012 series",
        indicator_code: "GSDP",
        name: "Gross State Domestic Product",
        description: "Aggregate State Domestic Product at market prices.",
        unit: "₹ crore",
        frequency: "annual",
        geography_level: "state",
        dimensions_schema: ["price_basis", "base_year", "revision", "sector"],
        base_year: "2011-12",
        price_basis: "constant",
        source_url: "https://www.mospi.gov.in/publications-reports/innerpage/2707",
        release_policy: "MoSPI publication/report listing; latest revision only in the MVP.",
        default_transform: "level",
      },
    ],
    observations: parseResult.observations,
    quality_report: {
      validation_status: errors.length > 0 ? "failed" : warnings.length > 0 ? "warning" : "passed",
      duplicate_count: 0,
      null_count: parseResult.observations.filter((o) => o.value === null).length,
      outlier_count: 0,
      coverage: {
        india: 1,
        states: new Set(parseResult.observations.map((o) => o.geography_id)).size,
        periods: new Set(parseResult.observations.map((o) => o.period_id)).size,
        total_observations: parseResult.observations.length,
      },
      source_hash: contentHash || undefined,
    },
    warnings,
    manual_source_path: sourceFile ?? "data/raw/mospi/STATE_SDP/manual/<file>.xls",
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${parseResult.observations.length} observations to ${OUTPUT_PATH}`);
  console.log(`Status: ${output.source_status}`);
  if (errors.length > 0) {
    console.log("Errors:");
    errors.forEach((e) => console.log(`  - ${e}`));
  }
  if (warnings.length > 0) {
    console.log("Warnings:");
    warnings.forEach((w) => console.log(`  - ${w}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
