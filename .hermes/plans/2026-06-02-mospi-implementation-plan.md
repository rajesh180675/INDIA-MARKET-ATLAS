# MoSPI Data Pipeline -- Implementation Plan (Evidence-Based)

**Date:** 2026-06-02
**Basis:** `2026-06-02-mospi-verification-report.md` -- every claim below traces to a
live HTTP probe or existing project artifact. No assumptions.

---

## 1. Current State

The project already has:
- `scripts/extract_nas_pdf.py` -- parses MoSPI NAS PDF via pdfplumber
- `scripts/build-nas-gdp-artifact.cjs` -- wraps PDF output into Atlas
  `nas-gdp-mvp.json` (48 observations, `source_status: "ready"`)
- `scripts/parse-mospi-state-sdp.cjs` -- dead-source handler for State SDP
- `public/data/mospi/catalog.json` -- catalog with NAS_GDP (ready) and
  STATE_SDP (unavailable)
- Existing artifact schema: `observations`, `indicators`, `geographies`,
  `source_runs`, `quality_report`
- Package dependency: `xlsx` (0.18.5) for XLS parsing

Missing:
- No API-based fetch scripts
- No parameter discovery tooling
- No automated pipeline (manual `node scripts/build-nas-gdp-artifact.cjs`)
- No CI integration for data freshness

---

## 2. Verified Data Sources (The Only Ones We Build For)

### Tier A -- Production-Ready (proven live, start here)

| # | Dataset | Source | Method | Observations |
|---|---|---|---|---|
| A1 | WPI | `api.mospi.gov.in/api/wpi/getWpiRecords` | GET, no auth | ~3,875 bytes/month |
| A2 | ASUSE | `api.mospi.gov.in/api/asuse/getAsuseRecords` | GET, no auth | ~3,201 bytes/round |
| A3 | MNRE | `api.mospi.gov.in/api/mnre/getDataByEnergy` | GET, paginated | ~40,586 records total |
| A4 | NAS | `data/raw/mospi/STATE_SDP/nsdp_2025_09_01.pdf` | PDF (pdfplumber) | 48 obs/quarter |

### Tier B -- Parameter Discovery Needed (API alive, schema unknown)

| # | Dataset | Endpoint | Missing Param |
|---|---|---|---|
| B1 | CPI | `/api/cpi/getCPIData` | `Level` (case? values?) |
| B2 | IIP | `/api/iip/getIipData` | Valid param combination |
| B3 | ASI | `/api/asi/getASIData` | `classification_year` + `year` combo |
| B4 | AISHE | `/api/aishe/getAisheRecords` | `indicator_code` (int) |
| B5 | UDISE | `/api/udise/getUdiseRecords` | `indicator_code` (int) |
| B6 | ENVSTATS | `/api/env/getEnvStatsRecords` | `indicator_code` (int) |
| B7 | RBI | `/api/rbi/getRbiRecords` | `sub_indicator_code` |

### Tier C -- Explicitly Deferred (broken or dead)

| # | Dataset | Why Deferred |
|---|---|---|
| C1 | PLFS | API returns 500 even with params |
| C2 | ENERGY | API SQL error in backend (`scanner_yyerror`) |
| C3 | State SDP | Workbook 404, Wayback empty, no API endpoint found |
| C4 | HCES/NSS/NFHS/TUS/GENDER/CPIALRL/EC/microdata/SDG | Unconfirmed, not on verified endpoint list |

---

## 3. Architecture (Minimal, Proven)

No new infrastructure. Reuse existing project structure:

```
scripts/
  fetch/
    wpi.js          -- GET api.mospi.gov.in/api/wpi/getWpiRecords
    asuse.js        -- GET api.mospi.gov.in/api/asuse/getAsuseRecords
    mnre.js         -- GET api.mospi.gov.in/api/mnre/getDataByEnergy (paginated)
    nas-pdf.js      -- wrapper around existing extract_nas_pdf.py
    lib/
      http.js       -- fetch with retry, timeout, rate-limit
      artifact.js   -- build artifact JSON from observations
      catalog.js    -- update catalog.json
      validate.js   -- run against Atlas observation schema
  discover/
    cpi-params.js   -- brute-force/guess CPI parameter combinations
    iip-params.js   -- brute-force/guess IIP parameter combinations
    ...             -- one per Tier B endpoint
  build/
    all.js          -- run fetch scripts + build all artifacts

data/
  raw/
    mospi/
      wpi/          -- raw JSON responses
      asuse/        -- raw JSON responses
      mnre/         -- raw paginated JSON responses
      nas/          -- PDF files
      manual/       -- hand-placed fallback files (project convention)

public/data/mospi/
  catalog.json            -- updated by build scripts
  wpi-mvp.json            -- generated
  asuse-mvp.json          -- generated
  mnre-mvp.json           -- generated
  nas-gdp-mvp.json        -- already exists (PDF-based)
  state-sdp-mvp.json      -- already exists (source_unavailable)
```

**No database.** The existing project serves static JSON from
`public/data/mospi/`. We follow this pattern. Each fetch script writes:
1. Raw response to `data/raw/mospi/<dataset>/<timestamp>.json`
2. Parsed observations to `public/data/mospi/<dataset>-mvp.json`
3. Updated `catalog.json`

**No bitemporal complexity for v1.** The existing artifact schema carries
`source_run_id`, `generated_at`, and `source_runs[]`. We extend it with a
`fetched_at` per run. If MoSPI releases revised data, we append a new
`source_run` -- the Atlas consumer can diff them. True bitemporal (valid
vs transaction time) is deferred until a revision-conflict actually occurs.

---

## 4. Implementation Phases

### Phase 0 -- Foundation (1 week)

**Goal:** Prove the pipeline works end-to-end with Tier A data.

Tasks:
1. **Create `scripts/fetch/lib/http.js`**
   - `fetchWithRetry(url, options)` -- 3 retries, exponential backoff
   - `rateLimit(ms)` -- default 1s between MoSPI API calls
   - `timeout` default 15s
   - Save raw response + HTTP status + timestamp

2. **Create `scripts/fetch/lib/artifact.js`**
   - Read existing `public/data/mospi/<dataset>-mvp.json` if present
   - Merge new observations, dedup on `indicator_id|geography_id|period_id`
   - Write updated artifact
   - Update `catalog.json` observation_count and source_status

3. **Create `scripts/fetch/wpi.js`**
   - GET `api.mospi.gov.in/api/wpi/getWpiRecords`
   - Parse response into observation schema
   - Write artifact
   - Run `npm run parse:mospi` equivalent validation

4. **Create `scripts/fetch/asuse.js`**
   - Same pattern as WPI

5. **Create `scripts/fetch/mnre.js`**
   - Handle pagination (`meta_data.page`, `meta_data.totalPages`)
   - Fetch all pages, merge into single observation array

6. **Refactor `scripts/build-nas-gdp-artifact.cjs`**
   - Extract reusable `artifact.js` functions
   - Make it callable from `scripts/build/all.js`

7. **Create `scripts/build/all.js`**
   - Run all fetch scripts in sequence (respect rate limits)
   - Validate each artifact against schema
   - Update catalog.json

8. **Atlas validation gate (M0.5)**
   - Import `validateMospiObservations` from Atlas codebase
   - Run it against each generated artifact in CI
   - Fail build if validation fails

**Deliverables:**
- 4 working artifacts: WPI, ASUSE, MNRE, NAS-GDP
- `catalog.json` updated
- CI passes (`npm run typecheck` + artifact validation)

**No synthetic data.** If any fetch fails, artifact stays at previous
version or `source_status: "source_unavailable"`.

---

### Phase 1 -- Parameter Discovery (1-2 weeks)

**Goal:** Discover valid parameter combinations for Tier B endpoints.

**Method:** For each endpoint, run a systematic parameter probe:

```
scripts/discover/<dataset>-params.js
```

Each script:
1. Reads the error message from blank GET (tells us what's missing)
2. If error says "parameter X is required," tries common values
3. If error says "Please check input parameters," tries combinations
   from the open-source client.py or MoSPI documentation
4. Logs every attempt (params -> response code -> body preview)
5. Stops when `{"data":[...]}` is returned

**Specific targets:**

- **CPI (B1):** The error says "Missing required parameters: Level".
  Try: `level=All+India`, `level=State`, `level=Rural`, `level=Urban`.
  Try with and without `baseYear`, `sector`, `year`, `month`.
  The API seems case-sensitive (``Level`` vs ``level`` had different
  effects in probing).

- **IIP (B2):** Error says "Missing required parameters: frequency".
  Try: `frequency=monthly`, `frequency=quarterly`, `frequency=annual`.
  Combine with `baseYear=2011-12`, `year=2025`, `month=January`.

- **ASI (B3):** Already returns valid empty response. Try different
  `classification_year` values (2004, 2008, 2017) x `year` values
  (2020-2023). If all empty, document as "API returns no data for
  queried years" and flag for manual fallbacks.

- **AISHE/UDISE/ENVSTATS (B4-B6):** Need `indicator_code` integer.
  Try sequential values 1-100. Log which ones return data.
  Document valid codes.

- **RBI (B7):** Need `sub_indicator_code`. Try common RBI indicators
  (GDP, inflation, repo rate). Document valid codes.

**Output:**
- `data/raw/mospi/discovery/<dataset>-params.json` -- log of all attempts
- `scripts/fetch/<dataset>.js` -- working fetch script (if discovered)
- If no valid params found after 2 days: mark as **DEFERRED** and move on.

**No synthetic data.** If parameter discovery fails, dataset stays in
Tier C. Do not fabricate observations to "make the pipeline work."

---

### Phase 2 -- Tier B Ingest (1-2 weeks)

For each Tier B endpoint where parameters were discovered:

1. Build fetch script using discovered params
2. Parse into observation schema
3. Generate artifact
4. Run Atlas validation
5. Update catalog

Expected yield: 0-7 new datasets depending on parameter discovery success.
Honest expectation: 3-4 (CPI, IIP, ASI, and one of AISHE/UDISE/ENVSTATS).

---

### Phase 3 -- Atlas Integration & Polish (1 week)

1. **Unified build command:** `npm run build:mospi` runs all fetch + build
2. **Scheduled runs:** GitHub Actions cron (weekly) to re-fetch live data
3. **Stale data detection:** If `fetched_at` > 30 days, warning in catalog
4. **Diff reporting:** Between runs, report new/modified observations
5. **Documentation:** `docs/MOSPI_SOURCES.md` -- what works, what doesn't,
   how to add a new source, parameter discovery methodology

---

### Phase 4 -- Deferred Sources (monitor only, no implementation)

| Dataset | Action | Trigger to resume |
|---|---|---|
| PLFS | Monitor `api.mospi.gov.in/api/plfs/getData` weekly | API returns 200 with data |
| ENERGY | Monitor `api.mospi.gov.in/api/energy/getEnergyRecords` weekly | API stops returning SQL error |
| State SDP | Monitor MoSPI press releases for new workbook URL | New .xls/.xlsx URL published |
| data.gov.in | Monitor CKAN API for MoSPI datasets | Stable API found |

No code written. No synthetic data. Just a cron that probes and reports.

---

## 5. Observation Schema (Reuse Existing)

The existing `nas-gdp-mvp.json` already uses this schema. Reuse it
unchanged:

```ts
{
  indicator_id:   string;   // e.g. "WPI.food_grains.current.2011-12"
  geography_id:   string;   // "IN" or ISO-3166-2 state code
  period_id:      string;   // "2026-04" or "FY2025-26" or "Q1-FY2025-26"
  value:          number;
  unit:           string;   // "index" or "MW" or "Rs. crore"
  dimensions: {
    price_basis?: "current" | "constant" | "index";
    base_year?:   string;   // "2011-12"
    sector?:      string;
    // ...dataset-specific
  };
  source_run_id:  string;   // e.g. "mospi-wpi-2026-06-02"
  quality_flags:  string[]; // e.g. ["PAGINATED_SOURCE"]
}
```

For API sources, add:
- `source_url`: the exact API URL used
- `fetched_at`: ISO timestamp
- `content_hash`: SHA-256 of raw response
- `next_fetch_after`: for pagination (MNRE)

For PDF sources, keep existing:
- `source_file`: path to PDF
- `parser_version`: version of pdfplumber script

---

## 6. Quality Checks

1. **Schema validation:** Every artifact must pass `validateMospiObservations()`
2. **No null timestamps:** Every observation has a non-null `period_id`
3. **No infinite values:** Reject `NaN`, `Infinity`, `-Infinity`
4. **Geography check:** Every `geography_id` exists in `geography_registry.json`
5. **Period validity:** `period_id` matches expected pattern for dataset
6. **Value range:** Eyeball outlier detection (e.g. WPI index > 1000)
7. **Staleness:** Warning if `fetched_at` > 30 days for monthly datasets

Run in CI on every PR that touches `scripts/fetch/` or `public/data/mospi/`.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| MoSPI API changes URL or response format | Version raw responses in `data/raw/mospi/<dataset>/YYYY-MM-DD.json`. If format changes, diff against previous and alert. |
| Rate limiting (429) | 1s delay between calls. Exponential backoff on 429. |
| API endpoint goes down | Retry 3x, then mark `source_status: "source_unavailable"` and alert. Do not fabricate data. |
| Parameter discovery fails for CPI/IIP | Mark as deferred. Use PDF press notes as fallback (MoSPI publishes monthly press releases with CPI/IIP tables). |
| WPI custodian (DPIIT) changes source | Maintain fallback to `eaindustry.nic.in` in `source_fallback_matrix.yaml`. |
| NAS PDF format changes | pdfplumber is robust to minor layout changes. If major format change, parser fails loudly (exit code != 0). |
| MNRE pagination changes | Read `meta_data.totalPages` dynamically. If field missing, fail loudly. |

---

## 8. Cost Estimate

| Phase | Calendar | Deliverable |
|---|---|---|
Phase 0: Foundation | 1 week | 4 datasets (WPI, ASUSE, MNRE, NAS-PDF) |
Phase 1: Parameter discovery | 1-2 weeks | Valid params for 3-7 Tier B endpoints |
Phase 2: Tier B ingest | 1-2 weeks | 0-7 new artifacts |
Phase 3: Atlas integration | 1 week | CI, cron, docs |
**Total** | **4-6 weeks** | **4-11 datasets, all real, no synthetic** |

Defer Phase 4 indefinitely (monitor only).

This is shorter than the original 10-17 week plan because we are **not**
building for datasets that do not work.

---

## 9. Next Action

Run `npm run typecheck` to confirm the existing codebase is clean, then
write `scripts/fetch/lib/http.js` and `scripts/fetch/wpi.js`. Fetch live
WPI data, generate the artifact, and run Atlas validation against it.

This is the smallest shippable increment that proves the pipeline works.

---

*End of evidence-based implementation plan.*
