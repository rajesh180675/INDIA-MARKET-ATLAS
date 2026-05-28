import { lazy, Suspense, useEffect, useState } from "react";
import { useTheme } from "./app/ThemeContext";
import { Providers } from "./app/providers";
import MotionReveal from "./components/MotionReveal";
import StickyProgress from "./components/StickyProgress";
import ThemeToggle from "./components/ThemeToggle";
import TickerBanner from "./components/TickerBanner";
import SectionErrorBoundary from "./components/SectionErrorBoundary";
import { GradientPanel } from "./components/ui/GradientPanel";
import { continuousIndex, masterTable, tickerStats } from "./data/indiaMarketData";
import OverviewSection from "./features/overview";
import { downloadCsv } from "./lib/csv";
import { cn } from "./utils/cn";

// Lazy-load below-fold sections for faster initial paint
const MarketChartSection = lazy(() => import("./features/market-chart"));
const StructureSection = lazy(() => import("./features/structure"));
const RetailSection = lazy(() => import("./features/retail"));
const GlobalComparisonSection = lazy(() => import("./features/global-comparison"));
const CrashesSection = lazy(() => import("./features/crashes"));
const ProjectorSection = lazy(() => import("./features/projector"));
const InsightsSection = lazy(() => import("./features/insights"));
const DataTableSection = lazy(() => import("./features/data-table"));
const MacroSection = lazy(() => import("./features/macro"));
const RealReturnsSection = lazy(() => import("./features/real-returns"));
const AssetRaceSection = lazy(() => import("./features/asset-race"));
const AnalyticsSection = lazy(() => import("./features/analytics"));
const RiskSection = lazy(() => import("./features/risk"));
const RegimeSection = lazy(() => import("./features/regimes"));
const PurchasingPowerSection = lazy(() => import("./features/purchasing-power"));
const SipSection = lazy(() => import("./features/sip"));
const CandlestickSection = lazy(() => import("./features/candlestick"));

const navItems = [
  { id: "overview", label: "Overview" },
  { id: "chart", label: "Chart" },
  { id: "candlestick", label: "Candlestick" },
  { id: "structure", label: "Structure" },
  { id: "retail", label: "Retail" },
  { id: "world", label: "World" },
  { id: "crashes", label: "Crashes" },
  { id: "projector", label: "2050" },
  { id: "insights", label: "Insights" },
  { id: "macro", label: "Macro" },
  { id: "real-returns", label: "Real Returns" },
  { id: "asset-race", label: "Asset Race" },
  { id: "analytics", label: "Analytics" },
  { id: "risk", label: "Risk" },
  { id: "regimes", label: "Regimes" },
  { id: "purchasing-power", label: "Purchasing Power" },
  { id: "sip", label: "SIP" },
  { id: "data", label: "Data" },
];

function handleDownloadIndexCsv() {
  downloadCsv(
    "india-stock-market-index-1947-2025.csv",
    continuousIndex.map((point) => ({
      year: point.year,
      normalized_index_1947_base_100: point.value,
    })),
  );
}

function handleDownloadMasterCsv() {
  downloadCsv(
    "india-stock-market-master-table.csv",
    masterTable.map((row) => ({
      year: row.year,
      normalized_index: row.normalizedIndex,
      sensex: row.sensex,
      yoy: row.yoy,
      cagr_from_1947: row.cagrFrom1947,
      inr_usd: row.inrUsd,
      event: row.event,
    })),
  );
}

function AppContent() {
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(navItems[0].id);

  useEffect(() => {
    const updateActiveSection = () => {
      let current = navItems[0].id;
      let bestDistance = Number.POSITIVE_INFINITY;

      navItems.forEach((item) => {
        const element = document.getElementById(item.id);
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const withinViewport =
          rect.top <= window.innerHeight * 0.42 && rect.bottom >= 180;
        if (!withinViewport) return;

        const distance = Math.abs(rect.top - 140);
        if (distance < bestDistance) {
          bestDistance = distance;
          current = item.id;
        }
      });

      setActiveSection(current);
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);

    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, []);

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-transparent text-slate-100">
      <a
        href="#overview"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-950 focus:shadow-lg"
      >
        Skip to content
      </a>
      <StickyProgress />

      <div className="pointer-events-none fixed inset-0 -z-10 opacity-70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.16),transparent_30%),radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_24%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.08),rgba(2,6,23,0.5))]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl" role="banner">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 sm:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-300">
              India Market Atlas
            </p>
            <h1 className="text-sm font-medium text-white sm:text-base">
              1947–2025 stock market deep-dive
            </h1>
          </div>

          <nav className="hidden items-center gap-1 xl:flex" aria-label="Page sections">
            {navItems.map((item) => {
              const active = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={cn(
                    "relative rounded-full px-3 py-2 text-sm transition",
                    active ? "text-white" : "text-slate-300 hover:text-white",
                  )}
                >
                  {active ? (
                    <span
                      className="absolute inset-0 rounded-full border border-white/10 bg-white/10 shadow-lg shadow-black/10"
                    />
                  ) : null}
                  <span className="relative z-10">{item.label}</span>
                </a>
              );
            })}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <button
              type="button"
              onClick={handleDownloadIndexCsv}
              className="theme-button inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
            >
              Export CSV
            </button>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-3 text-slate-100 transition hover:bg-white/10 lg:hidden"
            aria-label="Toggle menu"
          >
            <span className="text-lg leading-none">
              {menuOpen ? "×" : "☰"}
            </span>
          </button>
        </div>

        {menuOpen ? (
            <div
              className="overflow-hidden border-t border-white/10 bg-slate-950/95 px-6 py-4 backdrop-blur-xl lg:hidden"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <ThemeToggle theme={theme} onToggle={toggleTheme} />
                  <button
                    type="button"
                    onClick={handleDownloadIndexCsv}
                    className="theme-button inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition hover:bg-white/10"
                  >
                    Export CSV
                  </button>
                </div>
                {navItems.map((item) => {
                  const active = activeSection === item.id;
                  return (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-sm transition",
                        active
                          ? "border-sky-400/25 bg-sky-400/10 text-sky-100"
                          : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                      )}
                    >
                      {item.label}
                    </a>
                  );
                })}
              </div>
            </div>
          ) : null}
      </header>

      <TickerBanner items={tickerStats} />

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-7xl px-6 pb-14 pt-14 sm:px-8 sm:pt-20 lg:pb-20">
          <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
            <div
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-3 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-100">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-300" />
                BSE est. 1875 • Asia's oldest stock exchange
              </div>

              <div className="space-y-6">
                <h2 className="max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  A deeper React experience for the complete history of India's
                  stock market.
                </h2>
                <p className="max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
                  The site now goes beyond a beautiful narrative page: scrollspy
                  navigation, interactive era filtering, downloadable datasets,
                  a real light/dark mode, and framer-motion driven reveals that
                  make the research feel alive.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-sm">
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-emerald-200">
                  ₹100 → ₹1,49,298 nominal
                </span>
                <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sky-200">
                  Era filters + scrollspy navigation
                </span>
                <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-4 py-2 text-violet-200">
                  CSV export + 2050 projector
                </span>
              </div>

              <div className="flex flex-wrap gap-4">
                <a
                  href="#chart"
                  className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
                >
                  Explore the live chart
                </a>
                <a
                  href="#projector"
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Open the 2050 projector
                </a>
                <button
                  type="button"
                  onClick={handleDownloadMasterCsv}
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Download master CSV
                </button>
              </div>
            </div>

            <MotionReveal delay={0.12}>
              <GradientPanel>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                      Forensic takeaway
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">
                      What actually changed?
                    </h3>
                  </div>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                    Policy + participation
                  </span>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                    <p className="text-sm text-slate-400">Then</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      Suppressed, illiquid, policy-heavy
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      The first 32 years were dominated by regulation, wars,
                      inflation, and state hostility to private capital.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                    <p className="text-sm text-slate-400">Now</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      Financialized, retail-backed, globally tracked
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      India's market now benefits from deeper institutions,
                      domestic flows, and broader sector representation.
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-200">
                    New in this version
                  </p>
                  <p className="mt-3 text-base leading-7 text-amber-50">
                    You can now filter the chart by era, jump with active
                    navigation, switch themes, and export key data tables
                    directly from the page.
                  </p>
                </div>
              </GradientPanel>
            </MotionReveal>
          </div>
        </section>

        <SectionErrorBoundary name="overview"><OverviewSection /></SectionErrorBoundary>
        <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-white/5" />}>
          <SectionErrorBoundary name="chart"><MarketChartSection /></SectionErrorBoundary>
          <SectionErrorBoundary name="candlestick"><CandlestickSection /></SectionErrorBoundary>
          <SectionErrorBoundary name="structure"><StructureSection /></SectionErrorBoundary>
          <SectionErrorBoundary name="retail"><RetailSection /></SectionErrorBoundary>
          <SectionErrorBoundary name="global"><GlobalComparisonSection /></SectionErrorBoundary>
          <SectionErrorBoundary name="crashes"><CrashesSection /></SectionErrorBoundary>
          <SectionErrorBoundary name="projector"><ProjectorSection /></SectionErrorBoundary>
          <SectionErrorBoundary name="insights"><InsightsSection /></SectionErrorBoundary>
          <SectionErrorBoundary name="macro"><MacroSection /></SectionErrorBoundary>
          <SectionErrorBoundary name="real-returns"><RealReturnsSection /></SectionErrorBoundary>
          <SectionErrorBoundary name="asset-race"><AssetRaceSection /></SectionErrorBoundary>
          <SectionErrorBoundary name="analytics"><AnalyticsSection /></SectionErrorBoundary>
          <SectionErrorBoundary name="risk"><RiskSection /></SectionErrorBoundary>
          <SectionErrorBoundary name="regimes"><RegimeSection /></SectionErrorBoundary>
          <SectionErrorBoundary name="purchasing-power"><PurchasingPowerSection /></SectionErrorBoundary>
          <SectionErrorBoundary name="sip"><SipSection /></SectionErrorBoundary>
          <SectionErrorBoundary name="data"><DataTableSection /></SectionErrorBoundary>
        </Suspense>

        {/* Final synthesis + footer */}
        <section className="mx-auto max-w-7xl px-6 pb-20 pt-10 sm:px-8">
          <MotionReveal>
            <GradientPanel className="bg-[linear-gradient(135deg,rgba(251,146,60,0.18),rgba(255,255,255,0.08),rgba(16,185,129,0.12))]">
              <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-200">
                    Final synthesis
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    The market rewarded endurance, not comfort.
                  </h2>
                  <p className="mt-5 max-w-3xl text-base leading-8 text-slate-200 sm:text-lg">
                    Across wars, devaluations, scams, sanctions, recessions, and
                    pandemics, Indian equities eventually kept compounding. The
                    investors most likely to fail were the ones who used
                    leverage they could not sustain, concentrated in weak names,
                    or exited permanently after crashes.
                  </p>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-6">
                  <h3 className="text-xl font-semibold text-white">
                    Durable playbook
                  </h3>
                  <ul className="mt-5 space-y-4 text-sm leading-7 text-slate-200">
                    <li>
                      • Buy quality or buy the index — survivorship matters.
                    </li>
                    <li>• Diversify across regimes, not just sectors.</li>
                    <li>
                      • Respect inflation, currency drag, and valuation starting
                      points.
                    </li>
                    <li>
                      • Treat crashes as part of the asset class, not proof that
                      the story ended.
                    </li>
                  </ul>
                </div>
              </div>
            </GradientPanel>
          </MotionReveal>

          <footer className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Built with React, Vite, Tailwind-style utilities, and Framer
              Motion for a Vercel-ready research experience.
            </p>
            <p>
              Note: several pre-1979, SIP, breadth, and comparison values remain
              normalized or rounded analytical approximations.
            </p>
          </footer>
        </section>
      </main>
    </div>
  );
}

function App() {
  return (
    <Providers>
      <AppContent />
    </Providers>
  );
}

export default App;
