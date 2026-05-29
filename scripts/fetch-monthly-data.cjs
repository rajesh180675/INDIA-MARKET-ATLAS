// Fetch monthly Sensex close from Yahoo Finance and regenerate
// src/data/sensexMonthly.ts.
//
// Why a script: data refreshes shouldn't be one-off ad-hoc commands. Running
// `node scripts/fetch-monthly-data.cjs` is the documented refresh procedure
// referenced in the data file itself.
//
// Yahoo's v8 chart endpoint returns JSON with timestamps + OHLCV arrays.
// No auth required, no API key. Rate-limit is loose for occasional pulls.

const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");

const URL =
  "https://query1.finance.yahoo.com/v8/finance/chart/%5EBSESN" +
  "?period1=315532800" + // 1980-01-01 (Yahoo will start from earliest available)
  "&period2=2000000000" + // far future, will clip at "now"
  "&interval=1mo";

const OUTPUT_PATH = path.join(__dirname, "..", "src", "data", "sensexMonthly.ts");

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": "Mozilla/5.0" } },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("timeout")));
  });
}

async function main() {
  console.log("Fetching Sensex monthly data from Yahoo Finance...");
  const data = await fetchJson(URL);
  const result = data.chart && data.chart.result && data.chart.result[0];
  if (!result) {
    throw new Error(
      "Unexpected response shape: " + JSON.stringify(data).slice(0, 200),
    );
  }

  const timestamps = result.timestamp;
  const closes = result.indicators.quote[0].close;
  if (!Array.isArray(timestamps) || !Array.isArray(closes)) {
    throw new Error("Missing timestamp or close arrays in response");
  }

  const points = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (c == null) continue;
    const dt = new Date(timestamps[i] * 1000);
    points.push([dt.getUTCFullYear(), dt.getUTCMonth() + 1, Math.round(c * 100) / 100]);
  }

  if (points.length < 100) {
    throw new Error(
      `Suspiciously few points returned: ${points.length}. Refusing to overwrite source.`,
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  console.log(
    `Got ${points.length} monthly points: ${first[0]}-${String(first[1]).padStart(2, "0")} to ${last[0]}-${String(last[1]).padStart(2, "0")}`,
  );

  const lines = [
    "// Sensex monthly close (BSE SENSEX index) sourced from Yahoo Finance.",
    "// Endpoint: query1.finance.yahoo.com/v8/finance/chart/%5EBSESN (interval=1mo)",
    `// Coverage: ${first[0]}-${String(first[1]).padStart(2, "0")} onward (Yahoo's earliest available).`,
    "// For pre-1997 history, the annual continuousIndex remains canonical.",
    "//",
    "// Refresh: node scripts/fetch-monthly-data.cjs",
    "// Each row is [year, month, close]. Months are 1..12.",
    "",
    "export const sensexMonthlyPoints: ReadonlyArray<readonly [number, number, number]> = [",
    ...points.map(([y, m, c]) => `  [${y}, ${m}, ${c}],`),
    "];",
    "",
  ];

  fs.writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Fetch failed:", err.message);
  process.exit(1);
});
