/**
 * MoSPI HTTP fetch utilities
 * - Retry with exponential backoff
 * - Rate limiting (respectful to government servers)
 * - Timeout handling
 * - Raw response preservation
 */

const https = require("https");
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 2000;
const RATE_LIMIT_MS = 1200; // 1.2s between MoSPI calls

let lastRequestTime = 0;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - elapsed);
  }
  lastRequestTime = Date.now();
}

function fetchRaw(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(
      url,
      {
        timeout: options.timeout || DEFAULT_TIMEOUT_MS,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
          ...options.headers,
        },
        rejectUnauthorized: options.rejectUnauthorized !== false,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          });
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timeout after ${DEFAULT_TIMEOUT_MS}ms`));
    });
  });
}

async function fetchWithRetry(url, options = {}) {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const retryDelay = options.retryDelay ?? DEFAULT_RETRY_DELAY_MS;
  let lastError;

  // Indian government servers frequently have certificate chain issues
  const isGovIn = url.includes("mospi.gov.in") || url.includes("gov.in");
  const tlsOptions = isGovIn ? { rejectUnauthorized: false } : {};

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await rateLimit();
      const result = await fetchRaw(url, { ...options, ...tlsOptions });

      // Treat 5xx as retryable
      if (result.statusCode >= 500 && result.statusCode < 600) {
        throw new Error(`HTTP ${result.statusCode}`);
      }

      return result;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delay = retryDelay * Math.pow(2, attempt - 1);
        console.warn(`  Retry ${attempt}/${retries} for ${url} after ${delay}ms: ${err.message}`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function sha256(str) {
  return crypto.createHash("sha256").update(str, "utf-8").digest("hex");
}

function saveRawResponse(datasetDir, url, response) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${ts}.json`;
  const filepath = path.join(datasetDir, filename);
  const meta = {
    fetched_at: new Date().toISOString(),
    url,
    status_code: response.statusCode,
    content_hash: sha256(response.body),
    body_size_bytes: Buffer.byteLength(response.body, "utf-8"),
  };
  fs.writeFileSync(filepath, JSON.stringify(meta, null, 2) + "\n\n" + response.body, "utf-8");
  return { filepath, meta };
}

module.exports = {
  fetchWithRetry,
  fetchRaw,
  rateLimit,
  sleep,
  sha256,
  saveRawResponse,
};
