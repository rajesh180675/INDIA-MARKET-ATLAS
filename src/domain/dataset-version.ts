// Dataset versioning.
//
// PROBLEM: When data is refreshed (Sensex monthly, sector indices, scenario
// presets, etc.) the historical numbers in shared URLs silently change. A
// link saying "Sensex 2050 projection at 12% CAGR" reproducibly returned
// X yesterday and Y today.
//
// SOLUTION: Tag the current dataset with a stable version. Shared URLs may
// pin to a version via ?dataset=<version>. When the version doesn't match,
// the UI surfaces a banner so users know they're viewing later data than
// the link's author saw.
//
// CURRENT STATE: One version live (DATASET_VERSION below). The URL param is
// honoured but inert — it equals current. When a second version ships, this
// file gains a versions registry and the runtime can refuse / warn / load
// the requested historical snapshot.
//
// REFRESH PROCESS (for future-me):
// 1. Run scripts/fetch-monthly-data.cjs and scripts/fetch-sector-data.cjs
// 2. Manually review the diff (any large jumps in the head/tail rows?)
// 3. Bump DATASET_VERSION to YYYY-MM (the month the refresh happened)
// 4. Commit data files + version bump together so the version stamp is
//    monotonic with the actual data state.

/**
 * Stable identifier for the current data snapshot. Bumped on every refresh.
 * Format: YYYY-MM (the month the data was pulled).
 *
 * This is the ONLY field that needs to change when data is refreshed.
 * The runtime reads it; provenance reports it; the UI displays it.
 */
export const DATASET_VERSION = "2026-05" as const;

/**
 * Human-readable description of what's in this snapshot. Surfaced in
 * provenance and in the UI dataset indicator.
 */
export const DATASET_LABEL = "May 2026 snapshot";

/**
 * What's covered as of this version. Update alongside DATASET_VERSION.
 */
export const DATASET_COVERAGE = {
  sensexAnnual: { firstYear: 1947, lastYear: 2025 },
  sensexMonthly: { firstKey: 199706, lastKey: 202604 },
  niftyComposite: { firstKey: 200708, lastKey: 202604 },
  niftyBank: { firstKey: 200708, lastKey: 202604 },
  niftyIT: { firstKey: 200708, lastKey: 202604 },
  niftyPharma: { firstKey: 201012, lastKey: 202604 },
  macroIndicatorsAnnual: { firstYear: 1947, lastYear: 2025, count: 16 },
} as const;

/**
 * Does the requested version match the live snapshot? When false, the UI
 * shows a banner explaining that pinning is honoured in spirit but the
 * runtime can only serve `DATASET_VERSION`.
 *
 * Useful when: a shared URL has ?dataset=2026-03 and we're now on 2026-05.
 * The numbers may have changed; the user needs to know.
 */
export function isCurrentDataset(requested: string | null | undefined): boolean {
  if (!requested) return true; // no pin = always current
  return requested === DATASET_VERSION;
}
