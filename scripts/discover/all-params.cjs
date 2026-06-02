/**
 * Fast parameter discovery for all Tier B endpoints
 * Targets: CPI, IIP, ASI, AISHE, UDISE, ENVSTATS, RBI
 * Runs focused probes only — no exhaustive search.
 */

const { fetchWithRetry } = require("../fetch/lib/http.cjs");
const fs = require("fs");
const path = require("path");

const DISCOVERY_DIR = path.resolve(__dirname, "../../data/raw/mospi/discovery");
fs.mkdirSync(DISCOVERY_DIR, { recursive: true });

async function probe(url) {
  try {
    const res = await fetchWithRetry(url, { retries: 1 });
    const body = res.body;
    let parsed = null;
    try { parsed = JSON.parse(body); } catch {}
    const hasData = parsed && Array.isArray(parsed.data) && parsed.data.length > 0;
    const err = parsed?.error || parsed?.message || null;
    return { statusCode: res.statusCode, hasData, err, bodyPreview: body.slice(0, 150) };
  } catch (err) {
    return { statusCode: 0, hasData: false, err: err.message, bodyPreview: "" };
  }
}

async function discoverCpi() {
  console.log("\n[CPI] Probing Level parameter...");
  const levels = ["All%20India", "All+India", "State", "Rural", "Urban", "Rural+Urban", "National", "Combined"];
  const results = [];
  for (const level of levels) {
    const url = `https://api.mospi.gov.in/api/cpi/getCPIData?Level=${level}`;
    const r = await probe(url);
    results.push({ level, ...r });
    if (r.hasData) console.log(`  ✓ Level=${level} -> ${r.bodyPreview.slice(0, 80)}`);
    else if (r.err) console.log(`  ✗ Level=${level} -> ${r.err.slice(0, 60)}`);
  }
  return { endpoint: "CPI", results };
}

async function discoverIip() {
  console.log("\n[IIP] Probing frequency + baseYear...");
  const freqs = ["monthly", "quarterly", "annual"];
  const baseYears = ["2011-12", "2022-23"];
  const results = [];
  for (const freq of freqs) {
    for (const by of baseYears) {
      const url = `https://api.mospi.gov.in/api/iip/getIipData?frequency=${freq}&baseYear=${by}`;
      const r = await probe(url);
      results.push({ freq, by, ...r });
      if (r.hasData) console.log(`  ✓ freq=${freq} baseYear=${by}`);
      else if (r.err) console.log(`  ✗ freq=${freq} baseYear=${by} -> ${r.err.slice(0, 60)}`);
    }
  }
  return { endpoint: "IIP", results };
}

async function discoverAsi() {
  console.log("\n[ASI] Probing classification_year + year...");
  const classifications = ["2004", "2008", "2017", "2022"];
  const years = ["2019", "2020", "2021", "2022", "2023"];
  const results = [];
  for (const cy of classifications) {
    for (const year of years) {
      const url = `https://api.mospi.gov.in/api/asi/getASIData?classification_year=${cy}&year=${year}`;
      const r = await probe(url);
      results.push({ cy, year, ...r });
      if (r.hasData) console.log(`  ✓ classification_year=${cy} year=${year}`);
      else if (r.err) console.log(`  ✗ classification_year=${cy} year=${year} -> ${r.err.slice(0, 60)}`);
    }
  }
  return { endpoint: "ASI", results };
}

async function discoverIndicatorCode(endpoint, name) {
  console.log(`\n[${name}] Probing indicator_code 1-20...`);
  const results = [];
  for (let code = 1; code <= 20; code++) {
    const url = `https://api.mospi.gov.in${endpoint}?indicator_code=${code}`;
    const r = await probe(url);
    results.push({ code, ...r });
    if (r.hasData) console.log(`  ✓ indicator_code=${code}`);
    else if (r.err) console.log(`  ✗ indicator_code=${code} -> ${r.err.slice(0, 60)}`);
  }
  return { endpoint: name, results };
}

async function discoverRbi() {
  console.log("\n[RBI] Probing sub_indicator_code...");
  const codes = ["GDP", "INFLATION", "REPO", "CPI", "WPI", "IIP", "M3", "EXCHANGE"];
  const results = [];
  for (const code of codes) {
    const url = `https://api.mospi.gov.in/api/rbi/getRbiRecords?sub_indicator_code=${code}`;
    const r = await probe(url);
    results.push({ code, ...r });
    if (r.hasData) console.log(`  ✓ sub_indicator_code=${code}`);
    else if (r.err) console.log(`  ✗ sub_indicator_code=${code} -> ${r.err.slice(0, 60)}`);
  }
  return { endpoint: "RBI", results };
}

async function main() {
  const all = [];
  all.push(await discoverCpi());
  all.push(await discoverIip());
  all.push(await discoverAsi());
  all.push(await discoverIndicatorCode("/api/aishe/getAisheRecords", "AISHE"));
  all.push(await discoverIndicatorCode("/api/udise/getUdiseRecords", "UDISE"));
  all.push(await discoverIndicatorCode("/api/env/getEnvStatsRecords", "ENVSTATS"));
  all.push(await discoverRbi());

  const summary = all.map((a) => ({
    endpoint: a.endpoint,
    successes: a.results.filter((r) => r.hasData).length,
    total: a.results.length,
  }));

  console.log("\n" + "=".repeat(50));
  console.log("DISCOVERY SUMMARY");
  console.log("=".repeat(50));
  for (const s of summary) {
    const status = s.successes > 0 ? "WORKS" : "BLOCKED";
    console.log(`  ${status}: ${s.endpoint} (${s.successes}/${s.total} probes succeeded)`);
  }

  const output = {
    discoveredAt: new Date().toISOString(),
    summary,
    details: all,
  };

  const outfile = path.join(DISCOVERY_DIR, "all-params.json");
  fs.writeFileSync(outfile, JSON.stringify(output, null, 2));
  console.log(`\nFull log: ${outfile}`);
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { main };
