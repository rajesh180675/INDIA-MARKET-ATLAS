# India Market Atlas

A professional-grade interactive visualization of India's stock market history — from Independence (1947) to the present day. 17 analytical sections covering macro, real returns, risk, and regime analysis.

**Live:** [india-market-atlas.vercel.app](https://india-market-atlas.vercel.app)

## Sections (17)

| # | Section | What it shows |
|---|---------|---------------|
| 1 | Overview | Key stats, market cap, CAGR summary |
| 2 | Chart | Interactive Sensex 1947–2025 with structural context |
| 3 | Structure | Market evolution, sector composition |
| 4 | Retail | SIP/Demat growth, retail participation |
| 5 | World | India vs USA vs China (base 1990=100) |
| 6 | Crashes | Major drawdowns with recovery timelines |
| 7 | 2050 | Scenario projections (stress/base/bull) |
| 8 | Insights | Key observations and market wisdom |
| 9 | Macro | 16 indicators (USD, Gold, CPI, GDP, Repo, Forex, etc.) |
| 10 | Real Returns | Sensex in USD, Gold, CPI-adjusted terms |
| 11 | Asset Race | ₹100 in 1979 across equities/gold/USD/FD/inflation |
| 12 | Analytics | Correlation matrix + decade-wise multi-denomination returns |
| 13 | Risk | Rolling returns, drawdowns, Sharpe/Sortino ratios |
| 14 | Regimes | GDP×Inflation regime classification + returns |
| 15 | Purchasing Power | Real value table, equity risk premium, market vs GDP |
| 16 | SIP | SIP vs Lumpsum for every start year |
| 17 | Data | Downloadable CSV export |

## Data (1708 lines across 2 modules)

**`src/data/indiaMarketData.ts`** — 905 lines
- Normalized index values (1947–2025, base 100)
- Crash events, market regimes, decade returns
- Rolling windows, SIP/Demat growth, sector evolution
- India vs World comparison, scenario projections

**`src/data/macroIndicators.ts`** — 803 lines, 16 indicators:
- Currency: USD/INR (3.30→85.50)
- Commodities: Gold (₹89→₹97,000/10g), Crude Oil
- Inflation: CPI (annual %)
- Growth: Real GDP, Nominal GDP (₹0.1T→₹350T), Savings Rate
- Monetary: RBI Policy Rate, 10Y G-Sec Yield
- External: Forex Reserves ($0→$650B), Current Account, FII/FPI Flows
- Fiscal: Fiscal Deficit (% of GDP)
- Market: Market Cap/GDP, Sensex P/E
- Demographics: Population (34cr→145cr)

## Key Findings

| Metric | Value | Meaning |
|--------|-------|---------|
| Nominal CAGR | 9.8% | ₹100 → ₹1,49,298 over 78 years |
| USD CAGR | 5.3% | Rupee depreciated 26x (₹3.30→₹85.50) |
| Gold CAGR | 0.4% | Gold nearly matched equities (1090x vs 1493x) |
| Real CAGR | 3.2% | After 7% avg inflation, real growth was modest |
| Equities (1979) | ₹81.6K | ₹100 → ₹81,600 in 46 years (816x) |
| Gold (1979) | ₹10.1K | ₹100 → ₹10,100 (103x) |
| Sharpe Ratio | ~0.15 | Low risk-adjusted returns (high volatility) |

## Architecture

```
src/
├── app/           ThemeContext, Providers
├── components/    UI primitives, charts, error boundaries
├── data/          Static typed data modules (no runtime fetch)
├── features/      17 lazy-loaded feature sections
├── lib/           Utilities (format, csv, echarts)
└── test/          Setup, mocks
```

- **Stack:** React 19 + TypeScript + Vite + Tailwind + ECharts
- **Testing:** 53 tests (Vitest + Playwright E2E)
- **Build:** Code-split (lazy sections) + single-file option (`npm run build:single`)
- **CI:** GitHub Actions (typecheck + unit + E2E on every push)

## Development

```bash
npm install
npm run dev          # localhost:5173
npm run build        # code-split production build
npm run build:single # single HTML file (cross-env SINGLE_FILE=true)
npm run test         # vitest
npm run lint         # eslint
```

## Data Sources

- RBI Handbook of Statistics (exchange rates, policy rates, forex, money supply)
- MOSPI National Accounts (GDP, savings, CPI)
- BSE India (Sensex, P/E ratios, market cap)
- World Bank / IMF WEO (cross-country comparisons)
- SEBI / NSDL (FII/FPI flows, demat accounts)
- PPAC (crude oil — Indian basket)
- Census of India / UN Population Division
- World Gold Council / IBJA (gold prices)

Pre-1979 market data estimated from RBI Share Price Index (no official Sensex before 1986).
