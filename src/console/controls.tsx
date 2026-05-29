// Shared console controls. Flat, ruled, monospace — the instrument panel of the
// research console. No pills, no gradients, no motion.

import { useRef } from "react";
import { formatNumber } from "@/lib/format";

export interface Option<T extends string> {
  id: T;
  label: string;
  title?: string;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: ReadonlyArray<Option<T>>;
  onChange: (id: T) => void;
  ariaLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIdx = Math.max(0, options.findIndex((o) => o.id === value));

  // Roving tabindex + arrow-key navigation (WAI-ARIA toolbar pattern). Only
  // the active option is in the tab order; arrows move focus AND select.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") {
      return;
    }
    e.preventDefault();
    const last = options.length - 1;
    let next = activeIdx;
    if (e.key === "ArrowLeft") next = activeIdx === 0 ? last : activeIdx - 1;
    else if (e.key === "ArrowRight") next = activeIdx === last ? 0 : activeIdx + 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    const nextOption = options[next];
    if (!nextOption) return;
    onChange(nextOption.id);
    // Focus the newly active button so screen readers announce it
    requestAnimationFrame(() => {
      const btn = containerRef.current?.querySelectorAll("button")[next] as
        | HTMLButtonElement
        | undefined;
      btn?.focus();
    });
  }

  return (
    <div
      ref={containerRef}
      className="segmented"
      role="group"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      {options.map((o, i) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            title={o.title}
            aria-pressed={selected}
            tabIndex={i === activeIdx ? 0 : -1}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Dual-handle year window expressed as two range inputs over a shared domain. */
export function YearWindow({
  min,
  max,
  from,
  to,
  onChange,
}: {
  min: number;
  max: number;
  from: number;
  to: number;
  onChange: (from: number, to: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">Window</span>
        <span className="num text-[13px]" style={{ color: "var(--ink)" }}>
          {from}–{to}
        </span>
      </div>
      <div className="mt-2 space-y-1.5">
        <input
          type="range"
          aria-label="Start year"
          className="w-full"
          min={min}
          max={max}
          value={from}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), to - 1);
            onChange(v, to);
          }}
        />
        <input
          type="range"
          aria-label="End year"
          className="w-full"
          min={min}
          max={max}
          value={to}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), from + 1);
            onChange(from, v);
          }}
        />
      </div>
    </div>
  );
}

/** A single large readout: a derived headline number with caption. */
export function Readout({
  label,
  value,
  unit,
  prefix,
  decimals = 0,
  tone = "ink",
  caption,
}: {
  label: string;
  value: number | null;
  unit?: string;
  prefix?: string;
  decimals?: number;
  tone?: "ink" | "pos" | "neg" | "signal";
  caption?: string;
}) {
  const color =
    tone === "pos"
      ? "var(--pos)"
      : tone === "neg"
        ? "var(--neg)"
        : tone === "signal"
          ? "var(--signal)"
          : "var(--ink)";
  return (
    <div role="status" aria-live="polite">
      <div className="eyebrow">{label}</div>
      <div className="num mt-1.5" style={{ fontSize: "1.7rem", lineHeight: 1.05, color }}>
        {value == null ? "—" : `${prefix ?? ""}${formatNumber(value, decimals)}`}
        {unit ? <span className="ml-1 text-[0.5em]" style={{ color: "var(--ink-faint)" }}>{unit}</span> : null}
      </div>
      {caption ? (
        <div className="mt-1 text-[12px]" style={{ color: "var(--ink-faint)" }}>
          {caption}
        </div>
      ) : null}
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow mb-1.5">{children}</div>;
}
