# MoSPI Data Lakehouse — Grounding Brief (recovered)

**Source:** `research-brief` agent (a07b6d2586fe94511), workflow `wf_e4249432-f86`,
session `8126af56-c151-4e84-b966-f6e716477283` (claude-kiro, Opus 4.8, 2026-06-01).

**Length:** 19,018 chars. This is the consolidated engineering brief that was used as
the input to all 8 `write:*` agents (all of which 402'd before they could output —
see greenfield plan §9 Provenance for the gap accounting).

---

# MoSPI Data Lakehouse — Consolidated Engineering Brief

Scope: sole design input. Synthesized from 7 research tracks. All figures dated as of 2026-06-01. Where sources conflict, the resolution is stated inline and flagged `[VERIFY]` if it must be confirmed against the live system before coding.

The single most important takeaway: **this is a bitemporal/vintaged problem, not a time-series problem.** The same `indicator+period` is published with *different values* across releases (NAS up to 6×), and 2026 is a triple base-year-break year (CPI, IIP, NAS all rebased within months of each other). Design the store append-only and version-aware from row one, or every historical reproduction is silently wrong.

---

## 1. Dataset Universe (grouped into families)

The authoritative machine source behind both the MCP server and the eSankhyiki portal is the REST host `https://api.mospi.gov.in` (verified live 2026-06-01: HTTP 200, nginx, Swagger UI, open CORS). The open-source client `github.com/nso-india/esankhyiki-mcp` (`mospi/client.py` + `swagger/swagger_user_*.yaml`) wires **23 dataset codes** — treat this list as the real contract; press materials' "7 products" is marketing. Always confirm the live set via `list_datasets` rather than hardcoding.

Exact GET data paths (from `client.py`), grouped by family:

### Family A — Macro price/output indices (monthly, index-typed, base-year-versioned)
| Code | Endpoint | Freq / Release | Geography | Base year | Revision |
|---|---|---|---|---|---|
| `CPI` | legacy `/api/cpi/getCPIIndex` (Group) + `/api/cpi/getItemIndex` (Item); **2024-base unified `/api/cpi/getCPIData`** | Monthly ~12th | All-India + State/UT; Rural/Urban/Combined; groups + CFPI | **2024** (HCES 2023-24 weights) from Jan-2026 print, rel. 12 Feb 2026; legacy 2012 | Provisional→final |
| `WPI` | `/api/wpi/getWpiRecords` | Monthly ~14th | All-India only | 2011-12 (2022-23 planned, **NOT live** `[VERIFY]`); custodian = **DPIIT/OEA `eaindustry.nic.in`**, not MoSPI | **P→F flip ~2 months later** (overwrite, don't append) |
| `IIP` | `/api/iip/getIipData` (routes Annual vs Monthly by filter) | Monthly QE ~12th, ~6wk lag | All-India only; sectoral (Mining/Mfg/Elec **+ new Gas/Water/Waste**) × use-based | **2022-23 effective 1 Jun 2026** (10th rev; 1,042 products/463 item groups); legacy 2011-12 | QE revised **twice** (~T+1, ~T+3) |
| `CPIALRL` | `/api/cpialrl/getCpialrlRecords` | Monthly | — | base 2019 family | — |

Note: MoSPI CPI(R/U/C) ≠ Labour Bureau CPIs (CPI-IW base 2016, CPI-AL/RL base 2019). `CPIALRL` exists in the repo but keep it in its own table; do not unify with the main CPI.

### Family B — National Accounts (annual + quarterly, heavily vintaged)
| Code | Endpoint | Coverage | Base year | Revision |
|---|---|---|---|---|
| `NAS` | `/api/nas/getNASData` | GDP, GVA (8-9 sectors), GNI/NNI, per-capita, Savings, GCF/GFCF (incl. % of GDP); current **and** constant prices; annual + quarterly | **2022-23 from 27 Feb 2026** (9th rev); legacy 2011-12; **back-series to 1950-51 due Dec 2026** | **FAE→SAE→PE→1RE→2RE→3RE**, ~3yr to final (3RE ≈ Feb of FY+3) |

State GSDP is **NOT** in NAS — separate product owned by State DESs. Quarterly ≠ annual (a discrepancy/balancing item exists; **ingest as separate products, never derive annual from quarters**). Savings/GFCF swing most across vintages — flag low-confidence until 3RE. PE+Q4 release moved to **June 7** (or prior working day); FY26 PE released **5 Jun 2026** — do not hardcode "last working day of May".

### Family C — Labour & enterprise (annual/periodic, design-break-prone)
- `PLFS` → `/api/plfs/getData` — now monthly+quarterly+annual; National+State; rural/urban.
- `ASI` → `/api/asi/getASIData` — annual, **~2yr lag** (latest year always stale); National+State/industry; **NIC classification-year breaks** (`getNicClassificationYear`); provisional→final.
- `ASUSE` → `/api/asuse/getAsuseRecords` — aggregates only; unit-level still manual.

### Family D — Consumption & social surveys (irregular rounds, microdata-first)
- `HCES` → `/api/hces/getHcesRecords` — 2022-23 & 2023-24 are an **MMRP-3-questionnaire comparable pair** (MPCE ₹4,122 rural / ₹6,996 urban 2023-24); **hard break vs 2011-12** (basket 347→~405 items, single-visit URP/MRP). Two parallel measures per round: **with / without imputation** (Sections B/A) — never mix.
- `NSS77`/`NSS78`/`NSS79`/`NSS80` → `/api/nss-77/getNss77Records`, `/api/nss-78/getNss78Records`, `/api/nss-79/getNSS79Records`, `/api/nss-80/getNSS80Records`. **`NSS78` = Multiple Indicator Survey** (fieldwork Jan 2020→15 Aug 2021, COVID-extended; label "2020-21" with caveat).
- `NFHS` → `/api/nfhs/getNfhsRecords` — health, down to district.
- `TUS` → `/api/tus/getTusRecords`; `GENDER` → `/api/gender/getGenderRecords`.

**Unresolved contradiction `[VERIFY]`:** Track-4 research asserts HCES/MIS/NSS/health/education aggregates are PDF-only and **not** exposed via the API; but `client.py` wires `getHcesRecords`, `getNss*Records`, `getNfhsRecords`. Resolution to confirm before building: an endpoint existing in the client ≠ a rich queryable series being populated. Probe each survey endpoint for actual content; assume PDF/microdata fallback until proven.

### Family E — Education / administrative
- `AISHE` → `/api/aishe/getAisheRecords` (higher ed); `UDISE` → `/api/udise/getUdiseRecords` (schools, district-level).

### Family F — Energy / environment / external
- `ENERGY` → `/api/energy/getEnergyRecords`; `ENVSTATS` → `/api/env/getEnvStatsRecords`; `MNRE` → `/api/mnre/getDataByEnergy` (renewables); `RBI` → `/api/rbi/getRbiRecords`.

### Family G — Economic Census (THE ODD ONE OUT — not clean JSON)
- `EC`: **POST** to `https://esankhyiki.mospi.gov.in` (`/EC/filterDistrict{4,5,6}` for ranking, `/dashboard/EC/submitForm{4,5,6}` for detail). Returns **HTML fragments under a `code` key**, parsed with BeautifulSoup. Column layout differs by census: **EC4/EC5/EC6 = 18/22/20 cols**; HTML pagination 20 rows/page; down to district. If you ingest EC you inherit a brittle scraper, not an API.

### Family H — Off-API / manual sources
- **Microdata** (`microdata.gov.in`, NADA 4.3/5.4): HCES/NSS/PLFS/ASI/ASUSE unit-level. Login-gated, per-dataset terms acceptance, **no API**, ZIP of headerless fixed-width `.txt` + per-round `.xlsx` byte-position layout + code dictionaries. Valid aggregates require sub-sample **weights/multipliers**. Layouts/codes change every round.
- **SDG National Indicator Framework**: not on MCP. Pull from `data.gov.in` catalog "Sustainable Development Goals National Indicator Framework" (+ `aikosh.indiaai.gov.in`, `mospi.gov.in/sdgs-dashboarddata-visualisation`). Versioned: indicators added/dropped/redefined across NIF editions — **not a continuous panel**. Distinct from NITI Aayog's SDG India Index (state composite scores) — do not merge.
- **data.gov.in CKAN**: `https://api.data.gov.in/resource/{resource_id}?api-key={key}&format=json` (free key). Stable contract but MoSPI coverage lags; resource_ids churn. NDSAP license (attribution required). Use `datagovindia` Python pkg for discovery. Hit `api.data.gov.in`, not `www.data.gov.in` (403s bots).

---

## 2. Access Surfaces — Ranked by Reliability for a Pipeline

Consensus across tracks: **for batch ingestion, prefer the REST host directly over the MCP server.** MCP is an LLM/agent convenience layer (JSON-RPC + enforced tool ordering + timeout-prone) that adds nothing to a scheduled pull.

**Tier 1 — `api.mospi.gov.in` REST (direct).** The actual data source. JSON default, `Format=CSV` optional. JSON shape typically `{data:[...], statusCode:<bool>}`. No auth observed (reference client sends only `User-Agent: Mozilla/5.0`). Verified live 2026-06-01. **Caveat:** contract is undocumented at the host (`/swagger.json` not confirmed) — pin params from the repo's `swagger/swagger_user_*.yaml`, which the tracks agree is the source of truth. **Resolve-then-fetch** per dataset: (1) base-year/indicator-list endpoint → (2) filter-by-indicator endpoint → (3) data endpoint; cache steps 1-2.

**Tier 1 (provenance/audit) — PIB press notes + XLSX statement tables.** The authoritative timestamped record of the *vintage label* (FAE/SAE/PE/RE, P/F) and *exact release date* needed to stamp `transaction_time`. But: `pib.gov.in` returns **403 to non-browser clients**, URLs are unstable ASPX `PRID/NoteId`, and MoSPI/PIB pages are **JS-rendered SPAs** (curl/WebFetch returns a ~953-byte shell). Use as cited audit anchor; key on *observed* publish date, not predicted calendar.

**Tier 2 — MoSPI MCP server (beta, launched 6 Feb 2026).** Hosted `https://mcp.mospi.gov.in/`; self-host `http://localhost:8000/mcp` (`fastmcp run mospi_server.py:mcp`, FastMCP 3.x, MIT, Python 3.11+). No auth (may be added later → would silently break unauthenticated pipelines). **Strict ordered workflow: `list_datasets → get_indicators → get_metadata → get_data`** — skipping `get_metadata` yields invalid filter codes; broad/unfiltered `get_data` **times out**. Returns structured JSON (`response.json()`), not prose. Use as exploration/discovery only. Self-host > hosted (insulates from churn, lets you read `client.py`). The circulating npx package `@modelcontextprotocol/server-mospi` is **likely nonexistent** — don't depend on it.

**Tier 3 — eSankhyiki portal + data.gov.in CKAN.** `https://esankhyiki.mospi.gov.in` (Macro Indicators + Data Catalogue; live since 29 Jun 2024) gives CSV/XLSX custom download; its own front-end API paths were **not confirmed** (`[VERIFY]` — candidate paths returned the SPA shell). `data.gov.in` is a stable-contract cross-check that lags newest series. Good for validation/fallback, not primary.

**Tier 4 — PDF scraping.** Only for the newest releases not yet in the API, or for audit. MoSPI/PIB PDFs are **digital vector text with ruled tables** (not scans) → use **Camelot lattice mode** (best on government tables), pdfplumber fallback for borderless. No OCR; reserve LLM extraction for genuinely irregular one-offs. Parse the base-year from the PDF header as a guard. Layout drifts month-to-month → assert shape (row count, headers, weights sum ≈100) before load.

**Off-band — microdata portal (manual)** and **EC scraper** as described in §1.

Catalogue size is reported inconsistently (2,291 / 3,900+ datasets; 21 products / 136M+ records). **Do not quote a fixed figure** — verify live.

---

## 3. Revision & Base-Year Mechanics the Data Model MUST Capture

**Bitemporal, append-only, version-aware key.** Never UPDATE in place; every release INSERTs a new row.

Primary key: `(dataset, indicator, geography, reference_period, base_year, price_basis, estimate_stage)` + `transaction_time` (release_date) + provenance (`source_type` ∈ {mcp|rest|esankhyiki|datagovin|pdf|ec_scrape}, `source_url`, `endpoint_path`, `retrieved_at`, raw-payload pointer). `valid_time` = reference period; `transaction_time` = knowledge date.

**`estimate_stage` is a first-class enum**, surfaced in every query result — never present a provisional value without its stage:
`FAE, SAE, PE, 1RE, 2RE, 3RE` (NAS) and `MONTHLY_PROVISIONAL, MONTHLY_REVISED, FINAL` (CPI/WPI/IIP).

Revision mechanics differ per dataset and must all be modeled:
- **NAS**: same fiscal year published 6× over ~3 years; final (3RE) ≈ Feb of FY+3. Recent years are *always* provisional — flag accordingly.
- **WPI**: provisional → **Final ~2 months later** (the 3-month release table shows e.g. `[Feb-26(F), Mar-26(P), Apr-26(P)]`). Upsert overwrites P with F.
- **IIP**: Quick Estimate revised twice (~T+1, ~T+3) — same month appears 2-3× within one base.
- **CPI**: provisional then revised.
- Surveys: no back-revision; corrections issued as new versions.

**`price_basis` dimension** (current vs constant) — two parallel NAS series for every aggregate; mixing nominal/real is a classic silent error.

**`base_year` is a hard dimension and a series-break marker.** 2026 breaks:
- CPI 2012 → **2024** (12 Feb 2026; Jan-2026 print 2.75% new vs Dec-2025 1.33% old — the jump is partly methodology). Weights from HCES 2023-24; component-level comparability also breaks.
- IIP 2011-12 → **2022-23** (effective **1 Jun 2026** = today; basket expanded → item-level not back-compatible).
- NAS 2011-12 → **2022-23** (27 Feb 2026; levels cut **2022-23 −2.9%, 2023-24/2024-25 −3.8%**; growth restated e.g. FY24 9.2%→7.2%).
- WPI **still 2011-12** as of Jun 2026 (Apr-2026 = 8.3% on old base); 2022-23 rebase planned, **not confirmed live** `[VERIFY]`.

Rules: levels are **NOT** comparable across bases (growth only roughly). **Refuse cross-base arithmetic at the query layer**; provide splicing only as an explicit flagged derived view requiring an official linking factor. **Back-series wall**: new-base NAS history to 1950-51 not out until **Dec 2026** — gate any long-history feature behind that.

Second-order / methodology revisions to track: ASI **NIC classification-year** breaks; per-capita **population denominators** revised via Census interpolation (independent of GDP revision); HCES **MMRP vs URP/MRP** design break and 347→405 item basket; HCES **with/without imputation** dual measures.

---

## 4. The Geography-Drift Reference Problem

**Granularity ceiling is non-uniform — do not design a single state-level schema expecting all datasets to populate it:**
- Only **CPI** offers sub-national in the standard release (State/UT × Rural/Urban/Combined).
- **WPI, IIP, NAS = All-India only.**
- **State GSDP is a separate product** (State DESs), absent from `/api/nas` — track `source_authority` per series (MoSPI-NAD, DPIIT-OEA for WPI, State DES for GSDP).
- District-level exists only via: microdata (HCES/NSS, disclosure-dependent), `NFHS`, `UDISE`, and the `EC` HTML scraper (down to district, layout varies EC4/EC5/EC6).

**Code/boundary drift (the actual "drift"):**
- NSS/microdata ship **per-round numeric code dictionaries** (state, district, NIC, NCO). District byte positions and codes **change between rounds** → re-map every round; stacking rounds without concordances is wrong.
- Per-capita denominators shift as population is re-interpolated against Census.

**Design implication:** maintain a **geography master with valid-time** keyed to round/vintage (code → canonical entity, effective period), so a district code means the right place for the round that emitted it. Carry `geography_level` (national/state/district) and `geography_authority` on every fact.

`[GAP — VERIFY]` The source material does **not** cover true administrative boundary reorganizations over time (e.g., state/district creation and splits). If long-history sub-national joins are in scope, a boundary-concordance table is required and must be researched separately; do not assume district codes are stable across decades.

---

## 5. Top Ingestion Gotchas

1. **Vintaging is the #1 correctness requirement.** NAS publishes one period 6×; last-write-wins silently corrupts historical reproduction. Key on vintage; never overwrite.
2. **Triple base-year break in 2026** (CPI 12 Feb, NAS 27 Feb, IIP 1 Jun) + WPI lagging on 2011-12. Store `base_year` per row; block cross-base math. IIP flip is *today* — pulls this week will mix vintages unless tagged.
3. **Per-dataset revision differs** (NAS RE chain; WPI P→F ~2mo; IIP QE×2). Upsert on a version-aware key, never append-only.
4. **CPI endpoint fork by base_year**: 2024 → `/api/cpi/getCPIData` (new shape); legacy → `getCPIIndex`+`getItemIndex`. IIP routes Annual vs Monthly. An ingester assuming one endpoint/shape breaks across the transition.
5. **MCP beta fragility**: order-dependent tools, broad queries time out, no SLA/auth (auth may appear), "7 vs 23" product mismatch, repo only days old (tool names/list are moving targets). Pin/vendor the repo at a commit; snapshot the swagger you depend on.
6. **EC is POST + HTML scrape**, not JSON — brittle, per-census column layouts.
7. **TLS `verify=False` in the reference client** (CERT_NONE + legacy renegotiation adapter). **Do NOT copy.** Re-enable cert verification (pin the cert if legacy TLS forces renegotiation) — `verify=False` is a MITM red flag.
8. **Microdata has no API**: login-gated, headerless fixed-width + per-round layout xlsx + code dicts; valid aggregates require sub-sample weights. A multi-month, per-round-bespoke effort — **out of scope for v1**; if a specific indicator is needed, scope a one-off parser for that single round.
9. **SPA/JS portals + PIB 403 anti-bot**: static curl/WebFetch yields a ~953-byte shell; PIB and `www.data.gov.in` 403 non-browser clients. Hit `api.mospi.gov.in` / `api.data.gov.in`; use headless browser only where unavoidable.
10. **HCES/NSS/NFHS endpoint contradiction** (§1 Family D) — verify these return rich series before depending on them; assume PDF/microdata fallback.
11. **WPI custodian = DPIIT/OEA (`eaindustry.nic.in`)**, not MoSPI — separate calendar, revision policy, licensing, and historically unstable URLs.
12. **Quarterly ≠ annual NAS** (discrepancy item) and **current vs constant** are parallel — never reconcile/derive across them.
13. **Release calendar drift** (May → June 7 rule changed mid-2026; source even has an internal Jun-5-vs-Jun-7 inconsistency). Don't hardcode; drive scheduling off the IMF Advance Release Calendar (India is SDDS subscriber) / live MoSPI calendar; key on observed publish date.
14. **Link rot + layout drift**: snapshot every raw payload/PDF to a `raw/` landing zone so you can re-parse without re-fetching; persist the dlt-inferred schema to git so drift is a reviewable diff.
15. **Labour Bureau CPIs** (CPI-IW 2016, CPI-AL/RL 2019) are a different agency/base — keep separate from MoSPI CPI(R/U/C); `CPIALRL` repo code notwithstanding.
16. **Licensing**: data.gov.in = NDSAP (attribution); eSankhyiki/MCP redistribution terms unpublished — confirm before bulk re-publishing microdata-derived aggregates.

---

## Recommended Stack (for the design phase)

Single-dev, simplicity-first: **dlt → DuckDB (+ Parquet landing zone)**; `write_disposition='merge'` with the version-aware PK from §3; schema contract committed to git (alert on type changes/dropped columns, don't silently accept). **cron / Windows Task Scheduler / GitHub Actions** first — add Dagster only when cross-dataset dependencies/backfills appear (Dagster's asset model fits "what's stale and why"; `dagster-dlt` exists). Build a thin REST client: re-enabled TLS, conservative throttle, retry-with-backoff (429/5xx, honor Retry-After), narrow filters always. Camelot-lattice for PDFs with shape assertions. **Ingest only the families the model consumes** (start: CPI, WPI, IIP, NAS — implement CPI base-year routing explicitly as the highest-probability breakage); do not build a generic 23-dataset or microdata framework up front. Add a monthly endpoint-health job that fails loudly on non-200/empty JSON.

Key source artifacts to vendor/pin: `github.com/nso-india/esankhyiki-mcp` → `mospi/client.py` (endpoint map, TLS, retry) + `swagger/swagger_user_*.yaml` (param contract), at a fixed commit.
