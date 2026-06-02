/**
 * CPI parameter discovery
 * Systematically probe valid parameter combinations for MoSPI CPI API
 */

const { fetchWithRetry } = require("../fetch/lib/http.cjs");
const fs = require("fs");
const path = require("path");

const API_URL = "https://api.mospi.gov.in/api/cpi/getCPIData";
const DISCOVERY_DIR = path.resolve(__dirname, "../../data/raw/mospi/discovery");
const OUTPUT_FILE = path.join(DISCOVERY_DIR, "cpi-params.json");

const levelValues = [
  "All India", "All+India", "all india", "all+india",
  "State", "state",
  "Rural", "rural",
  "Urban", "urban",
  "Rural+Urban", "rural+urban",
  "Combined", "combined",
  "Sector", "sector",
];
const baseYears = ["2012", "2024"];
const sectors = ["Rural+Urban", "Rural", "Urban", "Combined", ""];
const years = ["2025", "2024", "2023"];
const months = ["January", "April", "July", "October", ""];

function makeUrl(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.append(k, v);
  }
  return `${API_URL}?${q.toString()}`;
}

async function probe(params) {
  const url = makeUrl(params);
  try {
    const res = await fetchWithRetry(url, { retries: 1 });
    const body = res.body;
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = null; }
    const hasData = parsed && Array.isArray(parsed.data) && parsed.data.length > 0;
    const status = hasData ? "SUCCESS" : (parsed?.error || parsed?.message || `HTTP ${res.statusCode}`);
    return { url, params, status, hasData, bodyPreview: body.slice(0, 200) };
  } catch (err) {
    return { url, params, status: `ERROR: ${err.message}`, hasData: false, bodyPreview: "" };
  }
}

async function main() {
  console.log("[CPI DISCOVERY] Probing parameter combinations...");
  fs.mkdirSync(DISCOVERY_DIR, { recursive: true });

  const results = [];
  let successCount = 0;

  // Probe 1: Level-only variations (most targeted from error message)
  for (const level of levelValues) {
    const r = await probe({ Level: level });
    results.push(r);
    if (r.hasData) { console.log(`  ✓ Level=${level}`); successCount++; }
  }

  // Probe 2: Level + baseYear combinations
  if (successCount === 0) {
    for (const level of ["All India", "State", "Rural", "Urban"]) {
      for (const by of baseYears) {
        const r = await probe({ Level: level, baseYear: by });
        results.push(r);
        if (r.hasData) { console.log(`  ✓ Level=${level} baseYear=${by}`); successCount++; }
      }
    }
  }

  // Probe 3: Level + sector combinations
  if (successCount === 0) {
    for (const level of ["All India", "State"]) {
      for (const sector of sectors) {
        const r = await probe({ Level: level, sector });
        results.push(r);
        if (r.hasData) { console.log(`  ✓ Level=${level} sector=${sector}`); successCount++; }
      }
    }
  }

  // Probe 4: Full combinations
  if (successCount === 0) {
    for (const level of ["All India"]) {
      for (const by of baseYears) {
        for (const sector of ["Rural+Urban"]) {
          for (const year of years) {
            for (const month of months) {
              const r = await probe({ Level: level, baseYear: by, sector, year, month });
              results.push(r);
              if (r.hasData) { console.log(`  ✓ Full combo`); successCount++; }
            }
          }
        }
      }
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ discoveredAt: new Date().toISOString(), totalProbes: results.length, successCount, results }, null, 2));
  console.log(`\n[CPI DISCOVERY] ${successCount} successful combos found out of ${results.length} probes`);
  console.log(`  Log saved: ${OUTPUT_FILE}`);
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { main };
