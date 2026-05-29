// Command palette: Cmd/Ctrl+K keyboard launcher. Pure DOM modal, no router or
// dialog library. Commands are derived from the workspace registry, the
// denomination set, year-window presets, and the macro catalog. Selecting a
// command calls navigate() — the same primitive used by deep links.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DENOMINATIONS, macroCatalog } from "@/domain/atlas";
import { useAtlasState } from "./url-state";
import { WORKSPACES } from "./workspaces";

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  run: () => void;
}

const YEAR_PRESETS: Array<{ id: string; label: string; from: number; to: number }> = [
  { id: "full", label: "Full record (1947–2025)", from: 1947, to: 2025 },
  { id: "post-91", label: "Post-liberalization (1991–2025)", from: 1991, to: 2025 },
  { id: "post-2000", label: "21st century (2000–2025)", from: 2000, to: 2025 },
  { id: "last-25", label: "Last 25 years (2000–2025)", from: 2000, to: 2025 },
  { id: "last-10", label: "Last 10 years (2015–2025)", from: 2015, to: 2025 },
  { id: "pre-79", label: "Suppressed era (1947–1979)", from: 1947, to: 1979 },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { navigate, setParams } = useAtlasState();

  // Open with Cmd/Ctrl+K, close with Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isOpen = e.key === "k" && (e.metaKey || e.ctrlKey);
      if (isOpen) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus input on open, reset state on close
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands = useMemo<Command[]>(
    () => [
      ...WORKSPACES.map((w) => ({
        id: `ws-${w.slug}`,
        group: "Workspace",
        label: w.title,
        hint: w.scope,
        run: () => navigate(w.slug),
      })),
      ...DENOMINATIONS.map((d) => ({
        id: `denom-${d.id}`,
        group: "Index denomination",
        label: `Index in ${d.label}`,
        hint: d.blurb,
        run: () => navigate("index", { denom: d.id }),
      })),
      ...YEAR_PRESETS.map((p) => ({
        id: `year-${p.id}`,
        group: "Year window",
        label: p.label,
        hint: `${p.from} → ${p.to}`,
        run: () => setParams({ from: String(p.from), to: String(p.to) }),
      })),
      ...macroCatalog.map((m) => ({
        id: `macro-${m.id}`,
        group: "Macro indicator",
        label: m.label,
        hint: `${m.unit} · ${m.category}`,
        run: () => navigate("macro", { a: m.id }),
      })),
    ],
    [navigate, setParams],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q) ||
        (c.hint?.toLowerCase().includes(q) ?? false),
    );
  }, [commands, query]);

  // Clamp active index when filtered list shrinks
  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(Math.max(0, filtered.length - 1));
  }, [filtered.length, activeIdx]);

  const runActive = useCallback(() => {
    const cmd = filtered[activeIdx];
    if (!cmd) return;
    cmd.run();
    setOpen(false);
  }, [filtered, activeIdx]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runActive();
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    if (el && "scrollIntoView" in el) {
      (el as HTMLElement).scrollIntoView({ block: "nearest" });
    }
  }, [activeIdx]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Command palette"
      aria-modal="true"
      onClick={() => setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface"
        style={{
          width: "min(640px, 92vw)",
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ borderBottom: "1px solid var(--rule)", padding: "10px 14px" }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Jump to workspace, change denomination, search indicators…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Command palette search"
            aria-controls="atlas-cmd-list"
            aria-activedescendant={`atlas-cmd-${activeIdx}`}
            className="num"
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              color: "var(--ink)",
            }}
          />
        </div>

        <ul
          ref={listRef}
          id="atlas-cmd-list"
          role="listbox"
          aria-label="Commands"
          tabIndex={0}
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            overflowY: "auto",
            maxHeight: "60vh",
          }}
        >
          {filtered.length === 0 ? (
            <li
              role="presentation"
              className="num"
              style={{ padding: 16, color: "var(--ink-faint)", fontSize: 13 }}
            >
              No commands match “{query}”.
            </li>
          ) : (
            // Flatten: a single listbox is the only ARIA-clean structure.
            // Group separators are role="presentation" headers between options,
            // not nested lists. Keeps screen readers happy.
            (() => {
              const out: React.ReactElement[] = [];
              let lastGroup: string | null = null;
              filtered.forEach((cmd, idx) => {
                if (cmd.group !== lastGroup) {
                  out.push(
                    <li
                      key={`hdr-${cmd.group}`}
                      role="presentation"
                      className="eyebrow"
                      style={{
                        padding: "8px 14px 4px",
                        background: "var(--surface-sunken)",
                        borderTop: idx > 0 ? "1px solid var(--rule)" : undefined,
                      }}
                    >
                      {cmd.group}
                    </li>,
                  );
                  lastGroup = cmd.group;
                }
                const active = idx === activeIdx;
                out.push(
                  <li
                    key={cmd.id}
                    id={`atlas-cmd-${idx}`}
                    data-idx={idx}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => {
                      cmd.run();
                      setOpen(false);
                    }}
                    style={{
                      padding: "8px 14px",
                      cursor: "pointer",
                      background: active ? "var(--signal-wash)" : "transparent",
                      borderLeft: active
                        ? "2px solid var(--signal)"
                        : "2px solid transparent",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 12,
                    }}
                  >
                    <span
                      style={{
                        color: active ? "var(--signal)" : "var(--ink)",
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      {cmd.label}
                    </span>
                    {cmd.hint ? (
                      <span
                        className="num"
                        style={{
                          color: "var(--ink-soft)",
                          fontSize: 11,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "55%",
                        }}
                      >
                        {cmd.hint}
                      </span>
                    ) : null}
                  </li>,
                );
              });
              return out;
            })()
          )}
        </ul>

        <div
          className="num"
          style={{
            borderTop: "1px solid var(--rule)",
            padding: "6px 14px",
            color: "var(--ink-faint)",
            fontSize: 11,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>↑↓ navigate · enter select · esc close</span>
          <span>{filtered.length} / {commands.length}</span>
        </div>
      </div>
    </div>
  );
}
