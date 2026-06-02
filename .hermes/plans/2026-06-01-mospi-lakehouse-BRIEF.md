# MoSPI Lakehouse — Headline Brief

**One sentence.** Build a **standalone, append-only, bitemporal MoSPI data
lakehouse** (dlt → DuckDB + Parquet, **"LakeHut"** — judge score 8.3/10) for
one developer that feeds **India Market Atlas with zero transform**, in five
phases over ~10–14 weeks of focused solo work, with the highest-risk ingest
(base-year-flip CPI) shipped first.

**Winner.** **MoSPI LakeHut — A Lean DuckDB-Centric Bitemporal Lakehouse.**
dlt → DuckDB + Parquet; append-only bitemporal store with
`transaction_time` + `valid_time`; as-of queries via a single `QUALIFY`
window function. No server, no Delta, no Dagster. The 3 designs scored:

| Design | Score | Why |
|---|---|---|
| **A. LakeHut (DuckDB-centric)** | **8.30** | Operational surface fits one head; time-travel is a `WHERE` clause |
| C. VINTAGE LAKE (delta-rs + Dagster + DuckDB) | 6.70 | Right-sized "below threshold" — its own verdict says so |
| B. VINTAGE (Postgres + GiST + PL/pgSQL + FastAPI) | 6.55 | Strongest correctness, self-admitted simplicity violation |

**Why A wins.** All three are append-only + bitemporal from row one — the
non-negotiable rigor investment. A pays it just as fully as B and C. The
contest reduces to "what infrastructure do you bolt around an append-only
vintaged store?" A answers "nothing — it's a `WHERE` clause." B and C are
anticipatory.

**The 5 grafts from B and C** (judge's recommendation, scored on A's
terms):

1. **dbt singular test** for non-overlapping knowledge ranges (recovers
   B's GiST correctness as a CI test).
2. **`base_year_link` factor table** (B's only sanctioned splice).
3. **Schema-validated publish contract in CI** (B).
4. **Pandera shape guards + domain-trap test checklist** (C).
5. **`s3://` URI-swap portability + dated Dagster upgrade trigger** (C).

**The non-negotiable.** Append-only, bitemporal, version-aware — never
UPDATE in place. The same `indicator+period` is published with different
values across releases (NAS up to **6×**). 2026 is a **triple base-year-
break year** (CPI 12 Feb 2026, NAS 27 Feb 2026, IIP effective **today,
1 Jun 2026**). Every row carries `transaction_time` (observed release
date, never predicted), `estimate_stage` (first-class enum, never omitted),
`price_basis`, `base_year`, and full provenance.

**The Atlas contract (the lakehouse is a clean upstream source).**

- **Observation shape:** `{ indicator_id, geography_id, period_id, value,
  unit, dimensions{price_basis, base_year, revision}, source_run_id,
  quality_flags }` — verified against `src/domain/mospi/types.ts`,
  `observation-store.ts`, `series-adapter.ts`, `period.ts` in the live Atlas
  repo.
- **Indicator id grammar:** `DATASET.CODE.price_basis.base_year`
  (e.g. `STATE_SDP.GSDP.current.2011-12`).
- **Geography:** ISO-3166-2 ids (`IN-MH`).
- **Period:** `FY2024-25` / `YYYY-MM` / `Q3-FY2025-26` carrying date bounds.
- **Dedup / identity key:** `indicator_id|geography_id|period_id|price_basis|revision`.
- **The `revision` field is the mapping point:** lakehouse-side
  `estimate_stage` is the source of truth; we surface it as
  `revision=estimate_stage`. Internally we carry `transaction_time` as a
  separate axis so genuine same-day re-releases remain distinguishable.

**Five-phase roadmap.**

| Phase | Scope | Calendar | Cumulative |
|---|---|---|---|
| **M0** | Skeleton + CPI (base-year-aware, 2012 vs 2024 endpoints) | 1–2 wk | ~2 wk |
| **M1** | WPI + IIP (IIP base flip **effective today**) | 2–3 wk | ~5 wk |
| **M2** | NAS (FAE→SAE→PE→1RE→2RE→3RE; current+constant) | 2–3 wk | ~8 wk |
| **M3** | **Atlas feed** (publish in exact contract, no transform) | 1–2 wk | ~10 wk |
| **M4** | Surveys (ASI/PLFS/ASUSE), admin, env/energy/RBI | 3–4 wk | ~14 wk |
| M5 | microdata + EC (deferred) | TBD | TBD |

**11 blockers (all routed to specific tasks).** 6 PDF/Excel extraction
(blockers B1–B6 in §5.1 of the plan); 5 Bitemporal (B7–B11 in §2).
Examples:

- B1 — positional column-index extraction grabs the wrong cell as a clean
  float (already live in shipped parser) → fix: named-header lookup +
  CI test on 5 fixture PDFs.
- B9 — base-year rebase has no supersession signal → fix: `base_year_link`
  factor table + `release_events` ledger; query layer refuses cross-base
  arithmetic.
- B11 — merge-grain ambiguity ("append at vintage grain, idempotent at
  fetch grain" was unspecified at column level) → fix: "merge idempotent
  at `(business_key, transaction_time)`; newer `transaction_time` always
  INSERTs; CI test with synthetic two-same-day-release fixture".

**Honest microdata boundary (v1).** Aggregates only. Unit records (NSS,
HCES, ASI, PLFS, ASUSE) are out of scope; downstream consumers needing
them go to `microdata.gov.in` directly. Economic Census 4/5/6 is a
brittle HTML scraper, also not v1.

**Three known open gaps** (NOT blockers; flagged for verification):

1. **6 of 8 verify lenses 402'd** in the source workflow
   (geography-drift, source-fragility, microdata-scope, atlas-coupling,
   over-engineering, incremental-value). Their findings are not on disk.
   The plan's §8.2 lists each as a "verify at implementation time" item
   with a concrete first action.
2. **3 of 10 research areas 402'd** (`parallel[3,5,9] failed` —
   unidentified tracks). The 36 catalogued datasets are the 7-successful
   subset. Run the 3 missing tracks manually before M4.
3. **402 monthly quota wall on kiro gateway / Opus 4.8** killed the
   synthesize step of the source workflow. Re-running the synthesis
   needs the quota to clear OR running the same prompt template locally.

**Files.**

- `2026-06-01-mospi-lakehouse-greenfield-plan.md` — full 9-section plan
  (48 KB). The canonical deliverable.
- `2026-06-01-mospi-lakehouse-GROUNDING-BRIEF.md` — the 19,018-char
  consolidated research brief that was used as the input to the lost
  write phase. The substance that grounds the plan.
- `workflows/wf_e4249432-f86.json` (64.9 KB) and 31 per-agent JSONLs
  under `subagents/workflows/wf_e4249432-f86/` — full workflow artifacts
  on disk (session `8126af56-c151-4e84-b966-f6e716477283`, "linked-
  inventing-kazoo", Opus 4.8, 2026-06-01).

**One-line next action.** Open the greenfield plan, read §1 + §2 + §6
(exec / data model / Atlas contract) end-to-end before starting M0.
Confirm the 11 blockers are routed to the right tasks. Then run the
single M0 first action: read `base_year` from the live CPI PDF header
and ingest the 2024-base endpoint correctly.
