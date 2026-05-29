// Saved scenarios — let users name a current view (workspace + URL state)
// and recall it later. Persisted in localStorage; portable via JSON export.
//
// Why this matters: every workspace's full state lives in the URL hash, so
// "saving a view" is just "saving the hash with a name". This module is the
// minimal CRUD layer; the UI is a thin wrapper.

const STORAGE_KEY = "atlas-saved-scenarios";
const SCHEMA_VERSION = 1;

export interface SavedScenario {
  id: string;            // stable random id; survives renames
  name: string;          // user-chosen
  hash: string;          // full hash starting with "#/", e.g. "#/index?denom=usd&from=1991"
  note?: string;         // optional free-text annotation
  createdAt: number;     // ms epoch
}

interface StoreShape {
  schema: number;
  scenarios: SavedScenario[];
}

function readStore(): StoreShape {
  if (typeof localStorage === "undefined") {
    return { schema: SCHEMA_VERSION, scenarios: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { schema: SCHEMA_VERSION, scenarios: [] };
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray(parsed.scenarios)
    ) {
      return { schema: SCHEMA_VERSION, scenarios: [] };
    }
    // Forward-compat: if a future schema arrives, wipe to current rather than
    // try to coerce. Saved scenarios are recoverable from URLs anyway.
    if (parsed.schema !== SCHEMA_VERSION) {
      return { schema: SCHEMA_VERSION, scenarios: [] };
    }
    // Validate each entry shape; drop malformed ones
    const valid = parsed.scenarios.filter(
      (s: unknown): s is SavedScenario =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as SavedScenario).id === "string" &&
        typeof (s as SavedScenario).name === "string" &&
        typeof (s as SavedScenario).hash === "string" &&
        typeof (s as SavedScenario).createdAt === "number",
    );
    return { schema: SCHEMA_VERSION, scenarios: valid };
  } catch {
    return { schema: SCHEMA_VERSION, scenarios: [] };
  }
}

function writeStore(store: StoreShape): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage full or unavailable; silent — save just doesn't persist
  }
}

function genId(): string {
  // Sufficient for a per-user, per-machine list; not crypto
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 9)
  );
}

/** Read the full list, sorted newest-first. */
export function listScenarios(): SavedScenario[] {
  const { scenarios } = readStore();
  return [...scenarios].sort((a, b) => b.createdAt - a.createdAt);
}

/** Save a new scenario. Returns the saved entry (with assigned id). */
export function saveScenario(input: {
  name: string;
  hash: string;
  note?: string;
}): SavedScenario {
  const trimmedName = input.name.trim() || "Untitled";
  const entry: SavedScenario = {
    id: genId(),
    name: trimmedName.slice(0, 80),
    hash: input.hash,
    note: input.note?.trim().slice(0, 500),
    createdAt: Date.now(),
  };
  const store = readStore();
  store.scenarios.push(entry);
  writeStore(store);
  return entry;
}

/** Update an existing scenario by id. Returns true if found and updated. */
export function updateScenario(
  id: string,
  patch: Partial<Pick<SavedScenario, "name" | "note">>,
): boolean {
  const store = readStore();
  const idx = store.scenarios.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  const next: SavedScenario = { ...store.scenarios[idx] };
  if (patch.name !== undefined) next.name = patch.name.trim().slice(0, 80) || "Untitled";
  if (patch.note !== undefined) next.note = patch.note.trim().slice(0, 500);
  store.scenarios[idx] = next;
  writeStore(store);
  return true;
}

/** Delete a scenario. Returns true if removed. */
export function deleteScenario(id: string): boolean {
  const store = readStore();
  const before = store.scenarios.length;
  store.scenarios = store.scenarios.filter((s) => s.id !== id);
  if (store.scenarios.length === before) return false;
  writeStore(store);
  return true;
}

/**
 * Export all scenarios as a JSON string suitable for downloading.
 * The shape is stable: `{ schema: 1, scenarios: [...] }` so an import on a
 * different machine can validate before merging.
 */
export function exportJson(): string {
  const store = readStore();
  return JSON.stringify(store, null, 2);
}

export interface ImportResult {
  imported: number;   // count of scenarios added
  skipped: number;    // count rejected (malformed or duplicate id)
  error?: string;
}

/**
 * Import scenarios from a JSON string. Adds entries by id; existing ids are
 * skipped (no-op) so re-importing the same file is idempotent.
 *
 * Schema mismatch fails loudly — the user gets to decide whether to upgrade
 * a future-format file. Better than silent partial-load with weird state.
 */
export function importJson(json: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { imported: 0, skipped: 0, error: "Invalid JSON" };
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as StoreShape).scenarios)
  ) {
    return { imported: 0, skipped: 0, error: "Not a scenarios export" };
  }
  const incomingSchema = (parsed as StoreShape).schema;
  if (incomingSchema !== SCHEMA_VERSION) {
    return {
      imported: 0,
      skipped: 0,
      error: `Schema mismatch (file v${incomingSchema}, supports v${SCHEMA_VERSION})`,
    };
  }
  const store = readStore();
  const existing = new Set(store.scenarios.map((s) => s.id));
  let imported = 0;
  let skipped = 0;
  for (const candidate of (parsed as StoreShape).scenarios) {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      typeof candidate.id !== "string" ||
      typeof candidate.name !== "string" ||
      typeof candidate.hash !== "string" ||
      typeof candidate.createdAt !== "number"
    ) {
      skipped++;
      continue;
    }
    if (existing.has(candidate.id)) {
      skipped++;
      continue;
    }
    store.scenarios.push(candidate);
    existing.add(candidate.id);
    imported++;
  }
  writeStore(store);
  return { imported, skipped };
}

/** Test helper — wipe all saved scenarios. Not exposed in UI. */
export function _clearAll(): void {
  if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
}
