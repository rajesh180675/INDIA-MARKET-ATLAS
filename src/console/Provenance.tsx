// Provenance disclosure: a small "ⓘ Sources" link that expands inline to show
// where the numbers come from, how they're computed, and known caveats.
// Lives next to figcaptions so every figure can be audited without leaving
// the page.

import { useState } from "react";
import { getProvenance } from "@/domain/provenance";

export interface ProvenanceProps {
  /** Series/surface id to look up. Falls back gracefully if unknown. */
  id: string;
  /** Optional: override label shown in the disclosure summary. */
  label?: string;
}

export default function Provenance({ id, label }: ProvenanceProps) {
  const [open, setOpen] = useState(false);
  const entry = getProvenance(id);

  if (!entry) {
    // No-op for unregistered ids — keeps the call site safe to add even when
    // the provenance registry hasn't caught up yet.
    return null;
  }

  return (
    <details
      className="num"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      style={{ fontSize: 11, color: "var(--ink-faint)" }}
    >
      <summary
        style={{
          cursor: "pointer",
          listStyle: "none",
          color: "var(--ink-soft)",
          padding: "2px 0",
          userSelect: "none",
        }}
      >
        {open ? "▾" : "▸"} {label ?? "Sources & methodology"}
      </summary>
      <div
        className="rule-t mt-2 pt-2 num"
        style={{
          color: "var(--ink-soft)",
          fontSize: 11.5,
          lineHeight: 1.55,
          maxWidth: 720,
        }}
      >
        <p style={{ marginBottom: 8 }}>
          <span style={{ color: "var(--ink)", fontWeight: 600 }}>{entry.label}.</span>{" "}
          {entry.description}
        </p>

        <div style={{ display: "grid", gap: 6, gridTemplateColumns: "120px 1fr" }}>
          <div className="eyebrow">Sources</div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {entry.sources.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>

          {entry.methodology ? (
            <>
              <div className="eyebrow">Methodology</div>
              <div>{entry.methodology}</div>
            </>
          ) : null}

          {entry.convention ? (
            <>
              <div className="eyebrow">Convention</div>
              <div>{entry.convention}</div>
            </>
          ) : null}

          <div className="eyebrow">Coverage</div>
          <div>{entry.coverage}</div>

          {entry.caveats && entry.caveats.length > 0 ? (
            <>
              <div className="eyebrow">Caveats</div>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {entry.caveats.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </details>
  );
}
