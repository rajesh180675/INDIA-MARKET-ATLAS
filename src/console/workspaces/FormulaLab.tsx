import { useMemo, useState } from "react";
import * as Plot from "@observablehq/plot";
import { Series } from "@/domain/series";
import { MonthlySeries, fromMonthKey } from "@/domain/monthly";
import {
  buildAtlasRegistry,
  listAtlasFunctions,
  listAtlasVariables,
} from "../formula/atlas-registry";
import { EvalError, ParseError, run } from "../formula/lang";
import PlotFigure from "../PlotFigure";
import Provenance from "../Provenance";
import { atlasColors } from "../theme-colors";
import { useAtlasState } from "../url-state";

// Sample formulas to seed users with credible queries
const EXAMPLES = [
  {
    label: "Sensex CAGR 1979–2025",
    src: "cagr(sensex, 1979, 2025)",
  },
  {
    label: "Sensex denominated in gold (real wealth)",
    src: "denominate(sensex, goldLevel)",
  },
  {
    label: "Real Sensex deflated by CPI",
    src: "deflate(sensex, cpiLevel)",
  },
  {
    label: "Sensex 10Y rolling CAGR",
    src: "rollingCagr(sensex, 10)",
  },
  {
    label: "Sensex monthly Sharpe (rf=6%)",
    src: "annualizedSharpe(sensexMonthly, 6)",
  },
  {
    label: "Nifty Bank vs Nifty 50 (relative strength)",
    src: "relativeStrength(niftyBank, nifty, 200708)",
  },
  {
    label: "Correlation: Sensex YoY vs CPI inflation",
    src: 'pearson(sensex, macro_cpi_inflation, 1991, 2025)',
  },
] as const;

function fmtScalar(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

function describeType(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (v instanceof Series) return `Series (${v.points.length} pts)`;
  if (v instanceof MonthlySeries) return `MonthlySeries (${v.points.length} pts)`;
  if (typeof v === "number") return "number";
  if (typeof v === "string") return "string";
  if (Array.isArray(v)) return `Array (${v.length} items)`;
  return typeof v;
}

interface RunResult {
  ok: boolean;
  value?: unknown;
  error?: { message: string; kind: "parse" | "eval" | "unknown" };
}

function runFormula(source: string): RunResult {
  if (!source.trim()) {
    return { ok: false, error: { message: "Empty formula", kind: "parse" } };
  }
  try {
    const registry = buildAtlasRegistry();
    return { ok: true, value: run(source, registry) };
  } catch (e) {
    if (e instanceof ParseError) {
      return {
        ok: false,
        error: { message: `Parse error: ${e.message}`, kind: "parse" },
      };
    }
    if (e instanceof EvalError) {
      return {
        ok: false,
        error: { message: e.message, kind: "eval" },
      };
    }
    return {
      ok: false,
      error: {
        message: e instanceof Error ? e.message : String(e),
        kind: "unknown",
      },
    };
  }
}

export default function FormulaLab({ theme }: { theme: string }) {
  void theme;
  const { state, setParam } = useAtlasState();
  const c = useMemo(() => atlasColors(), []);

  // Source lives in the URL so formulas are shareable
  const urlSource = state.params.get("f") ?? "";
  const [draft, setDraft] = useState(urlSource);

  const [showHelp, setShowHelp] = useState(false);

  // Run the active (URL) source — keeps the canvas stable while user edits
  const result = useMemo(() => runFormula(urlSource), [urlSource]);

  function commit() {
    setParam("f", draft.trim() || null);
  }

  function loadExample(src: string) {
    setDraft(src);
    setParam("f", src);
  }

  return (
    <div className="space-y-5">
      {/* Editor */}
      <div className="surface p-5">
        <label className="eyebrow mb-2 block" htmlFor="formula-input">
          Formula
        </label>
        <textarea
          id="formula-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          spellCheck={false}
          rows={3}
          placeholder="e.g. cagr(sensex, 1979, 2025)"
          className="num w-full resize-y rounded-none border bg-transparent px-3 py-2 text-[14px]"
          style={{
            borderColor: "var(--rule)",
            color: "var(--ink)",
            fontFamily: "var(--font-mono)",
          }}
          aria-describedby="formula-help-hint"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={commit}
            className="segmented px-3 py-1.5 text-[13px]"
            style={{ color: "var(--signal)" }}
          >
            Evaluate (⌘↵)
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft("");
              setParam("f", null);
            }}
            className="segmented px-3 py-1.5 text-[12px]"
            style={{ color: "var(--ink-soft)" }}
          >
            Clear
          </button>
          <span
            id="formula-help-hint"
            className="ml-2 text-[11px]"
            style={{ color: "var(--ink-faint)" }}
          >
            URL captures the formula for sharing
          </span>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="ml-auto text-[12px] underline"
            style={{ color: "var(--ink-soft)" }}
            aria-expanded={showHelp}
          >
            {showHelp ? "Hide" : "Show"} reference
          </button>
        </div>
      </div>

      {/* Examples */}
      <div className="surface p-4">
        <div className="eyebrow mb-2">Examples</div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.src}
              type="button"
              onClick={() => loadExample(ex.src)}
              className="segmented px-2.5 py-1 text-[11.5px]"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--ink-soft)",
              }}
              title={ex.src}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      <ResultPanel result={result} colors={c} />

      {/* Optional help */}
      {showHelp ? <ReferencePanel /> : null}

      <div className="surface rule-t pt-3">
        <Provenance id="formula" label="Formula language" />
      </div>
    </div>
  );
}

function ResultPanel({
  result,
  colors,
}: {
  result: RunResult;
  colors: ReturnType<typeof atlasColors>;
}) {
  if (!result.ok && result.error) {
    return (
      <div
        className="surface p-5"
        role="alert"
        style={{
          background: "var(--neg-wash)",
          borderLeft: "3px solid var(--neg)",
        }}
      >
        <div className="eyebrow" style={{ color: "var(--neg)" }}>
          {result.error.kind === "parse"
            ? "Parse error"
            : result.error.kind === "eval"
              ? "Evaluation error"
              : "Error"}
        </div>
        <p
          className="num mt-2 text-[13px]"
          style={{ color: "var(--ink)", whiteSpace: "pre-wrap" }}
        >
          {result.error.message}
        </p>
      </div>
    );
  }

  const v = result.value;

  // Empty / null
  if (v === undefined || v === null) {
    return (
      <div className="surface p-5">
        <p className="text-[13px]" style={{ color: "var(--ink-faint)" }}>
          (Result is null — likely missing data at the requested year/month, or
          insufficient overlap for a correlation. Try widening the window.)
        </p>
      </div>
    );
  }

  // Scalar number
  if (typeof v === "number") {
    return (
      <div className="surface p-5">
        <div className="eyebrow mb-1">Result · scalar</div>
        <div
          className="display num text-5xl"
          style={{ color: "var(--signal)" }}
        >
          {fmtScalar(v)}
        </div>
      </div>
    );
  }

  // String
  if (typeof v === "string") {
    return (
      <div className="surface p-5">
        <div className="eyebrow mb-1">Result · string</div>
        <div
          className="num text-[15px]"
          style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}
        >
          "{v}"
        </div>
      </div>
    );
  }

  // Annual Series
  if (v instanceof Series) {
    return <AnnualSeriesPanel series={v} colors={colors} />;
  }

  // Monthly Series
  if (v instanceof MonthlySeries) {
    return <MonthlySeriesPanel series={v} colors={colors} />;
  }

  // Array (e.g. drawdown points)
  if (Array.isArray(v)) {
    return <ArrayPanel array={v} />;
  }

  // Fallback
  return (
    <div className="surface p-5">
      <div className="eyebrow mb-2">Result · {describeType(v)}</div>
      <pre
        className="num overflow-x-auto text-[12px]"
        style={{ color: "var(--ink-soft)", fontFamily: "var(--font-mono)" }}
      >
        {JSON.stringify(v, null, 2)?.slice(0, 4000) ?? String(v)}
      </pre>
    </div>
  );
}

function AnnualSeriesPanel({
  series,
  colors,
}: {
  series: Series;
  colors: ReturnType<typeof atlasColors>;
}) {
  const data = series.points.map((p) => ({ year: p.year, value: p.value }));
  const opts: Plot.PlotOptions = {
    width: 880,
    height: 300,
    marginLeft: 60,
    marginRight: 16,
    marginBottom: 32,
    style: {
      background: "transparent",
      color: colors.inkSoft,
      fontSize: "12px",
    },
    x: { label: null, tickFormat: "d" },
    y: { label: `↑ ${series.label} (${series.unit})`, grid: true },
    marks: [
      Plot.lineY(data, {
        x: "year",
        y: "value",
        stroke: colors.signal,
        strokeWidth: 1.6,
      }),
      Plot.tip(
        data,
        Plot.pointerX({
          x: "year",
          y: "value",
          stroke: colors.ruleStrong,
          fill: "var(--surface)",
        }),
      ),
    ],
  };
  return (
    <figure className="surface p-5">
      <figcaption className="mb-3 flex items-baseline justify-between">
        <h3 className="display text-lg">{series.label}</h3>
        <span
          className="num text-[12px]"
          style={{ color: "var(--ink-faint)" }}
        >
          annual · {series.points.length} pts · {series.unit}
        </span>
      </figcaption>
      <PlotFigure options={opts} ariaLabel={`Annual line chart of ${series.label}`} />
    </figure>
  );
}

function MonthlySeriesPanel({
  series,
  colors,
}: {
  series: MonthlySeries;
  colors: ReturnType<typeof atlasColors>;
}) {
  const data = series.points.map((p) => {
    const { year, month } = fromMonthKey(p.key);
    return { date: new Date(Date.UTC(year, month - 1, 1)), value: p.value };
  });
  const opts: Plot.PlotOptions = {
    width: 880,
    height: 300,
    marginLeft: 60,
    marginRight: 16,
    marginBottom: 32,
    style: {
      background: "transparent",
      color: colors.inkSoft,
      fontSize: "12px",
    },
    x: { type: "time", label: null },
    y: { label: `↑ ${series.label} (${series.unit})`, grid: true },
    marks: [
      Plot.lineY(data, {
        x: "date",
        y: "value",
        stroke: colors.signal,
        strokeWidth: 1.5,
      }),
      Plot.tip(
        data,
        Plot.pointerX({
          x: "date",
          y: "value",
          stroke: colors.ruleStrong,
          fill: "var(--surface)",
        }),
      ),
    ],
  };
  return (
    <figure className="surface p-5">
      <figcaption className="mb-3 flex items-baseline justify-between">
        <h3 className="display text-lg">{series.label}</h3>
        <span
          className="num text-[12px]"
          style={{ color: "var(--ink-faint)" }}
        >
          monthly · {series.points.length} pts · {series.unit}
        </span>
      </figcaption>
      <PlotFigure options={opts} ariaLabel={`Monthly line chart of ${series.label}`} />
    </figure>
  );
}

function ArrayPanel({ array }: { array: unknown[] }) {
  if (array.length === 0) {
    return (
      <div className="surface p-5">
        <p className="text-[13px]" style={{ color: "var(--ink-faint)" }}>
          (Empty array)
        </p>
      </div>
    );
  }
  // Render up to first 200 rows as a table if entries look like objects
  const sample = array[0];
  const isObjArray =
    typeof sample === "object" &&
    sample !== null &&
    !Array.isArray(sample);

  if (!isObjArray) {
    return (
      <div className="surface p-5">
        <div className="eyebrow mb-2">Array · {array.length} items</div>
        <pre
          className="num overflow-x-auto text-[12px]"
          style={{ color: "var(--ink-soft)", fontFamily: "var(--font-mono)" }}
        >
          {JSON.stringify(array.slice(0, 200), null, 2)}
        </pre>
      </div>
    );
  }
  const rows = array.slice(0, 200) as Array<Record<string, unknown>>;
  const keys = Array.from(
    new Set(rows.flatMap((r) => Object.keys(r))),
  );
  return (
    <div className="surface p-5">
      <div className="eyebrow mb-2">
        Array · {array.length} items {array.length > 200 ? "(showing first 200)" : ""}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="rule-b" style={{ color: "var(--ink-soft)" }}>
              {keys.map((k) => (
                <th key={k} className="px-2 py-1.5 text-left font-medium">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="rule-b">
                {keys.map((k) => (
                  <td
                    key={k}
                    className="num px-2 py-1"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {formatCell(r[k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return fmtScalar(v);
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function ReferencePanel() {
  const fns = listAtlasFunctions();
  const vars = listAtlasVariables();
  return (
    <div className="surface p-5">
      <div className="eyebrow mb-2">Reference</div>
      <p
        className="mb-4 text-[12.5px]"
        style={{ color: "var(--ink-soft)" }}
      >
        Tiny safe expression language. Single function-call tree per formula.
        No operators, no assignment, no flow control. Numbers, strings,
        identifiers, and nested calls only.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="eyebrow mb-2">Variables ({vars.length})</div>
          <ul className="space-y-1.5 text-[12px]">
            {vars.map((v) => (
              <li key={v.name}>
                <code
                  className="num"
                  style={{
                    color: "var(--signal)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {v.name}
                </code>
                <span style={{ color: "var(--ink-soft)" }}>
                  {" — "}
                  {v.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-2">Functions ({fns.length})</div>
          <ul className="space-y-1.5 text-[12px]">
            {fns.map((f) => (
              <li key={f.name}>
                <code
                  className="num"
                  style={{
                    color: "var(--signal)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {f.name}({f.arity.join("|")} args)
                </code>
                <span style={{ color: "var(--ink-soft)" }}>
                  {" — "}
                  {f.description}
                </span>
                {f.examples?.length ? (
                  <div
                    className="num mt-0.5 text-[10.5px]"
                    style={{
                      color: "var(--ink-faint)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    e.g. {f.examples[0]}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
