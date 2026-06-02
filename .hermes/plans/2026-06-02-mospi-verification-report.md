# MoSPI Data Source Verification Report

**Date:** 2026-06-02
**Method:** Live HTTP probes against all declared API endpoints + PDF/XLS
  fallback checks. No assumptions. No synthetic data.
**Tester:** Kimi K2.6 via Cloudflare Workers AI

---

## Summary

Of 13 API endpoints tested on `api.mospi.gov.in`:
- **3 return real JSON data immediately** (no auth, no parameters)
- **6 return structured errors indicating the endpoint exists but
  parameters are wrong** (discoverable with more work)
- **3 return 500/SQL errors** (server-side broken)
- **1 dead workbook** (404, Wayback has nothing)
- **2 alternate sources unreachable** (data.gov.in empty, RBI DBIE down)

**Bottom line:** Start with 3 confirmed API datasets + 1 confirmed PDF
source. Defer 3 broken API datasets. Investigate 6 parameter-sensitive
endpoints as Phase 2.

---

## Tier 1 -- CONFIRMED WORKING (real data returned)

### 1. WPI (Wholesale Price Index)

| | |
|---|---|
| Endpoint | `GET https://api.mospi.gov.in/api/wpi/getWpiRecords` |
| Auth | None |
| Parameters | None required |
| Response | `{"data":[{...}]}` -- real JSON |
| Sample data | April 2026, Paddy index=202, Wheat=212.4, etc. |
| Verdict | **PRODUCTION-READY** -- can ingest immediately |
| Caveat | DPIIT/OEA is custodian; MoSPI is a mirror. If MoSPI lags,
| | fall back to `eaindustry.nic.in`. |

### 2. ASUSE (Annual Survey of Unincorporated Sector Enterprises)

| | |
|---|---|
| Endpoint | `GET https://api.mospi.gov.in/api/asuse/getAsuseRecords` |
| Auth | None |
| Parameters | None required |
| Response | `{"data":[{...}]}` -- real JSON |
| Sample data | 2021-22, All India, Rural, Cotton Ginning, HWE=774 |
| Verdict | **PRODUCTION-READY** -- can ingest immediately |
| Caveat | Aggregates only (no unit record). Irregular rounds. |

### 3. MNRE (Renewable Energy)

| | |
|---|---|
| Endpoint | `GET https://api.mospi.gov.in/api/mnre/getDataByEnergy` |
| Auth | None |
| Parameters | None required |
| Response | `{"data":[{...}],"meta_data":{"page":1,"totalRecords":40586}}` |
| Sample data | April 2026, Solar Ground Mounted=117,356.65 MW |
| Verdict | **PRODUCTION-READY** -- can ingest immediately |
| Caveat | Paginated (40,586 records). Needs pagination handling. |

---

## Tier 2 -- API EXISTS, PARAMETERS NEED DISCOVERY

These endpoints return structured JSON errors (not HTML 404s), proving
the API server is running and the route is registered. The errors tell
us what parameters are missing. With focused parameter discovery, these
should become functional.

### 4. CPI (Consumer Price Index)

| | |
|---|---|
| Endpoint | `GET https://api.mospi.gov.in/api/cpi/getCPIData` |
| Blank GET | `{"error":"Missing required parameters: Level"}` |
| Tried | `level`, `Level`, `baseYear`, `sector`, `year`, `month` |
| Result | Still "Please check the input parameters passed" |
| Verdict | **NEEDS PARAMETER DISCOVERY** -- API is alive, parameter
| | schema is non-obvious. Likely needs a specific combination.
| Action | Inspect open-source client.py or MoSPI docs for exact param
| | names. Base-year fork (2012 vs 2024) adds complexity.

### 5. IIP (Index of Industrial Production)

| | |
|---|---|
| Endpoint | `GET https://api.mospi.gov.in/api/iip/getIipData` |
| Blank GET | `{"error":"Missing required parameters: frequency"}` |
| Tried | `frequency=monthly`, `baseYear=2011-12`, `year=2025`, `month=January` |
| Result | "Please check the input parameters passed" |
| Verdict | **NEEDS PARAMETER DISCOVERY** -- API alive, valid params unknown.
| Action | Find exact parameter names/values from docs or client source.
| Caveat | Base flip effective 1 Jun 2026 (2011-12 -> 2022-23).

### 6. ASI (Annual Survey of Industries)

| | |
|---|---|
| Endpoint | `GET https://api.mospi.gov.in/api/asi/getASIData` |
| Blank GET | `{"error":"Missing required parameters: classification_year"}` |
| Tried | `classification_year=2008&year=2022` |
| Result | `{"data":[],"msg":"No Data Found","statusCode":true}` |
| Verdict | **API WORKS, DATA EMPTY FOR THIS PARAM COMBO** -- this is a
| | valid empty response, not an error. The endpoint is functional.
| Action | Try different `classification_year` + `year` combinations.
| | NIC-year lookup may be needed first.
| Caveat | ~2yr lag. Provisional -> final. NIC breaks across years.

### 7. AISHE (All India Survey on Higher Education)

| | |
|---|---|
| Endpoint | `GET https://api.mospi.gov.in/api/aishe/getAisheRecords` |
| Blank GET | `{"message":"indicator_code is required and must be an integer"}` |
| Verdict | **NEEDS PARAMETER DISCOVERY** -- needs `indicator_code` integer.
| Action | Enumerate valid indicator codes or find them in source/docs.

### 8. UDISE (Unified District Information System for Education)

| | |
|---|---|
| Endpoint | `GET https://api.mospi.gov.in/api/udise/getUdiseRecords` |
| Blank GET | `{"message":"indicator_code is required and must be an integer"}` |
| Verdict | **NEEDS PARAMETER DISCOVERY** -- same pattern as AISHE.
| Action | Enumerate valid indicator codes.

### 9. ENVSTATS (Environment Statistics)

| | |
|---|---|
| Endpoint | `GET https://api.mospi.gov.in/api/env/getEnvStatsRecords` |
| Blank GET | `{"error":"indicator_code is required (integer)"}` |
| Verdict | **NEEDS PARAMETER DISCOVERY** -- needs `indicator_code`.
| Action | Enumerate valid indicator codes.

### 10. RBI (RBI data mirror)

| | |
|---|---|
| Endpoint | `GET https://api.mospi.gov.in/api/rbi/getRbiRecords` |
| Blank GET | `{"message":"sub_indicator_code is required"}` |
| Verdict | **NEEDS PARAMETER DISCOVERY** -- needs `sub_indicator_code`.
| Action | Enumerate valid sub-indicator codes.
| Caveat | RBI source-of-truth is DBIE, not MoSPI. Use for cross-check
| | only, not primary source.

---

## Tier 3 -- BROKEN / UNREACHABLE

### 11. NAS (National Accounts Statistics) -- API BROKEN

| | |
|---|---|
| Endpoint | `GET https://api.mospi.gov.in/api/nas/getNASData` |
| Blank GET | HTTP 500 |
| With params | `"Please check the input parameters passed"` |
| Verdict | **API BROKEN** -- do not depend on API.
| Fallback | **PDF WORKS** -- existing project parses
| | `data/raw/mospi/STATE_SDP/nsdp_2025_09_01.pdf` successfully
| | (see `scripts/extract_nas_pdf.py`). Continue PDF-based ingest.

### 12. PLFS (Periodic Labour Force Survey) -- API BROKEN

| | |
|---|---|
| Endpoint | `GET https://api.mospi.gov.in/api/plfs/getData` |
| Blank GET | `"Please check the input parameters passed"` |
| Verdict | **API BROKEN** -- server returns error even with params.
| Fallback | None found. eSankhyiki has PLFS data but is a React SPA.
| | May need to scrape eSankhyiki internal API or use PDF press notes.
| Action | **DEFER** until API is fixed or alternative source found.

### 13. ENERGY -- API BROKEN

| | |
|---|---|
| Endpoint | `GET https://api.mospi.gov.in/api/energy/getEnergyRecords` |
| Blank GET | `"Please check the input parameters passed"` |
| With params | SQL error: `scanner_yyerror` in PostgreSQL backend |
| Verdict | **API BROKEN (server-side SQL bug)** -- not a parameter issue.
| Action | **DEFER** until MoSPI fixes their backend.

---

## Tier 4 -- DEAD / NO SOURCE FOUND

### 14. State SDP (State Domestic Product)

| | |
|---|---|
| MoSPI workbook | `https://www.mospi.gov.in/sites/default/files/press_releases_statements/State_wise_SDP_01082025N.xls` |
| Status | HTTP 404 |
| Wayback Machine | `[]` (no archived copies) |
| Verdict | **SOURCE DEAD** -- no confirmed download URL.
| Action | **DEFER**. Existing Atlas artifact has 0 observations and
| | `source_status: "source_unavailable"`. Keep it that way. Do not
| | fabricate. If MoSPI publishes a new workbook URL, update then.

### 15. HCES, NSS, NFHS, TUS, GENDER, CPIALRL, EC, microdata, SDG NIF

| | |
|---|---|
| Status | Not individually tested (not on `api.mospi.gov.in` or endpoint
| | unknown).
| Verdict | **UNCONFIRMED** -- test only when lower-priority tiers are
| | done. No assumption of availability.

---

## Alternate Sources Checked

| Source | URL | Result | Verdict |
|---|---|---|---|
| eSankhyiki | `esankhyiki.mospi.gov.in` | HTTP 200, React SPA | Data exists behind SPA, not direct REST. Needs SPA API reverse-engineering or puppeteer. |
| data.gov.in CKAN | `data.gov.in/backend/dms/v1/search?query=MoSPI` | Empty response | May need auth key or different endpoint. **FALLBACK UNAVAILABLE**. |
| RBI DBIE | `dbie.rbi.org.in` | HTTP 000 (unreachable) | Network unreachable from this environment. **FALLBACK UNAVAILABLE** for now. |
| Wayback (State SDP) | `web.archive.org/cdx/search/cdx` | `[]` | No archived copies. **FALLBACK UNAVAILABLE**. |

---

## Revised Scope Matrix (Reality-Based)

| Dataset | API | PDF/Other | Status | Atlas Priority |
|---|---|---|---|---|
| **WPI** | WORKS (no params) | -- | **Ready** | High (macro backbone) |
| **ASUSE** | WORKS (no params) | -- | **Ready** | Low (irregular) |
| **MNRE** | WORKS (paginated) | -- | **Ready** | Low (niche) |
| **NAS** | BROKEN (500) | **WORKS** (PDF) | **Ready via PDF** | High (macro backbone) |
| **CPI** | NEEDS PARAMS | -- | **Phase 2** | High (macro backbone) |
| **IIP** | NEEDS PARAMS | -- | **Phase 2** | High (macro backbone) |
| **ASI** | NEEDS PARAMS | -- | **Phase 2** | Medium |
| **AISHE** | NEEDS PARAMS | -- | **Phase 2** | Low |
| **UDISE** | NEEDS PARAMS | -- | **Phase 2** | Low |
| **ENVSTATS** | NEEDS PARAMS | -- | **Phase 2** | Low |
| **RBI** | NEEDS PARAMS | -- | **Phase 2** | Low (cross-check) |
| **PLFS** | BROKEN | -- | **DEFERRED** | Medium (would be high if API worked) |
| **ENERGY** | BROKEN (SQL) | -- | **DEFERRED** | Low |
| **State SDP** | -- | DEAD (404) | **UNAVAILABLE** | Medium (would be high if source existed) |

---

## Key Finding: The Macro Backbone is Different Than Assumed

The v1/v2 plans assumed CPI + WPI + IIP + NAS as the "macro backbone"
all via API. The empirical reality:

- **WPI**: API works. Good.
- **NAS**: API broken, but **PDF works** and project already parses it.
- **CPI**: API alive but parameter schema unknown.
- **IIP**: API alive but parameter schema unknown.

So the actual macro backbone we can build **today** is:
- WPI (API)
- NAS (PDF)

Then Phase 2 adds:
- CPI (after parameter discovery)
- IIP (after parameter discovery)

This is a more honest ordering than assuming all four work via API.

---

## Implications for Implementation

1. **Do not build a generic API client first.** The parameter schemas
   are different for each endpoint. Build per-endpoint parsers.

2. **Start with WPI + NAS-PDF.** These work now. Get the pipeline
   architecture proven with real data before parameter hunting.

3. **Parameter discovery is a research task, not an implementation
   task.** Budget 1-2 days per endpoint for parameter discovery.
   This involves: inspecting source code, reading docs, trial/error.

4. **PLFS and ENERGY are genuinely blocked.** Do not allocate
   implementation time until a working source is found.

5. **State SDP is dead.** Do not promise it. If MoSPI publishes a
   new URL, treat it as a new source request.

6. **No synthetic data.** As per user preference, all deferred
   datasets stay at `source_status: "source_unavailable"` with
   zero observations.

---

*End of verification report.*
