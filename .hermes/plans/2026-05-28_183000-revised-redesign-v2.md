# India Market Atlas — Revised 10/10 Redesign Plan (v2)

## Changes from v1

| Gap | Fix Applied |
|-----|-------------|
| JSON fetch at runtime | Keep data as importable TS modules; Zod validates at build/test time only |
| React Router unnecessary | Dropped; use hash nav + scrollspy (add router only when multi-page exists) |
| Big-bang Phase 4 risk | Extract one feature per commit; App.tsx shrinks incrementally |
| 250-line arbitrary limit | 500-line ceiling; split on responsibility boundaries |
| Test migration unspecified | All data-testid and button labels preserved as hard contract |
| Zustand overkill | Context for theme; local useState for feature state |
| ECharts bundle size | Tree-shake with echarts/core + manual component registration |
| No content quality | Added Phase 8 content/narrative pass |
| Singlefile removal risky | Keep as alternate build target (`build:single`) |
| No ship gates | Defined deploy-after-phase checkpoints |

## Implementation Phases

### Phase 1: Foundation (no behavior change)
- Install: zod (dev-only, for test validation), @radix-ui/react-visually-hidden
- Create src/app/ shell, extract providers
- Extract theme into React Context
- Add ESLint flat config
- Ship gate: app renders identically, all tests pass

### Phase 2: Design System + Lib Extraction
- Extract GradientPanel, SectionHeading, ProgressMetric → src/components/ui/
- Extract formatters → src/lib/format.ts
- Extract CSV utils → src/lib/csv.ts
- Extract chart math → src/lib/chart-utils.ts (rename from charts/)
- Refactor index.css light-mode overrides → proper Tailwind dark: classes
- Ship gate: deploy, cleaner code, same UX

### Phase 3: Feature Decomposition (incremental, one per commit)
- Extract each section into src/features/X/index.tsx
- App.tsx imports and renders features in sequence
- Preserve all data-testid attributes
- Order: overview → insights → data-table → retail → crashes → structure → global-comparison → projector → market-chart (easiest first, hardest last)
- Ship gate: deploy, feature-sliced, same UX

### Phase 4: Market Chart Surgery
- Split InteractiveMarketChart into: Shell, Toolbar, CandlestickPane, LongHorizonPane, SummaryCards
- Co-locate ECharts option builders with their chart pane
- Extract palette as shared module
- Target: no file > 500 lines
- Ship gate: all E2E tests pass unchanged

### Phase 5: Performance + Accessibility
- Tree-shake ECharts (echarts/core + register only needed components)
- React.lazy + Suspense per feature section
- Keep vite-plugin-singlefile as `build:single` target; default build uses chunks
- ARIA landmarks, skip-to-content, focus-visible
- prefers-reduced-motion respect
- Ship gate: Lighthouse > 90, axe-core zero violations

### Phase 6: Data Validation + Testing
- Zod schemas for all data (run in vitest, not runtime)
- Expand unit tests for chart math (coverage > 90% on lib/)
- Component tests per feature
- Expand E2E to cover all sections
- Ship gate: `npm run ci` green with expanded coverage

### Phase 7: Content + Polish
- Rewrite hero copy (user-facing, not developer-facing)
- Add methodology section (data sources, normalized index construction)
- Add legal disclaimer
- Add meta tags, Open Graph
- Loading skeletons, error boundaries per section
- README with architecture docs
- Ship gate: production-ready deploy

## Success Criteria (revised)
1. No file exceeds 500 lines
2. Data validated by Zod at test time
3. Below-fold sections lazy-load
4. Lighthouse > 90 all categories
5. axe-core zero violations
6. Test coverage > 80% on lib/
7. ECharts gzipped < 80KB (tree-shaken)
8. App still buildable as single HTML file
9. All original E2E tests pass unmodified throughout
10. Each phase independently deployable
