# India Market Atlas

A research console for India's equity market history, 1947–2025, plus a greenfield MoSPI State Economy Lab. Ten analytical workspaces share one URL-addressable shell; curated market/macro workspaces stay typed in-app, while MoSPI expansion is backed by catalog/public artifacts.

**Live:** [india-market-atlas.vercel.app](https://india-market-atlas.vercel.app)

## Workspaces

| Slug | Workspace | What it answers |
|------|-----------|-----------------|
| `index` | Index Explorer | What did the equity index do — in nominal ₹, real ₹, USD, or gold terms? Line or candle. |
| `macro` | Macro Lab | How do 16 curated macro indicators behave over time, against each other, or correlated as a matrix? |
| `state-economy` | State Economy Lab | MoSPI State SDP source readiness, quality gates, and state/UT comparison shell. |
| `race` | Asset Race | ₹100 in 1979 across equities, gold, USD, FD@policy-rate, inflation. |
| `sip` | SIP Simulator | Every start × end SIP scenario vs lumpsum. CAGR/IRR heatmap. |
| `vol` | Volatility & Risk | Monthly Sensex drawdowns, rolling Sharpe, and volatility since 1997. |
| `sectors` | Sector Lab | Nifty composite + Bank/IT/Pharma rotation and relative strength. |
| `formula` | Formula Lab | Compose queries directly against the domain layer. |
| `regimes` | Regimes & Crashes | Policy eras + every drawdown ≥10%, with deep-link into Index Explorer. |
| `projections` | Projection Studio | Live CAGR/inflation sliders extending to 2050. |

URL state is workspace-scoped and shareable — every selection (denomination, year window, indicators, scenario sliders) round-trips through the hash.

Press `⌘K` / `Ctrl+K` for the command palette.

## Architecture

```
src/
├── data/           Curated static market/macro dataset (1947–2025)
│   ├── indiaMarketData.ts    Equity index + scenarios
│   ├── macroIndicators.ts    16 curated Macro Lab indicators
│   └── sensexOHLC.ts          Annual OHLC, 1979+
├── domain/         Pure derivation layer (Series + atlas + provenance)
│   ├── series.ts             cagr, deflate, denominate, drawdown, pearson,
│   │                          correlationMatrix, sipReturns, compoundAtRate
│   ├── atlas.ts              Workspace-facing series composition
│   ├── mospi/                MoSPI contracts, geography/period utilities, adapters
│   └── provenance.ts         Source / methodology / caveats registry
├── console/        Research Console UI shell
│   ├── workspaces/           One file per workspace, including StateEconomyLab
│   ├── url-state.ts          Workspace-scoped hash routing
│   ├── controls.tsx          Segmented (ARIA toolbar), YearWindow, Slider
│   ├── PlotFigure.tsx        ResizeObserver-driven Observable Plot wrapper
│   ├── CommandPalette.tsx    ⌘K launcher
│   └── Provenance.tsx        Inline source disclosure
├── lib/            csv, format helpers
└── App.tsx         Shell: rail + shared YearWindow + lazy workspace routing

data/catalog/       Explicit MoSPI source, geography, and unit registries
data/raw/mospi/     Raw MoSPI discovery/source cache
public/data/mospi/  Static public MoSPI artifacts consumed by State Economy Lab
```

**Stack:** React 19 + TypeScript + Vite + Tailwind 4 + Observable Plot.

## Verification

| Layer | Tooling | Count |
|-------|---------|-------|
| Type safety | `tsc --noEmit` | 0 errors |
| Unit/component tests | Vitest | 209 |
| Functional + accessibility E2E | Playwright | 30 default checks |
| Visual regression | Playwright snapshots | 12 (opt-in via `RUN_VISUAL=1`) |
| CI | GitHub Actions / `npm run ci` | typecheck + lint + unit + build + E2E |
| Data freshness | Quarterly cron | auto-issue when sources >2y stale |

## Development

```bash
npm install
npm run dev                   # localhost:5173
npm run build                 # production build
npm run lint                  # eslint (also included in ci)
npm test                      # full ci: typecheck + lint + vitest + Playwright
npx playwright test           # E2E + a11y (visual suite skipped by default)
RUN_VISUAL=1 npx playwright test tests/e2e/visual.spec.ts  # visual regression
node scripts/check-data-freshness.cjs                       # audit dataset
```

## Design principles

1. **Domain layer is pure.** No React, no fetch — just `Series`, `cagr()`, `deflate()`, `pearson()`, etc. Workspaces are thin views over these primitives.
2. **URL-as-truth.** Every analytical state is a hash param. Reload, share, paste — same result.
3. **Provenance over presentation.** Every figure exposes source/methodology/caveat context. Numbers without their lineage are not trustworthy.
4. **Curated Macro Lab, separate MoSPI platform.** The existing Macro Lab remains a 16-indicator headline surface. Full MoSPI expansion uses explicit catalogs and public artifacts instead of large static TypeScript arrays.
5. **Quant-editorial visual language.** Light-first ink-on-paper, serif display, monospace numerics, ruled surfaces, one signal accent. No glass, no gradients, no motion.
5. **One signal accent.** Color encodes data, not chrome.

## Data sources

| Series | Source | Notes |
|--------|--------|-------|
| Sensex points (1979+) | BSE India | Official annual OHLC |
| Equity index (1947–1978) | RBI Share Price Index | Pre-Sensex proxy, normalized to 100 in 1947 |
| CPI inflation | MOSPI, RBI, Labour Bureau | All-India headline series |
| USD/INR | RBI, IMF IFS | Annual reference rate |
| Gold (₹/10g) | RBI, World Gold Council, IBJA | Mumbai standard |
| Repo / 10Y G-Sec / Forex | RBI Handbook | Quarterly rates resampled to annual |
| GDP / savings | MOSPI National Accounts | At current prices |
| Demat / FII | NSDL, SEBI | Scaled to crores |
| Population | Census of India, UN PD | Mid-year estimates |
| Crude oil | PPAC | Indian basket |
| Sensex P/E | BSE India | Year-end |

Refreshes are manual — none of these sources expose programmatic feeds. The quarterly freshness workflow alerts when the dataset drifts past two years; refreshes are PR'd by hand.

## License

MIT.
