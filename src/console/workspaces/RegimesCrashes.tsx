import { useMemo } from "react";
import * as Plot from "@observablehq/plot";
import { crashes, nominalIndex, regimes } from "@/domain/atlas";
import { downloadCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/format";
import PlotFigure from "../PlotFigure";
import { atlasColors } from "../theme-colors";
import { useAtlasState } from "../url-state";

/** Parse a "1947–1979" / "1991–present" era string into numeric bounds. */
function parseEra(years: string): { start: number; end: number } {
  const parts = years.split(/[–-]/).map((s) => s.trim());
  const start = Number(parts[0]);
  const end = /present|now|\+/i.test(parts[1] ?? "") ? 2025 : Number(parts[1] ?? parts[0]);
  return {
    start: Number.isFinite(start) ? start : 1947,
    end: Number.isFinite(end) ? end : 2025,
  };
}

export default function RegimesCrashes({ theme }: { theme: string }) {
  const c = useMemo(() => atlasColors(), [theme]);
  const { navigate } = useAtlasState();

  const eras = useMemo(
    () => regimes.map((r, i) => ({ ...r, ...parseEra(r.years), band: c.cat[i % c.cat.length] })),
    [c],
  );

  const pathOptions = useMemo<Plot.PlotOptions>(
    () => ({
      height: 320,
      marginLeft: 56,
      marginRight: 16,
      style: { background: "transparent", color: c.inkSoft },
      x: { label: null, tickFormat: "d" },
      y: { label: "Index (1947=100, log)", type: "log", grid: true, tickFormat: "~s" },
      marks: [
        ...eras.map((e) =>
          Plot.rectY([e], {
            x1: "start",
            x2: "end",
            y1: 1,
            y2: () => nominalIndex.lastYear ? nominalIndex.at(nominalIndex.lastYear)! : 150000,
            fill: e.band,
            fillOpacity: 0.07,
          }),
        ),
        Plot.lineY(nominalIndex.points, { x: "year", y: "value", stroke: c.signal, strokeWidth: 1.75 }),
        Plot.text(eras, {
          x: (d) => (d.start + d.end) / 2,
          y: () => 120,
          text: "name",
          fontSize: 10,
          fill: c.inkFaint,
          rotate: 0,
        }),
      ],
    }),
    [eras, c],
  );

  const crashOptions = useMemo<Plot.PlotOptions>(() => {
    const data = crashes.map((e) => ({
      ...e,
      recover: e.monthsToRecover ?? 0,
      unrecovered: e.monthsToRecover == null,
    }));
    return {
      height: 320,
      marginLeft: 56,
      marginBottom: 44,
      style: { background: "transparent", color: c.inkSoft },
      x: { label: "Months to recover →", grid: true },
      y: { label: "↑ Peak decline %", grid: true },
      r: { range: [3, 12] },
      marks: [
        Plot.dot(data, {
          x: "recover",
          y: "decline",
          r: "monthsToBottom",
          fill: c.neg,
          fillOpacity: 0.5,
          stroke: c.neg,
        }),
        Plot.text(data, {
          x: "recover",
          y: "decline",
          text: "name",
          fontSize: 9,
          dy: -10,
          fill: c.inkSoft,
        }),
        Plot.tip(
          data,
          Plot.pointer({
            x: "recover",
            y: "decline",
            title: (d) =>
              `${d.name} (${d.period})\n${d.decline}% · bottom ${d.monthsToBottom}mo · recover ${d.monthsToRecover ?? "n/a"}mo`,
            fill: "var(--surface)",
            stroke: c.ruleStrong,
          }),
        ),
      ],
    };
  }, [c]);

  function exportCrashes() {
    downloadCsv(
      "india-crashes.csv",
      crashes.map((e) => ({
        year: e.year,
        name: e.name,
        period: e.period,
        decline_pct: e.decline,
        months_to_bottom: e.monthsToBottom,
        months_to_recover: e.monthsToRecover ?? "",
      })),
    );
  }

  /** Jump to Index Explorer with the era's bounds preset. */
  function openEra(start: number, end: number) {
    navigate("index", { from: String(start), to: String(end) });
  }

  /** Jump to Index Explorer centered on the crash, ±5 years. */
  function openCrash(year: number, recoveryMonths: number | null) {
    const span = Math.max(5, Math.ceil((recoveryMonths ?? 24) / 12) + 2);
    const from = Math.max(1947, year - 3);
    const to = Math.min(2025, year + span);
    navigate("index", { from: String(from), to: String(to) });
  }

  return (
    <div className="space-y-6">
      <figure className="surface p-5">
        <figcaption className="mb-3 flex items-baseline justify-between">
          <h3 className="display text-lg">Index path by policy regime</h3>
          <span className="eyebrow">shaded bands = eras</span>
        </figcaption>
        <PlotFigure options={pathOptions} ariaLabel="Equity index with regime era bands" />
      </figure>

      {/* Regime ledger */}
      <div className="surface overflow-x-auto p-0">
        <table className="ledger">
          <thead>
            <tr>
              <th>Regime</th>
              <th>Years</th>
              <th>Returns</th>
              <th>Risk</th>
              <th>Driver / lesson</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {eras.map((r) => (
              <tr key={r.id}>
                <td style={{ color: "var(--ink)", fontWeight: 600 }}>{r.name}</td>
                <td>{r.years}</td>
                <td>{r.returns}</td>
                <td>{r.risk}</td>
                <td style={{ whiteSpace: "normal", maxWidth: 380, color: "var(--ink-soft)" }}>
                  <span style={{ color: "var(--ink)" }}>{r.driver}</span> {r.lesson}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => openEra(r.start, r.end)}
                    className="px-2 py-1 text-[11px]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      border: "1px solid var(--rule-strong)",
                      background: "transparent",
                      color: "var(--signal)",
                      cursor: "pointer",
                    }}
                    title={`Open Index Explorer focused on ${r.start}–${r.end}`}
                  >
                    Open →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <figure className="surface p-5">
          <figcaption className="mb-3 flex items-baseline justify-between">
            <h3 className="display text-lg">Crash anatomy</h3>
            <span className="eyebrow">size = months to bottom</span>
          </figcaption>
          <PlotFigure options={crashOptions} ariaLabel="Crash decline versus recovery time" />
        </figure>

        <div className="surface overflow-x-auto p-0">
          <div className="flex items-center justify-between px-4 pt-3">
            <h3 className="display text-lg">Every major drawdown</h3>
            <button
              type="button"
              onClick={exportCrashes}
              className="segmented px-3 py-1.5 text-[12px]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
            >
              CSV
            </button>
          </div>
          <table className="ledger mt-2">
            <thead>
              <tr>
                <th>Event</th>
                <th>Decline</th>
                <th>Bottom</th>
                <th>Recover</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {crashes.map((e) => (
                <tr key={`${e.year}-${e.name}`}>
                  <td style={{ color: "var(--ink)" }}>
                    {e.name} <span style={{ color: "var(--ink-faint)" }}>{e.period}</span>
                  </td>
                  <td style={{ color: "var(--neg)" }}>{formatNumber(e.decline, 0)}%</td>
                  <td>{e.monthsToBottom}mo</td>
                  <td>{e.monthsToRecover == null ? "—" : `${e.monthsToRecover}mo`}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => openCrash(e.year, e.monthsToRecover)}
                      className="px-2 py-0.5 text-[11px]"
                      style={{
                        fontFamily: "var(--font-mono)",
                        border: "1px solid var(--rule-strong)",
                        background: "transparent",
                        color: "var(--signal)",
                        cursor: "pointer",
                      }}
                      title={`Open Index Explorer focused on the ${e.name}`}
                    >
                      Open →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
