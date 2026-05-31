// Dataset version indicator + stale-pin warning banner.
//
// Renders in two parts:
// 1. A small chip in the top bar showing the current dataset version
//    (always visible — establishes that there IS a version and what it is).
// 2. A dismissible banner shown only when the URL pins to a non-current
//    version (so users with shared old links know data may have shifted).

import { useState } from "react";
import {
  DATASET_LABEL,
  DATASET_VERSION,
  isCurrentDataset,
} from "@/domain/dataset-version";
import { useAtlasState } from "./url-state";

const DISMISS_KEY = "atlas-dataset-banner-dismissed";

export function DatasetChip() {
  return (
    <span
      className="num text-[11px]"
      style={{
        color: "var(--ink-faint)",
        fontFamily: "var(--font-mono)",
        whiteSpace: "nowrap",
      }}
      title={`Dataset version: ${DATASET_LABEL}. Append ?dataset=${DATASET_VERSION} to pin a shared URL to this snapshot.`}
    >
      data · {DATASET_VERSION}
    </span>
  );
}

/**
 * Banner shown when ?dataset=<X> pins to a version that doesn't match the
 * live DATASET_VERSION. Dismissible per-tab via localStorage. The dismissal
 * is keyed by the requested+current pair so a NEW mismatch unhides itself.
 */
export function DatasetMismatchBanner() {
  const { state } = useAtlasState();
  const requested = state.params.get("dataset");
  const matches = isCurrentDataset(requested);

  // Re-derive on every render — this is read-only state from the URL.
  const dismissKey =
    requested && !matches ? `${DISMISS_KEY}:${requested}->${DATASET_VERSION}` : null;
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const dismissed = dismissKey
    ? dismissedKey === dismissKey || localStorage.getItem(dismissKey) === "1"
    : false;

  if (matches || !requested || dismissed) return null;

  const dismiss = () => {
    if (dismissKey) {
      localStorage.setItem(dismissKey, "1");
      setDismissedKey(dismissKey);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="rule-b px-4 py-3 text-[13px] sm:px-6"
      style={{
        background: "var(--neg-wash)",
        color: "var(--ink)",
        borderLeft: "3px solid var(--neg)",
      }}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <strong>Dataset version mismatch.</strong>
        <span style={{ color: "var(--ink-soft)" }}>
          This URL pinned <code className="num">{requested}</code>; the live
          dataset is <code className="num">{DATASET_VERSION}</code> ({DATASET_LABEL}).
          Numbers in figures reflect the live data — they may differ from what
          the link's author saw.
        </span>
        <button
          type="button"
          onClick={dismiss}
          className="ml-auto text-[12px]"
          style={{
            color: "var(--ink-soft)",
            textDecoration: "underline",
          }}
          aria-label="Dismiss dataset mismatch warning"
        >
          dismiss
        </button>
      </div>
    </div>
  );
}
