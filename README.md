# India Market Atlas

A research console for India's equity market history, 1947–2025. Six analytical workspaces, all driven by a single typed dataset and a small set of pure derivation primitives.

**Live:** [india-market-atlas.vercel.app](https://india-market-atlas.vercel.app)

## Workspaces

| Slug | Workspace | What it answers |
|------|-----------|-----------------|
| `index` | Index Explorer | What did the equity index do — in nominal ₹, real ₹, USD, or gold terms? Line or candle. |
| `macro` | Macro Lab | How do 16 indicators behave over time, against each other, or correlated as a matrix? |
| `race` | Asset Race | ₹100 in 1979 across equities, gold, USD, FD@policy-rate, inflation. |
| `sip` | SIP Simulator | Every start × end SIP scenario vs lumpsum. CAGR/IRR heatmap. |
| `regimes` | Regimes & Crashes | Policy eras + every drawdown ≥10%, with deep-link into Index Explorer. |
| `projections` | Projection Studio | Live CAGR/inflation sliders extending to 2050. |

URL state is workspace-scoped and shareable — every selection (denomination, year window, indicators, scenario sliders) round-trips through the hash.

Press `⌘K` / `Ctrl+K` for the command palette.

## Architecture

```
src/
├── data/           Inherited static dataset (1947–2025, no runtime fetch)
│   ├── indiaMarketData.ts    Equity index + scenarios
│   ├── macroIndicators.ts    16 indicators
│   └── sensexOHLC.ts          Annual OHLC, 1979+
├── domain/         Pure derivation layer (Series + atlas + provenance)
│   ├── series.ts             cagr, deflate, denominate, drawdown, pearson,
│   │                          correlationMatrix, sipReturns, compoundAtRate
│   ├── atlas.ts              Workspace-facing series composition
│   └── provenance.ts         Source / methodology / caveats registry
├── console/        Research Console UI shell
│   ├── workspaces/           One file per workspace
│   ├── url-state.ts          Workspace-scoped hash routing
│   ├── controls.tsx          Segmented (ARIA toolbar), YearWindow, Slider
│   ├── PlotFigure.tsx        ResizeObserver-driven Observable Plot wrapper
│   ├── CommandPalette.tsx    ⌘K launcher
│   └── Provenance.tsx        Inline source disclosure
├── lib/            csv, format helpers
└── App.tsx         Shell: rail + shared YearWindow + lazy workspace routing
```

**Stack:** React 19 + TypeScript + Vite + Tailwind 4 + Observable Plot.

## Verification

| Layer | Tooling | Count |
|-------|---------|-------|
| Type safety | `tsc --noEmit` | 0 errors |
| Domain unit tests | Vitest | 90 |
| Functional E2E | Playwright | 13 |
| Accessibility E2E | axe-core (WCAG 2.1 AA) | 7 |
| Visual regression | Playwright snapshots | 12 (opt-in via `RUN_VISUAL=1`) |
| CI | GitHub Actions | typecheck + unit + build + E2E on every PR |
| Data freshness | Quarterly cron | auto-issue when sources >2y stale |

## Development

```bash
npm install
npm run dev                   # localhost:5173
npm run build                 # production build
npm test                      # vitest (domain + components)
npx playwright test           # E2E + a11y (visual suite skipped by default)
RUN_VISUAL=1 npx playwright test tests/e2e/visual.spec.ts  # visual regression
node scripts/check-data-freshness.cjs                       # audit dataset
```

## Design principles

1. **Domain layer is pure.** No React, no fetch — just `Series`, `cagr()`, `deflate()`, `pearson()`, etc. 90 unit tests cover the math. Workspaces are thin views over these primitives.
2. **URL-as-truth.** Every analytical state is a hash param. Reload, share, paste — same result.
3. **Provenance over presentation.** Every figure exposes a `<Provenance>` disclosure with sources, methodology, calendar convention, coverage, and caveats. Numbers without their lineage are not trustworthy.
4. **Quant-editorial visual language.** Light-first ink-on-paper, serif display, monospace numerics, ruled surfaces, one signal accent. No glass, no gradients, no motion.
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
