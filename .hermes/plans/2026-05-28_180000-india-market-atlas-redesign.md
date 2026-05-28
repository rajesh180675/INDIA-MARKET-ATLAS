# India Market Atlas — 10/10 Redesign Plan

## Goal

Transform INDIA-MARKET-ATLAS from a monolithic single-page data visualization into a production-grade, extensible financial research platform worthy of institutional-quality presentation. The current codebase works but is architecturally limited: a 1,877-line App.tsx, hardcoded data, no routing, no state management, no API layer, and no path to live data or multi-page expansion.

## Current State Assessment

### What exists (score: 6/10)

| Dimension | Current | Gap |
|-----------|---------|-----|
| Architecture | Single monolithic App.tsx (1877 lines) | No separation of concerns, no routing |
| Data layer | Hardcoded arrays in one 904-line file | No API, no live data, no caching |
| State management | useState scattered across App | No global state, no URL sync |
| Charting | ECharts via echarts-for-react | Good library choice, but chart components are 400-1800 lines each |
| Styling | Tailwind 4 + CSS vars for theming | Solid foundation, but light-mode is CSS override hacks |
| Testing | 1 unit test file + 1 E2E spec | Minimal coverage for a data-heavy app |
| Performance | vite-plugin-singlefile bundles everything | No code splitting, no lazy loading, 80KB+ App.tsx |
| Accessibility | Minimal — no ARIA landmarks, no skip links | Fails basic a11y audit |
| SEO/Meta | None — SPA with no meta tags | Zero discoverability |
| CI/CD | GitHub Actions: typecheck + vitest + playwright | Good but thin |
| Data integrity | Normalized index is a manual reconstruction | No source attribution, no methodology docs |

### What's good (keep)

- Tailwind 4 + CSS custom properties theming (dark/light)
- ECharts for interactive charts (correct library for financial viz)
- Framer Motion for scroll reveals
- The data narrative itself (regimes, crashes, rolling windows, 2050 projector)
- CI pipeline structure
- TypeScript strict mode

### What's broken

1. **App.tsx is a god component** — 1877 lines mixing layout, data transforms, state, event handlers, and 9 sections of UI
2. **No routing** — can't deep-link to sections, can't add pages
3. **Data is hardcoded** — can't update without code changes, can't add new datasets
4. **InteractiveMarketChart.tsx is 1808 lines** — unmaintainable, untestable
5. **No state management** — theme, active section, zoom state, regime selection all tangled in App
6. **No responsive data loading** — entire dataset loads upfront even if user only views one section
7. **Accessibility is poor** — no landmarks, no focus management, no screen reader support
8. **No error boundaries around charts** — one ECharts crash kills the whole page
9. **Light mode is CSS `!important` overrides** — fragile, doesn't scale
10. **No data validation** — if a number is wrong in the hardcoded array, nothing catches it

---

## Proposed Architecture (Target: 10/10)

### Design Principles

1. **Feature-sliced architecture** — each section is a self-contained feature module
2. **Data as configuration** — JSON files in `/data/`, loadable and validatable
3. **URL-driven state** — every view state is shareable via URL
4. **Progressive enhancement** — static content first, interactivity layered on
5. **Accessibility-first** — WCAG 2.1 AA as baseline
6. **Performance budget** — LCP < 1.5s, TTI < 3s, bundle < 200KB gzipped

### Directory Structure (new)

```
src/
├── app/
│   ├── App.tsx              # Shell: layout + router + providers
│   ├── providers.tsx        # Theme, state, error boundary composition
│   └── router.tsx           # Route definitions
├── components/
│   ├── ui/                  # Atomic design system (Button, Card, Badge, Progress)
│   ├── charts/              # Chart primitives (BaseChart, ChartPanel, ChartToolbar)
│   └── layout/              # Header, Footer, Nav, Section, StickyProgress
├── features/
│   ├── overview/            # Key stats section
│   ├── market-chart/        # Interactive candlestick + long-horizon chart
│   ├── structure/           # Regime explorer + sector evolution + breadth
│   ├── retail/              # SIP + demat tracker
│   ├── global-comparison/   # India vs World chart
│   ├── crashes/             # Drawdown map + rolling windows + decade returns
│   ├── projector/           # 2050 scenario simulator
│   ├── insights/            # Ten deep insights grid
│   └── data-table/          # Master table + CSV exports
├── data/
│   ├── schemas/             # Zod schemas for runtime validation
│   ├── loaders/             # Data loading + transformation functions
│   └── static/              # JSON data files (extracted from hardcoded TS)
├── hooks/                   # Shared hooks (useTheme, useScrollSpy, useUrlState)
├── lib/
│   ├── chart-utils.ts       # Pure math functions (SMA, RSI, MACD, drawdown)
│   ├── format.ts            # Number/date/currency formatters
│   ├── csv.ts               # CSV generation utilities
│   └── cn.ts                # Class name utility
├── stores/                  # Zustand stores (theme, navigation, chart state)
└── styles/
    ├── index.css            # Tailwind imports + CSS custom properties
    └── tokens.css           # Design tokens (colors, spacing, typography)
```

### Technology Additions

| Need | Solution | Why |
|------|----------|-----|
| Routing | React Router 7 (or TanStack Router) | URL-driven state, deep linking, future multi-page |
| State management | Zustand | Lightweight, TypeScript-native, no boilerplate |
| Data validation | Zod | Runtime schema validation for data integrity |
| URL state sync | nuqs or custom hook | Shareable chart configurations |
| Code splitting | React.lazy + Suspense | Per-section lazy loading |
| Accessibility | @radix-ui/react primitives | Accessible tabs, dialogs, tooltips |
| Testing | Vitest + Testing Library (expand) | Per-feature unit tests |
| Linting | ESLint flat config + Prettier | Code quality gates |
| Bundle analysis | rollup-plugin-visualizer | Performance monitoring |

### Data Architecture

```
public/data/
├── index.json               # Continuous index 1947-2025
├── regimes.json             # Market regime definitions
├── crashes.json             # Crash events with recovery data
├── breadth.json             # Market breadth timeline
├── global-comparison.json   # India vs USA vs China normalized
├── sip-demat.json           # Retail participation data
├── scenarios.json           # 2050 projection presets
├── master-table.json        # Full reference table
├── insights.json            # Ten insights
└── metadata.json            # Data sources, methodology, last-updated
```

Each JSON file has a corresponding Zod schema. Data loads lazily per-section. A `useDataset(key)` hook handles fetch + cache + validation + error states.

---

## Step-by-Step Implementation Plan

### Phase 1: Foundation (scaffold + routing + state)

| # | Task | Verify |
|---|------|--------|
| 1.1 | Install new deps: zustand, zod, react-router, @radix-ui/react-visually-hidden | `npm ls zustand zod react-router` |
| 1.2 | Create `src/app/` shell with providers composition | `tsc --noEmit` passes |
| 1.3 | Extract theme logic into Zustand store + `useTheme` hook | Theme toggle still works |
| 1.4 | Set up React Router with single "/" route (no behavior change yet) | App renders identically |
| 1.5 | Add ESLint flat config + Prettier | `npm run lint` passes |

### Phase 2: Design System Extraction

| # | Task | Verify |
|---|------|--------|
| 2.1 | Extract `GradientPanel` → `src/components/ui/GradientPanel.tsx` | Import works from App |
| 2.2 | Extract `SectionHeading` → `src/components/ui/SectionHeading.tsx` | Same |
| 2.3 | Extract `ProgressMetric` → `src/components/ui/ProgressMetric.tsx` | Same |
| 2.4 | Extract `AnimatedCounter` (already separate, just move) | Same |
| 2.5 | Create `Button`, `Badge`, `Card` atomic components from repeated patterns | Storybook-like visual check |
| 2.6 | Refactor `index.css` — replace `!important` overrides with proper Tailwind dark: classes | Light mode renders correctly |
| 2.7 | Add design tokens file (`tokens.css`) for consistent spacing/color | No visual regression |

### Phase 3: Data Layer

| # | Task | Verify |
|---|------|--------|
| 3.1 | Extract all data from `indiaMarketData.ts` into JSON files under `public/data/` | JSON files parse correctly |
| 3.2 | Write Zod schemas for each dataset | `zod.parse()` succeeds on all files |
| 3.3 | Create `useDataset(key)` hook with fetch + cache + validation | Hook returns typed data |
| 3.4 | Create `src/data/loaders/` with transform functions (buildMonthlyCandles etc.) | Unit tests pass |
| 3.5 | Add `metadata.json` with source attribution and methodology notes | File exists and validates |

### Phase 4: Feature Decomposition (the big refactor)

| # | Task | Verify |
|---|------|--------|
| 4.1 | Extract Overview section → `src/features/overview/` | Section renders in isolation |
| 4.2 | Extract Market Chart → `src/features/market-chart/` (split InteractiveMarketChart into sub-components: Toolbar, CandlestickPane, LongHorizonPane, ComparePane) | Chart interactions work |
| 4.3 | Extract Structure section → `src/features/structure/` (RegimeExplorer, SectorTimeline, BreadthTimeline) | Regime switching works |
| 4.4 | Extract Retail section → `src/features/retail/` | Slider + year buttons work |
| 4.5 | Extract Global Comparison → `src/features/global-comparison/` | Chart zoom/pan works |
| 4.6 | Extract Crashes section → `src/features/crashes/` (DrawdownMap, RollingWindows, DecadeReturns) | All sub-panels render |
| 4.7 | Extract Projector → `src/features/projector/` (ScenarioTable, CustomSimulator) | Sliders + presets work |
| 4.8 | Extract Insights → `src/features/insights/` | Grid renders |
| 4.9 | Extract Data Table → `src/features/data-table/` (MasterTable, DownloadCenter) | CSV downloads work |
| 4.10 | Rewrite App.tsx as thin shell: providers + router + lazy-loaded sections | Full page renders, < 100 lines |

### Phase 5: InteractiveMarketChart Surgery

This is the hardest single file (1808 lines). Decompose into:

| # | Sub-component | Lines (est.) | Responsibility |
|---|---------------|-------------|----------------|
| 5.1 | `ChartShell.tsx` | ~80 | Container, fullscreen, export button |
| 5.2 | `ChartToolbar.tsx` | ~120 | Mode tabs, range buttons, timeframe, toggles |
| 5.3 | `CandlestickChart.tsx` | ~250 | Technical mode ECharts config |
| 5.4 | `LongHorizonChart.tsx` | ~200 | Annual context mode ECharts config |
| 5.5 | `CompareOverlay.tsx` | ~100 | Compare-range logic |
| 5.6 | `ChartSummaryCards.tsx` | ~80 | CAGR, total move, drawdown cards |
| 5.7 | `useChartState.ts` | ~60 | Zustand slice for zoom, mode, toggles |
| 5.8 | `useChartOptions.ts` | ~200 | ECharts option builders (memoized) |
| 5.9 | `chartPalette.ts` | ~50 | Theme-aware color palette |

Verify: All existing E2E tests pass without modification.

### Phase 6: Accessibility + Performance

| # | Task | Verify |
|---|------|--------|
| 6.1 | Add ARIA landmarks (`<main>`, `<nav>`, `<section aria-labelledby>`) | axe-core audit passes |
| 6.2 | Add skip-to-content link | Keyboard navigation works |
| 6.3 | Add `aria-label` to all icon buttons | Screen reader announces correctly |
| 6.4 | Add focus-visible styles to all interactive elements | Tab navigation visible |
| 6.5 | Wrap each feature section in `React.lazy` + `Suspense` | Bundle splits per section |
| 6.6 | Add `loading="lazy"` to below-fold chart containers | LCP improves |
| 6.7 | Remove `vite-plugin-singlefile` (it defeats code splitting) | Multiple chunks in build |
| 6.8 | Add `<meta>` tags, Open Graph, structured data | Social sharing works |
| 6.9 | Add `prefers-reduced-motion` respect to all animations | Motion-reduced mode works |

### Phase 7: Testing Expansion

| # | Task | Verify |
|---|------|--------|
| 7.1 | Unit tests for each Zod schema (invalid data → clear errors) | `vitest run` |
| 7.2 | Unit tests for chart math utils (already partial, expand) | Coverage > 90% on lib/ |
| 7.3 | Component tests for each feature section (render + key interactions) | All pass |
| 7.4 | E2E: expand to cover all sections, CSV download, theme persistence | Playwright passes |
| 7.5 | Visual regression baseline (optional: Playwright screenshots) | Baseline captured |
| 7.6 | Add `npm run test:coverage` script | Coverage report generates |

### Phase 8: Polish + Production Readiness

| # | Task | Verify |
|---|------|--------|
| 8.1 | Add proper 404 page (for future routing) | Route renders |
| 8.2 | Add loading skeletons for lazy-loaded sections | No layout shift |
| 8.3 | Add error boundaries per-section (chart crash doesn't kill page) | Simulated error contained |
| 8.4 | Add PWA manifest + service worker for offline access | Lighthouse PWA score |
| 8.5 | Add changelog / version display in footer | Version visible |
| 8.6 | Performance audit: Lighthouse > 95 on all categories | Lighthouse report |
| 8.7 | Bundle size audit: < 200KB gzipped total | `npm run build` + size check |
| 8.8 | Update README with architecture docs, data methodology, contribution guide | README complete |

---

## Files Likely to Change

**New files (~45):**
- `src/app/App.tsx`, `providers.tsx`, `router.tsx`
- `src/stores/theme.ts`, `navigation.ts`, `chart.ts`
- `src/hooks/useTheme.ts`, `useScrollSpy.ts`, `useUrlState.ts`, `useDataset.ts`
- `src/components/ui/` (6-8 atomic components)
- `src/components/layout/` (Header, Footer, Nav, Section)
- `src/features/*/index.tsx` (9 feature modules)
- `src/features/market-chart/` sub-components (8 files)
- `src/data/schemas/*.ts` (9 schema files)
- `src/data/loaders/*.ts` (transform functions)
- `public/data/*.json` (9 data files + metadata)
- `src/lib/format.ts`, `csv.ts`
- Test files per feature

**Modified files:**
- `package.json` (new deps)
- `vite.config.ts` (remove singlefile plugin, add chunk splitting)
- `tsconfig.json` (path aliases update)
- `index.html` (meta tags, structured data)
- `src/index.css` (refactored theming)
- `.github/workflows/ci.yml` (add lint step)

**Deleted files:**
- `src/App.tsx` (replaced by `src/app/App.tsx`)
- `src/data/indiaMarketData.ts` (replaced by JSON + schemas)
- `src/components/InteractiveMarketChart.tsx` (decomposed into 8 files)

---

## Risks and Tradeoffs

| Risk | Mitigation |
|------|-----------|
| Regression during decomposition | Keep E2E tests green at every phase boundary |
| Bundle size increase from new deps | Zustand is 1KB, Zod tree-shakes, Router is ~12KB — net neutral after code splitting |
| Data migration errors | Zod schemas catch any shape mismatch at build time |
| ECharts config complexity during split | Extract option builders as pure functions, unit test them |
| `vite-plugin-singlefile` removal breaks deployment | Verify Vercel config handles multi-chunk output (it does by default) |
| Over-engineering for a static site | Each phase is independently shippable; stop at any phase and the app is better than before |

## Open Questions

1. **Live data**: Should the platform eventually pull from an API (e.g., BSE/NSE feeds for current Sensex)? This would change the data layer from static JSON to a hybrid static+live model.
2. **Multi-page**: Should regimes, crashes, or the projector become standalone pages with their own URLs? Or keep the single-page scroll experience?
3. **Internationalization**: Is Hindi/regional language support needed?
4. **Authentication**: Any gated content planned (premium projections, custom portfolios)?
5. **Mobile app**: Is a React Native or PWA-first mobile experience on the roadmap?

---

## Iteration Log

| # | Change | Reason |
|---|--------|--------|
| v1 | Initial plan drafted | Full codebase read complete |
| v2 | Added Phase 5 (InteractiveMarketChart surgery) as separate phase | 1808-line file needs dedicated decomposition strategy |
| v3 | Removed Next.js migration (considered, rejected) | Vite + React Router is simpler, avoids SSR complexity for a static data site, keeps deployment on Vercel trivial |
| v4 | Added `vite-plugin-singlefile` removal rationale | It actively prevents code splitting which is critical for performance |
| v5 | Validated: Zustand + Zod + React Router are all ESM-compatible with Vite 7 | No bundler conflicts expected |

---

## Success Criteria

The redesign is 10/10 when:

1. No file exceeds 250 lines
2. Every data point is schema-validated
3. Every section lazy-loads independently
4. Lighthouse scores > 95 across all categories
5. axe-core reports zero violations
6. Test coverage > 80% on business logic
7. A new dataset can be added by dropping a JSON file + schema (no App.tsx edits)
8. Chart state is URL-shareable
9. The app works offline (PWA)
10. A developer unfamiliar with the codebase can understand the architecture in < 5 minutes from the directory structure alone
