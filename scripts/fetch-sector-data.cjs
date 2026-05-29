// Fetch monthly Nifty composite + sector closes from Yahoo Finance and
// regenerate src/data/sectorIndices.ts.
//
// Why a script: data refreshes shouldn't be ad-hoc. Run periodically to
// keep coverage current. Yahoo's endpoint isn't a stable contract, so a
// human reviews the diff before committing.
//
// Usage:
//   node scripts/fetch-sector-data.cjs
//
// Probed but excluded (stale on Yahoo, last update 2023-04):
//   ^CNXAUTO, ^CNXFMCG, ^CNXMETAL, ^CNXENERGY, ^CNXREALTY, ^CNXMEDIA,
//   ^CNXINFRA, ^CNXPSUBANK
// Re-probe before adding — would prefer a current alternative source.

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

const SYMBOLS = [
  ["nifty",        "^NSEI",      "Nifty 50",      "Composite — 50 large-cap NSE stocks, free-float weighted"],
  ["nifty-bank",   "^NSEBANK",   "Nifty Bank",    "12 most liquid bank stocks on NSE"],
  ["nifty-it",     "^CNXIT",     "Nifty IT",      "10 IT stocks (TCS, Infosys, Wipro, HCL, etc.)"],
  ["nifty-pharma", "^CNXPHARMA", "Nifty Pharma",  "Pharmaceutical sector index"],
];

const MIN_POINTS = 100; // Refuse to overwrite if a fetch returns fewer

function fetchSymbol(symbol) {
  return new Promise((resolve, reject) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=315532800&period2=1780000000&interval=1mo`;
    https
      .get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            const result = data?.chart?.result?.[0];
            if (!result) {
              reject(new Error(`No chart result for ${symbol}`));
              return;
            }
            const ts = result.timestamp || [];
            const closes = result.indicators?.quote?.[0]?.close || [];
            const seen = new Map();
            for (let i = 0; i < ts.length; i++) {
              const c = closes[i];
              if (c == null) continue;
              const d = new Date(ts[i] * 1000);
              const key = d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1);
              seen.set(key, Math.round(c * 100) / 100);
            }
            const points = Array.from(seen.entries())
              .sort((a, b) => a[0] - b[0])
              .map(([key, value]) => ({ key, value }));
            resolve(points);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function main() {
  console.log("Fetching monthly sector indices from Yahoo Finance...\n");
  const datasets = {};
  for (const [slug, sym, label, descr] of SYMBOLS) {
    process.stdout.write(`  ${slug.padEnd(14)} (${sym}) ... `);
    try {
      const points = await fetchSymbol(sym);
      if (points.length < MIN_POINTS) {
        console.log(`REFUSED (only ${points.length} points, expected ≥${MIN_POINTS})`);
        process.exit(2);
      }
      datasets[slug] = { symbol: sym, label, description: descr, points };
      console.log(`${points.length} months (${points[0].key} → ${points[points.length - 1].key})`);
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
      process.exit(1);
    }
  }

  // Regenerate the TS file
  const header = `// Monthly Nifty composite + sectoral indices.
//
// Source: Yahoo Finance v8 chart endpoint, interval=1mo
// Refresh: \`node scripts/fetch-sector-data.cjs\` regenerates this file in place.
//
// Coverage notes:
// - Nifty 50 / Bank / IT: 2007-08 onward (current)
// - Nifty Pharma:        2010-12 onward (current)
// All four series remain currently maintained on Yahoo.
//
// Other Nifty sectoral indices (Auto, FMCG, Metal, Energy, Realty, Media,
// Infra, PSU Bank) were probed but found stale (last update April 2023).
// They are NOT included until a current data source is found — better to
// ship 3 credible sectors than 9 with stale ones.

export interface SectorPoint {
  /** YYYYMM as integer (e.g. 200708 for 2007-08). */
  key: number;
  /** Index closing value at end of month. */
  value: number;
}

export interface SectorSeriesMeta {
  id: string;
  symbol: string;
  label: string;
  description: string;
  points: SectorPoint[];
}

`;

  const bodyParts = [];
  for (const [slug, info] of Object.entries(datasets)) {
    const varName = slug.replace(/-/g, "_");
    const pointsStr = info.points
      .map((p) => `  { key: ${p.key}, value: ${p.value} }`)
      .join(",\n");
    bodyParts.push(`const ${varName}_points: SectorPoint[] = [\n${pointsStr},\n];\n`);
  }

  const registryLines = Object.entries(datasets).map(([slug, info]) => {
    const varName = slug.replace(/-/g, "_");
    return `  { id: "${slug}", symbol: ${JSON.stringify(info.symbol)}, label: ${JSON.stringify(info.label)}, description: ${JSON.stringify(info.description)}, points: ${varName}_points }`;
  });

  const registry =
    "export const SECTOR_SERIES: SectorSeriesMeta[] = [\n" +
    registryLines.join(",\n") +
    ",\n];\n";

  const content = header + bodyParts.join("\n") + "\n" + registry;
  const out = path.join(__dirname, "..", "src", "data", "sectorIndices.ts");
  fs.writeFileSync(out, content);
  console.log(`\nWrote ${content.length.toLocaleString()} bytes to ${out}`);
  console.log(`Total: ${SYMBOLS.length} series`);
}

main();
