# India Market Atlas

A professional-grade interactive visualization of India's stock market history — from Independence (1947) to the present day.

**Live:** [india-market-atlas.vercel.app](https://india-market-atlas.vercel.app)

## What it shows

- **78-year continuous index** (BSE Sensex, normalized to 1947 = 100)
- **Candlestick desk** with expand-to-window viewing and structural context mode
- **Market regimes** — five distinct eras with CAGR, risk, and lessons
- **Crash anatomy** — every major drawdown with depth, duration, and recovery
- **India vs World** — Sensex vs S&P 500 vs Shanghai Composite (base 1990)
- **Retail revolution** — SIP flows, demat growth, financialization metrics
- **2050 projector** — scenario analysis from stress to euphoria
- **Full data table** with CSV export

## Architecture

```
src/
├── app/              # Providers, ThemeContext
├── components/       # InteractiveMarketChart, ComparisonChart, UI primitives
│   ├── charts/       # ChartToolbar, ChartSummaryCards, CompareOverlay
│   └── ui/           # GradientPanel, SectionHeading, ProgressMetric
├── data/             # indiaMarketData.ts (all data as typed TS modules)
├── features/         # Feature-sliced sections (lazy-loaded)
│   ├── overview/
│   ├── market-chart/
│   ├── structure/
│   ├── retail/
│   ├── global-comparison/
│   ├── crashes/
│   ├── projector/
│   ├── insights/
│   └── data-table/
├── hooks/            # useDocumentTheme
├── lib/              # echarts, format, csv utilities
└── utils/            # cn (classname merge)
```

**Stack:** React 19 + TypeScript + Vite + Tailwind CSS 4 + ECharts 6 + Framer Motion 12

**Design decisions:**
- No React Router — hash nav + scrollspy (single-page app)
- No state management library — Context for theme, local state for features
- Data as importable TS modules — no runtime fetch, validated by Zod at test time
- Code-split by default, single-file build available via `npm run build:single`

## Development

```bash
npm install
npm run dev          # Vite dev server on :5173
npm run build        # Production build (code-split)
npm run build:single # Single HTML file distribution
npm run ci           # Typecheck + unit tests + E2E
```

## Testing

```bash
npm run test:unit    # 41 tests (Vitest + jsdom)
npm run test:e2e     # Playwright E2E (chromium)
npm run typecheck    # tsc --noEmit
```

## Data sources

- **1979–2025:** BSE Sensex year-end closing values (BSE India, verified against Wikipedia/financial databases)
- **1947–1978:** Estimated from RBI Share Price Index and L.C. Gupta academic research
- **Normalization:** Base 1947 = 100, Sensex values × 1.827 scaling factor
- **SIP/Demat:** AMFI monthly reports, CDSL/NSDL disclosures
- **Global comparison:** S&P 500 (total return), Shanghai Composite (price)

## License

MIT
