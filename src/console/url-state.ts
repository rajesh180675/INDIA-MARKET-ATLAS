// URL-addressable analysis state. The entire analytical posture of the console
// (active workspace, denomination, year window, comparison set, assumptions)
// lives in the URL hash so any view is shareable and back/forward navigable.
//
// Format: #/<workspace>?denom=real&from=1979&to=2025&cmp=usd-inr,gold-price
// No routing library — the History API + a subscription is all this needs.

import { useCallback, useSyncExternalStore } from "react";

export interface AtlasState {
  workspace: string;
  params: URLSearchParams;
}

function parse(): AtlasState {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = hash.split("?");
  return {
    workspace: path || "index",
    params: new URLSearchParams(query),
  };
}

function serialize(workspace: string, params: URLSearchParams): string {
  const q = params.toString();
  return `#/${workspace}${q ? `?${q}` : ""}`;
}

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
window.addEventListener("hashchange", emit);

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Cache the snapshot so useSyncExternalStore gets a stable reference between
// hash changes (required to avoid infinite re-render loops).
let snapshot: { hash: string; state: AtlasState } = {
  hash: window.location.hash,
  state: parse(),
};
function getSnapshot(): AtlasState {
  if (window.location.hash !== snapshot.hash) {
    snapshot = { hash: window.location.hash, state: parse() };
  }
  return snapshot.state;
}

export function useAtlasState() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setWorkspace = useCallback((workspace: string) => {
    const cur = parse();
    window.location.hash = serialize(workspace, cur.params);
  }, []);

  const setParam = useCallback((key: string, value: string | null) => {
    const cur = parse();
    if (value == null || value === "") cur.params.delete(key);
    else cur.params.set(key, value);
    window.location.hash = serialize(cur.workspace, cur.params);
  }, []);

  const setParams = useCallback((entries: Record<string, string | null>) => {
    const cur = parse();
    for (const [key, value] of Object.entries(entries)) {
      if (value == null || value === "") cur.params.delete(key);
      else cur.params.set(key, value);
    }
    window.location.hash = serialize(cur.workspace, cur.params);
  }, []);

  return { state, setWorkspace, setParam, setParams };
}

// Typed readers with defaults — derived state, never duplicated in component
// state, so the URL is the single source of truth.
export function readString(p: URLSearchParams, key: string, fallback: string): string {
  return p.get(key) ?? fallback;
}
export function readInt(p: URLSearchParams, key: string, fallback: number): number {
  const v = Number(p.get(key));
  return Number.isFinite(v) && p.get(key) !== null ? v : fallback;
}
export function readList(p: URLSearchParams, key: string): string[] {
  const v = p.get(key);
  return v ? v.split(",").filter(Boolean) : [];
}
