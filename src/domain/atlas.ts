// Domain adapter: the single bridge between raw data modules and the app.
//
// Raw data (src/data/*) stays untouched as the source of truth. This module
// lifts it into typed Series and exposes the DERIVED analytical surfaces the
// console renders. Every denomination (nominal / real / USD / gold) is computed
// here from source series — no view hardcodes a converted value.

import {
  continuousIndex,
  crashEvents,
  marketRegimes,
  type CrashEvent,
  type Regime,
} from "@/data/indiaMarketData";
import { macroIndicators } from "@/data/macroIndicators";
import { sensexOHLC } from "@/data/sensexOHLC";
import {
  Series,
  deflate,
  denominate,
  priceLevelFromInflation,
  type Year,
} from "./series";

// ---- Base year for all rebased/real comparisons ----
export const BASE_YEAR: Year = 1947;

// ---- Raw → Series lifts ----

function macro(id: string): Series {
  const ind = macroIndicators.find((i) => i.id === id);
  if (!ind) throw new Error(`Unknown macro indicator: ${id}`);
  return new Series(ind.id, ind.name, ind.unit, ind.data);
}

/** Nominal normalized equity index, 1947=100 (the inherited spine series). */
export const nominalIndex = new Series(
  "index-nominal",
  "Equity Index (nominal)",
  "index (1947=100)",
  continuousIndex.map((p) => ({ year: p.year, value: p.value })),
);

export const usdInr = macro("usd-inr");
export const goldPrice = macro("gold-price");
export const cpiInflation = macro("cpi-inflation");

/** CPI price level (1947=100) compounded from annual inflation. */
export const cpiLevel = priceLevelFromInflation(cpiInflation, BASE_YEAR);

// ---- Denominated index surfaces (all rebased to BASE_YEAR=100) ----

export type Denomination = "nominal" | "real" | "usd" | "gold";

export const DENOMINATIONS: Array<{ id: Denomination; label: string; blurb: string }> = [
  { id: "nominal", label: "Nominal ₹", blurb: "Rupee index, no adjustment" },
  { id: "real", label: "Real (CPI)", blurb: "Inflation-adjusted purchasing power" },
  { id: "usd", label: "USD", blurb: "Index converted at year-end USD/INR" },
  { id: "gold", label: "Gold", blurb: "Index priced in grams of gold" },
];

/** Returns the equity index expressed in the chosen denomination, 1947=100. */
export function indexInDenomination(denom: Denomination): Series {
  switch (denom) {
    case "nominal":
      return nominalIndex;
    case "real":
      return deflate(nominalIndex, cpiLevel, BASE_YEAR);
    case "usd":
      return denominate(nominalIndex, usdInr, BASE_YEAR);
    case "gold":
      return denominate(nominalIndex, goldPrice, BASE_YEAR);
  }
}

// ---- Sensex OHLC as Series (close), for the level (not rebased) view ----
export const sensexClose = new Series(
  "sensex-close",
  "BSE Sensex (close)",
  "points",
  sensexOHLC.map((d) => ({ year: d.year, value: d.close })),
);

export const sensexOHLCData = sensexOHLC;

// ---- Catalog of all macro series, grouped by category, for the Macro Lab ----
export interface MacroEntry {
  id: string;
  label: string;
  unit: string;
  category: string;
  source: string;
  series: Series;
}

export const macroCatalog: MacroEntry[] = macroIndicators.map((ind) => ({
  id: ind.id,
  label: ind.name,
  unit: ind.unit,
  category: ind.category,
  source: ind.source,
  series: new Series(ind.id, ind.name, ind.unit, ind.data),
}));

export function macroById(id: string): MacroEntry | undefined {
  return macroCatalog.find((m) => m.id === id);
}

export const macroCategories: string[] = Array.from(
  new Set(macroCatalog.map((m) => m.category)),
);

// ---- Pass-through typed records used by qualitative surfaces ----
export const regimes: Regime[] = marketRegimes;
export const crashes: CrashEvent[] = crashEvents;

// ---- Global year bounds across the spine series ----
export const MIN_YEAR = nominalIndex.firstYear ?? BASE_YEAR;
export const MAX_YEAR = nominalIndex.lastYear ?? BASE_YEAR;
