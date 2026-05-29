// Bridge between the Formula Lab language and the Atlas domain layer.
//
// Exposes:
//   - Annual series (Series): sensex, sensexUsd, sensexGold, sensexReal, gdp, etc.
//   - Monthly series (MonthlySeries): sensexMonthly + 4 sector indices
//   - Functions: every domain primitive (cagr, denominate, rebase, etc.)
//
// Why a separate file: lang.ts is a pure tiny language with no domain
// knowledge. THIS file is the only place that says "the formula 'sensex'
// resolves to the inherited continuousIndex Series". Easy to extend or
// audit in one place.

import {
  Series,
  cagr,
  deflate,
  denominate,
  drawdownSeries,
  pearson,
  rollingCagr,
  totalReturn,
  volatility,
  yoy,
} from "@/domain/series";
import {
  MonthlySeries,
  annualizedSharpe,
  annualizedVolatility,
  monthKey,
  monthlyCagr,
  monthlyTotalReturn,
  periodReturnPct,
  rebaseTo100,
  relativeStrength,
  rollingMonthlyCagr,
  toAnnualPoints,
} from "@/domain/monthly";
import {
  BASE_YEAR,
  SECTOR_INDICES,
  cpiLevel,
  goldPrice,
  indexInDenomination,
  macroCatalog,
  nominalIndex,
  sensexClose,
  sensexMonthly,
  usdInr,
} from "@/domain/atlas";
import {
  type FunctionSpec,
  type Registry,
  type VariableSpec,
  makeRegistry,
} from "./lang";

// ─────────────────────────────────────────────────────────────────────────
// Helpers — strict argument coercion with clear errors
// ─────────────────────────────────────────────────────────────────────────

function asSeries(v: unknown, fn: string, idx: number): Series {
  if (v instanceof Series) return v;
  throw new Error(`${fn}: arg ${idx + 1} must be an annual Series, got ${describe(v)}`);
}

function asMonthly(v: unknown, fn: string, idx: number): MonthlySeries {
  if (v instanceof MonthlySeries) return v;
  throw new Error(`${fn}: arg ${idx + 1} must be a MonthlySeries, got ${describe(v)}`);
}

function asNumber(v: unknown, fn: string, idx: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  throw new Error(`${fn}: arg ${idx + 1} must be a number, got ${describe(v)}`);
}

function asInt(v: unknown, fn: string, idx: number): number {
  const n = asNumber(v, fn, idx);
  if (!Number.isInteger(n)) {
    throw new Error(`${fn}: arg ${idx + 1} must be an integer, got ${n}`);
  }
  return n;
}

function describe(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (v instanceof Series) return "Series";
  if (v instanceof MonthlySeries) return "MonthlySeries";
  return typeof v;
}

// ─────────────────────────────────────────────────────────────────────────
// Variables — the named series + handful of scalars
// ─────────────────────────────────────────────────────────────────────────

function buildVariables(): VariableSpec[] {
  const vars: VariableSpec[] = [
    // Core annual series
    {
      name: "sensex",
      description: "Composite Sensex level (annual, 1947=100 rebased nominal)",
      value: nominalIndex,
    },
    {
      name: "sensexClose",
      description: "Sensex calendar-year close (annual, raw points)",
      value: sensexClose,
    },
    {
      name: "sensexUsd",
      description: "Sensex denominated in USD (annual)",
      value: indexInDenomination("usd"),
    },
    {
      name: "sensexGold",
      description: "Sensex denominated in gold (annual)",
      value: indexInDenomination("gold"),
    },
    {
      name: "sensexReal",
      description: "Sensex deflated by Indian CPI (annual, real)",
      value: indexInDenomination("real"),
    },
    {
      name: "cpiLevel",
      description: "Indian CPI price level (annual, base=1947)",
      value: cpiLevel,
    },
    {
      name: "goldLevel",
      description: "Gold price (INR/g, annual)",
      value: goldPrice,
    },
    {
      name: "usdInrLevel",
      description: "USD/INR exchange rate (annual)",
      value: usdInr,
    },
    // Monthly series
    {
      name: "sensexMonthly",
      description: "Sensex monthly close (1997-06 onward)",
      value: sensexMonthly,
    },
  ];

  // Macro indicators — auto-expose every catalog entry as `macro_<id>`
  for (const m of macroCatalog) {
    vars.push({
      name: `macro_${m.id.replace(/-/g, "_")}`,
      description: `${m.label} (${m.unit}, ${m.category})`,
      value: m.series,
    });
  }

  // Sector monthly series — flatten the SECTOR_INDICES map
  const sectorVarMap: Record<string, string> = {
    nifty: "nifty",
    "nifty-bank": "niftyBank",
    "nifty-it": "niftyIT",
    "nifty-pharma": "niftyPharma",
  };
  for (const [id, series] of SECTOR_INDICES) {
    const varName = sectorVarMap[id];
    if (!varName) continue;
    vars.push({
      name: varName,
      description: `${series.label} (monthly)`,
      value: series,
    });
  }

  return vars;
}

// ─────────────────────────────────────────────────────────────────────────
// Functions — the domain primitives
// ─────────────────────────────────────────────────────────────────────────

function buildFunctions(): FunctionSpec[] {
  return [
    // Annual primitives
    {
      name: "cagr",
      description: "Compound annual growth rate (in %)",
      arity: [3],
      examples: ["cagr(sensex, 1979, 2025)"],
      fn: (s, from, to) =>
        cagr(asSeries(s, "cagr", 0), asInt(from, "cagr", 1), asInt(to, "cagr", 2)),
    },
    {
      name: "totalReturn",
      description: "Total return over a window (in %)",
      arity: [3],
      examples: ["totalReturn(sensex, 1979, 2025)"],
      fn: (s, from, to) =>
        totalReturn(
          asSeries(s, "totalReturn", 0),
          asInt(from, "totalReturn", 1),
          asInt(to, "totalReturn", 2),
        ),
    },
    {
      name: "yoy",
      description: "Year-over-year growth series (in %)",
      arity: [1],
      examples: ["yoy(sensex)"],
      fn: (s) => yoy(asSeries(s, "yoy", 0)),
    },
    {
      name: "rollingCagr",
      description: "Rolling N-year CAGR series (in %)",
      arity: [2],
      examples: ["rollingCagr(sensex, 10)"],
      fn: (s, n) =>
        rollingCagr(asSeries(s, "rollingCagr", 0), asInt(n, "rollingCagr", 1)),
    },
    {
      name: "volatility",
      description: "Annualized stdev of YoY returns over a window (in %)",
      arity: [3],
      examples: ["volatility(sensex, 1979, 2025)"],
      fn: (s, from, to) =>
        volatility(
          asSeries(s, "volatility", 0),
          asInt(from, "volatility", 1),
          asInt(to, "volatility", 2),
        ),
    },
    {
      name: "drawdown",
      description: "Drawdown series from running peak (in %)",
      arity: [1],
      examples: ["drawdown(sensex)"],
      fn: (s) => drawdownSeries(asSeries(s, "drawdown", 0)),
    },
    {
      name: "pearson",
      description: "Pearson correlation of YoY returns (optional window)",
      arity: [2, 4],
      examples: [
        "pearson(sensex, macro_cpi_inflation)",
        "pearson(sensex, macro_cpi_inflation, 1991, 2025)",
      ],
      fn: (a, b, from, to) =>
        pearson(
          asSeries(a, "pearson", 0),
          asSeries(b, "pearson", 1),
          from === undefined ? undefined : asInt(from, "pearson", 2),
          to === undefined ? undefined : asInt(to, "pearson", 3),
        ),
    },
    {
      name: "deflate",
      description: "Deflate a nominal series by a price level (default base 1947)",
      arity: [2, 3],
      examples: ["deflate(sensex, cpiLevel)"],
      fn: (s, p, base) =>
        deflate(
          asSeries(s, "deflate", 0),
          asSeries(p, "deflate", 1),
          base === undefined ? BASE_YEAR : asInt(base, "deflate", 2),
        ),
    },
    {
      name: "denominate",
      description: "Re-denominate a series in another series' units",
      arity: [2, 3],
      examples: ["denominate(sensex, goldLevel)"],
      fn: (s, p, base) =>
        denominate(
          asSeries(s, "denominate", 0),
          asSeries(p, "denominate", 1),
          base === undefined ? BASE_YEAR : asInt(base, "denominate", 2),
        ),
    },

    // Monthly primitives
    {
      name: "monthlyCagr",
      description: "CAGR (in %) over a monthly window",
      arity: [3],
      examples: ["monthlyCagr(sensexMonthly, 199706, 202604)"],
      fn: (s, from, to) =>
        monthlyCagr(
          asMonthly(s, "monthlyCagr", 0),
          asInt(from, "monthlyCagr", 1),
          asInt(to, "monthlyCagr", 2),
        ),
    },
    {
      name: "monthlyTotalReturn",
      description: "Total return (%) over a monthly window",
      arity: [3],
      fn: (s, from, to) =>
        monthlyTotalReturn(
          asMonthly(s, "monthlyTotalReturn", 0),
          asInt(from, "monthlyTotalReturn", 1),
          asInt(to, "monthlyTotalReturn", 2),
        ),
    },
    {
      name: "annualizedSharpe",
      description: "Annualized Sharpe ratio (rf% as second arg)",
      arity: [2],
      examples: ["annualizedSharpe(sensexMonthly, 6)"],
      fn: (s, rf) =>
        annualizedSharpe(
          asMonthly(s, "annualizedSharpe", 0),
          asNumber(rf, "annualizedSharpe", 1),
        ),
    },
    {
      name: "annualizedVolatility",
      description: "Annualized vol of monthly log returns",
      arity: [1],
      examples: ["annualizedVolatility(sensexMonthly)"],
      fn: (s) => annualizedVolatility(asMonthly(s, "annualizedVolatility", 0)),
    },
    {
      name: "rollingMonthlyCagr",
      description: "Rolling N-month CAGR series (in %)",
      arity: [2],
      fn: (s, n) =>
        rollingMonthlyCagr(
          asMonthly(s, "rollingMonthlyCagr", 0),
          asInt(n, "rollingMonthlyCagr", 1),
        ),
    },
    {
      name: "rebaseTo100",
      description: "Rebase a monthly series to 100 at an anchor month",
      arity: [2],
      examples: ["rebaseTo100(niftyBank, 200708)"],
      fn: (s, anchor) =>
        rebaseTo100(
          asMonthly(s, "rebaseTo100", 0),
          asInt(anchor, "rebaseTo100", 1),
        ),
    },
    {
      name: "relativeStrength",
      description: "Relative strength of A vs B (rebased ratio × 100)",
      arity: [3],
      examples: ["relativeStrength(niftyBank, nifty, 200708)"],
      fn: (a, b, anchor) =>
        relativeStrength(
          asMonthly(a, "relativeStrength", 0),
          asMonthly(b, "relativeStrength", 1),
          asInt(anchor, "relativeStrength", 2),
        ),
    },
    {
      name: "periodReturn",
      description: "Period return (%) over a monthly window",
      arity: [3],
      fn: (s, from, to) =>
        periodReturnPct(
          asMonthly(s, "periodReturn", 0),
          asInt(from, "periodReturn", 1),
          asInt(to, "periodReturn", 2),
        ),
    },
    {
      name: "monthlyToAnnual",
      description: 'Convert monthly to annual ("last", "avg", or "sum")',
      arity: [2],
      examples: ['monthlyToAnnual(sensexMonthly, "last")'],
      fn: (s, agg) => {
        const a = agg as string;
        if (a !== "last" && a !== "avg" && a !== "sum") {
          throw new Error(
            `monthlyToAnnual: aggregation must be "last", "avg", or "sum", got "${a}"`,
          );
        }
        return toAnnualPoints(asMonthly(s, "monthlyToAnnual", 0), a);
      },
    },

    // Helpers
    {
      name: "monthKey",
      description: 'Construct a month key from year and month (1-12)',
      arity: [2],
      examples: ["monthKey(2020, 3)"],
      fn: (y, m) =>
        monthKey(asInt(y, "monthKey", 0), asInt(m, "monthKey", 1)),
    },
  ];
}

/** Build the Atlas registry — call once and cache. */
export function buildAtlasRegistry(): Registry {
  return makeRegistry(buildFunctions(), buildVariables());
}

/** All variable specs for help/autocomplete UIs. */
export function listAtlasVariables(): VariableSpec[] {
  return buildVariables();
}

/** All function specs for help/autocomplete UIs. */
export function listAtlasFunctions(): FunctionSpec[] {
  return buildFunctions();
}
