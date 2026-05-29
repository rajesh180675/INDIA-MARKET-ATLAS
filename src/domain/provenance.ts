// Data provenance: a single source-of-truth registry for what each analytical
// surface in the console is, where the underlying numbers come from, and how
// they're computed. Surfaced via the <Provenance> UI primitive so every figure
// and readout is auditable — this is what distinguishes a research console
// from a dashboard.

import { macroCatalog } from "./atlas";

export interface ProvenanceEntry {
  /** Stable identifier matching a Series id or a domain concept slug. */
  id: string;
  /** Human-readable surface name. */
  label: string;
  /** Concise description of what the number means. */
  description: string;
  /** Where the underlying numbers come from. */
  sources: string[];
  /** How derived numbers are computed (skip for raw series). */
  methodology?: string;
  /** Calendar convention (calendar-year vs fiscal-year vs year-end snapshot). */
  convention?: string;
  /** Coverage window. */
  coverage: string;
  /** Caveats: known data quality issues, splices, regime breaks. */
  caveats?: string[];
}

const PROVENANCE: ProvenanceEntry[] = [
  {
    id: "index-nominal",
    label: "Equity Index (nominal)",
    description:
      "Continuous Indian equity-market index normalized to 1947=100. Pre-1979 backcast spliced from RBI/NSI proxies; 1979→present uses the BSE Sensex returns.",
    sources: [
      "BSE Sensex (1979–2025), historical year-end levels",
      "RBI Handbook of Statistics (pre-1979 equity proxy series)",
    ],
    methodology:
      "Normalize each source segment so the spline year matches; compound year-on-year returns to maintain a continuous level. Annual frequency; end-of-period values.",
    convention: "Calendar year, year-end close",
    coverage: "1947–2025 (annual)",
    caveats: [
      "Pre-1979 data uses proxy series — fewer constituents, narrower coverage than today's Sensex",
      "Year-end-only sampling masks intra-year volatility",
    ],
  },
  {
    id: "index-real",
    label: "Equity Index (real, CPI-adjusted)",
    description:
      "Nominal index deflated by the CPI price level, expressed in 1947 rupees of constant purchasing power.",
    sources: ["Nominal index (above)", "Consumer Price Index (annual %)"],
    methodology:
      "Compound the annual CPI inflation rates into a price level (1947=100), then divide the nominal index by that level and re-rebase to 1947=100.",
    convention: "Calendar year",
    coverage: "1947–2025",
    caveats: [
      "CPI methodology has changed multiple times (CPI-IW, CPI-Combined). The series stitches these without an inter-method adjustment.",
    ],
  },
  {
    id: "index-usd",
    label: "Equity Index (USD)",
    description:
      "Nominal index converted to USD at the year-end USD/INR rate, then rebased to 1947=100.",
    sources: ["Nominal index", "RBI year-end USD/INR reference rate"],
    methodology:
      "Divide the nominal index by the USD/INR series, then rebase to 1947=100. Captures the impact of currency depreciation on rupee returns when viewed by a USD-based investor.",
    convention: "Calendar year, year-end FX",
    coverage: "1947–2025",
    caveats: [
      "Multiple FX-regime transitions (fixed-rate 1947–66, multiple-fix 1966–91, market-determined 1991+) are spliced without adjustment.",
      "Year-end-only FX sampling masks intra-year currency moves.",
    ],
  },
  {
    id: "index-gold",
    label: "Equity Index (gold-priced)",
    description:
      "Nominal index priced in domestic gold (INR per 10g), then rebased to 1947=100.",
    sources: ["Nominal index", "Domestic gold price (INR/10g)"],
    methodology:
      "Divide the nominal index by the gold price series, then rebase to 1947=100. Shows equity performance against a hard-money benchmark.",
    convention: "Calendar year, year-end gold price",
    coverage: "1947–2025",
    caveats: [
      "Domestic gold price reflects import duties, regulatory premia, and the 1962–90 Gold Control Act regime, not just world spot.",
    ],
  },
  {
    id: "cpi-level",
    label: "CPI Price Level (1947=100)",
    description:
      "Compounded price level synthesized from annual CPI inflation. Shows what ₹1 of 1947 needs to grow to in any later year to keep pace with prices.",
    sources: ["MOSPI / RBI Handbook (CPI inflation, % YoY)"],
    methodology:
      "Compound: P(y) = P(y-1) × (1 + inflation%/100), with P(1947)=100. Methodology splices CPI-IW and CPI-Combined without re-weighting.",
    convention: "Calendar year",
    coverage: "1947–2025",
    caveats: [
      "Spliced across multiple official methodologies — long-window CAGR is approximate.",
    ],
  },
  {
    id: "asset-race",
    label: "Asset Race tracks",
    description:
      "Five comparable wealth paths from 1979, all rebased so 1979 = 100: equity index, domestic gold price, USD held in INR terms, fixed deposit at the policy rate, and the CPI price level.",
    sources: [
      "Nominal equity index",
      "Domestic gold (INR/10g)",
      "RBI USD/INR year-end",
      "RBI repo / policy rate",
      "CPI price level (above)",
    ],
    methodology:
      "Equity, gold, and USD: rebase the underlying series to 1979=100. FD: compound ₹100 at the year-on-year policy rate (no taxes, no compounding within year). Inflation: rebase the CPI price level. All gross of taxes, fees, and reinvestment frictions.",
    convention: "Calendar year, year-end values",
    coverage: "1979–2025",
    caveats: [
      "FD path uses the headline policy rate, not actual depositor rates which historically ran 1–2% higher with bank-by-bank variation",
      "Gross of all taxes (capital gains, interest income, FX conversion charges) — relative ordering can shift on an after-tax basis",
    ],
  },
  {
    id: "regimes",
    label: "Policy regimes",
    description:
      "Era classification of Indian markets by macro/political regime, with median return characteristics and qualitative drivers.",
    sources: [
      "Author classification using GDP growth × inflation × policy stance",
      "Underlying data from RBI, MOSPI, and contemporary economic history",
    ],
    methodology:
      "Periods identified by structural breaks (1947 independence, 1969 nationalization, 1991 liberalization, 2003 commodity boom, 2008 GFC). Returns computed as median annual real returns within each window.",
    coverage: "1947–2025 (5 regimes)",
    caveats: [
      "Boundary years are judgment calls — alternative dates would shift the per-regime statistics",
    ],
  },
  {
    id: "crashes",
    label: "Major drawdowns",
    description:
      "Catalog of every major equity drawdown of >25%, with peak decline, months to bottom, and months to recover.",
    sources: ["BSE Sensex monthly highs/lows", "Author analysis"],
    methodology:
      "Drawdown = peak-to-trough decline in nominal Sensex; recovery = months from trough to first new all-time high. 'Unrecovered' marks events still below their prior peak as of the data end.",
    coverage: "1979–2025",
    caveats: [
      "Nominal-rupee drawdowns; real (CPI-adjusted) drawdowns would be deeper and recoveries longer",
    ],
  },
  {
    id: "projections",
    label: "Projection methodology",
    description:
      "Extrapolated paths from the current Sensex level to 2050 under user-specified nominal CAGR and inflation assumptions. Real path is the nominal path deflated at the assumed inflation rate.",
    sources: [
      "BSE Sensex year-end close (launch point)",
      "User-supplied CAGR and inflation assumptions",
    ],
    methodology:
      "Geometric extrapolation: nominal(t) = launch × (1 + cagr)^(t − launchYear); real(t) = nominal(t) / (1 + inflation)^(t − launchYear). No mean reversion, no path uncertainty, no regime changes — pure deterministic compounding.",
    coverage: "2025–2050 (forward, illustrative)",
    caveats: [
      "Deterministic single-path projection. Real outcomes will deviate substantially due to regime changes, valuation reversion, and macro shocks.",
      "Assumes constant CAGR and inflation across the entire window — historically these have varied by regime.",
      "Pre-built scenarios are author judgments based on inherited research, not consensus forecasts.",
    ],
  },
  {
    id: "sensex-monthly",
    label: "Sensex monthly close",
    description:
      "Monthly Sensex closing values powering the Volatility & Risk workspace. Enables credible Sharpe, annualized volatility, and drawdown analysis that annual data cannot support.",
    sources: ["Yahoo Finance ^BSESN (interval=1mo)"],
    methodology:
      "Monthly close pulled from Yahoo Finance v8 chart endpoint. Drawdowns computed from running peak. Sharpe and volatility use log returns; volatility annualizes monthly stdev by √12; Sharpe uses an annual risk-free rate of 6% (Indian 10Y G-Sec long-run average) converted to monthly log-equivalent.",
    convention: "Last trading day of each month (UTC).",
    coverage: "1997-06 onward",
    caveats: [
      "Yahoo's earliest monthly Sensex data is 1997-06; pre-1997 history must use the annual continuousIndex which is not directly comparable",
      "Refreshes are manual via scripts/fetch-monthly-data.cjs",
      "Risk-free rate of 6% is a long-run approximation; recent years may diverge",
    ],
  },
];

const PROVENANCE_BY_ID = new Map<string, ProvenanceEntry>();
PROVENANCE.forEach((p) => PROVENANCE_BY_ID.set(p.id, p));

/** Look up provenance for a given series/surface id. */
export function getProvenance(id: string): ProvenanceEntry | undefined {
  // First the curated registry (derived/spliced surfaces)
  const curated = PROVENANCE_BY_ID.get(id);
  if (curated) return curated;
  // Fall back to raw macro indicator metadata
  const macro = macroCatalog.find((m) => m.id === id);
  if (macro) {
    return {
      id: macro.id,
      label: macro.label,
      description: `${macro.label} — raw macro indicator (${macro.unit}, ${macro.category}).`,
      sources: [macro.source],
      coverage: `${macro.series.firstYear ?? "n/a"}–${macro.series.lastYear ?? "n/a"} (annual)`,
    };
  }
  return undefined;
}

export const ALL_PROVENANCE = PROVENANCE;
