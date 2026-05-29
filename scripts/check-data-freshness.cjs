// Data freshness audit: walks every series in the inherited data modules,
// reports the last covered year per indicator, and exits non-zero if any
// indicator is more than STALE_THRESHOLD_YEARS behind the current calendar
// year. Used by the quarterly freshness GitHub Action to open an issue when
// the dataset needs a refresh.
//
// Honest about scope: this script does NOT auto-fetch from RBI/BSE/MOSPI.
// Those sources don't expose programmatic feeds; data refreshes are manual.
// What this gives you is an early-warning system so the dataset doesn't
// drift unnoticed.
//
// Usage:
//   node scripts/check-data-freshness.cjs           # human-readable report
//   node scripts/check-data-freshness.cjs --json    # machine-readable JSON

const fs = require("node:fs");
const path = require("node:path");

const STALE_THRESHOLD_YEARS = 2;
const REPO_ROOT = path.resolve(__dirname, "..");
const CURRENT_YEAR = new Date().getFullYear();

/** Tiny TS source scanner: finds the largest "year:" literal in a file. */
function lastYearIn(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const re = /\byear:\s*(\d{4})\b/g;
  let max = 0;
  let m;
  while ((m = re.exec(src)) !== null) {
    const y = Number(m[1]);
    if (y > max) max = y;
  }
  return max || null;
}

/** Count distinct macro indicator ids in macroIndicators.ts. */
function countMacroIndicators(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  // Match inline-object format: `{ id: "usd-inr", ...`
  const matches = src.match(/\{\s*id:\s*["'][a-z0-9-]+["']/g) ?? [];
  return matches.length;
}

const sources = [
  {
    label: "Equity index (continuousIndex)",
    file: "src/data/indiaMarketData.ts",
    minLastYear: CURRENT_YEAR - STALE_THRESHOLD_YEARS,
  },
  {
    label: "Macro indicators (16 series)",
    file: "src/data/macroIndicators.ts",
    minLastYear: CURRENT_YEAR - STALE_THRESHOLD_YEARS,
  },
  {
    label: "Sensex OHLC",
    file: "src/data/sensexOHLC.ts",
    minLastYear: CURRENT_YEAR - STALE_THRESHOLD_YEARS,
  },
];

const results = sources.map((s) => {
  const filePath = path.join(REPO_ROOT, s.file);
  if (!fs.existsSync(filePath)) {
    return {
      ...s,
      lastYear: null,
      stale: true,
      reason: "missing-file",
    };
  }
  const lastYear = lastYearIn(filePath);
  const stale = lastYear == null || lastYear < s.minLastYear;
  return {
    ...s,
    lastYear,
    stale,
    yearsBehind: lastYear != null ? CURRENT_YEAR - lastYear : null,
    extra:
      s.file === "src/data/macroIndicators.ts"
        ? { macroCount: countMacroIndicators(filePath) }
        : undefined,
  };
});

const stale = results.filter((r) => r.stale);
const json = process.argv.includes("--json");

if (json) {
  console.log(
    JSON.stringify(
      {
        currentYear: CURRENT_YEAR,
        staleThresholdYears: STALE_THRESHOLD_YEARS,
        results,
        stale: stale.length,
      },
      null,
      2,
    ),
  );
} else {
  console.log(`India Market Atlas — data freshness audit`);
  console.log(`Current year: ${CURRENT_YEAR}`);
  console.log(`Stale threshold: > ${STALE_THRESHOLD_YEARS} years behind`);
  console.log("");
  for (const r of results) {
    const tag = r.stale ? "STALE" : "FRESH";
    const yrs = r.lastYear == null ? "n/a" : `${r.lastYear} (${r.yearsBehind}y behind)`;
    const extra = r.extra ? ` · ${JSON.stringify(r.extra)}` : "";
    console.log(`  [${tag}] ${r.label.padEnd(40)} ${yrs}${extra}`);
  }
  console.log("");
  if (stale.length > 0) {
    console.log(`${stale.length} source(s) are stale. Refresh recommended.`);
  } else {
    console.log("All sources within freshness threshold.");
  }
}

process.exit(stale.length === 0 ? 0 : 1);
