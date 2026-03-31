import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import AnimatedCounter from "./components/AnimatedCounter";
import ComparisonChart from "./components/ComparisonChart";
import InteractiveMarketChart from "./components/InteractiveMarketChart";
import MotionReveal from "./components/MotionReveal";
import StickyProgress from "./components/StickyProgress";
import ThemeToggle from "./components/ThemeToggle";
import TickerBanner from "./components/TickerBanner";
import {
  continuousIndex,
  crashEvents,
  decadeReturns,
  indiaVsWorld,
  insights,
  keyStats,
  marketBreadth,
  marketRegimes,
  masterTable,
  milestones,
  rollingWindows,
  scenario2050,
  sectorEvolution,
  sipDematGrowth,
  tickerStats,
  yearAnnotations,
} from "./data/indiaMarketData";
import { cn } from "./utils/cn";

type Theme = "dark" | "light";

const navItems = [
  { id: "overview", label: "Overview" },
  { id: "chart", label: "Chart" },
  { id: "structure", label: "Structure" },
  { id: "retail", label: "Retail" },
  { id: "world", label: "World" },
  { id: "crashes", label: "Crashes" },
  { id: "projector", label: "2050" },
  { id: "insights", label: "Insights" },
  { id: "data", label: "Data" },
];

const regimeToneClasses = {
  red: {
    badge: "border-rose-400/20 bg-rose-400/10 text-rose-200",
    ring: "from-rose-500/30 via-orange-500/10 to-transparent",
    accent: "bg-rose-400",
  },
  amber: {
    badge: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    ring: "from-amber-500/30 via-yellow-500/10 to-transparent",
    accent: "bg-amber-400",
  },
  blue: {
    badge: "border-sky-400/20 bg-sky-400/10 text-sky-200",
    ring: "from-sky-500/30 via-cyan-500/10 to-transparent",
    accent: "bg-sky-400",
  },
  emerald: {
    badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    ring: "from-emerald-500/30 via-lime-500/10 to-transparent",
    accent: "bg-emerald-400",
  },
  violet: {
    badge: "border-violet-400/20 bg-violet-400/10 text-violet-200",
    ring: "from-violet-500/30 via-fuchsia-500/10 to-transparent",
    accent: "bg-violet-400",
  },
} as const;

const scenarioToneClasses = {
  amber: "border-amber-400/20 bg-amber-400/10 text-amber-100",
  sky: "border-sky-400/20 bg-sky-400/10 text-sky-100",
  emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
  violet: "border-violet-400/20 bg-violet-400/10 text-violet-100",
} as const;

function formatNumber(value: number | string | null | undefined, decimals = 0) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return "—";
  }

  return numericValue.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "dark";
  }

  try {
    const stored = window.localStorage.getItem("india-market-theme");
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch {
    return "dark";
  }

  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function convertToCsv(rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const escape = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`;

  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escape(row[header] ?? "")).join(","),
    ),
  ].join("\n");
}

function downloadCsv(
  filename: string,
  rows: Array<Record<string, string | number>>,
) {
  if (typeof window === "undefined") {
    return;
  }

  const csv = convertToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-300">
        {eyebrow}
      </p>
      <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      <p className="text-base leading-7 text-slate-300 sm:text-lg">
        {subtitle}
      </p>
    </div>
  );
}

function GradientPanel({
  children,
  className = "",
  innerClassName = "",
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[32px] bg-[linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.04),rgba(255,255,255,0.08))] p-px",
        className,
      )}
    >
      <div
        className={cn("glass-card rounded-[32px] p-6 sm:p-7", innerClassName)}
      >
        {children}
      </div>
    </div>
  );
}

function ProgressMetric({
  label,
  value,
  max,
  tone,
  description,
}: {
  label: string;
  value: string;
  max: number;
  tone: "emerald" | "sky" | "amber" | "rose" | "violet";
  description: string;
}) {
  const toneClasses = {
    emerald: "from-emerald-400 to-lime-300",
    sky: "from-sky-400 to-cyan-300",
    amber: "from-amber-400 to-orange-300",
    rose: "from-rose-400 to-orange-300",
    violet: "from-violet-400 to-fuchsia-300",
  } as const;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs text-slate-400">{description}</p>
        </div>
        <p className="text-sm font-semibold text-slate-200">{value}</p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-900/80 ring-1 ring-white/5">
        <div
          className={cn(
            "progress-fill h-full rounded-full bg-gradient-to-r",
            toneClasses[tone],
          )}
          style={{ width: `${clampPercent(max)}%` }}
        />
      </div>
    </div>
  );
}

function App() {
  const fallbackRegime = marketRegimes[0] ?? {
    id: "fallback",
    name: "Market regime",
    years: "1947–2025",
    driver: "Data unavailable",
    returns: "N/A",
    risk: "N/A",
    lesson: "N/A",
    summary: "Regime data unavailable.",
    tone: "blue" as const,
  };
  const fallbackSipPoint = sipDematGrowth[0] ?? {
    year: 2025,
    dematCrore: 0,
    sipMonthlyCr: 0,
    annualSipCr: 0,
  };
  const fallbackWorldFinal = indiaVsWorld[indiaVsWorld.length - 1] ?? {
    year: 2025,
    india: 100,
    usa: 100,
    china: 100,
  };

  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(navItems[0].id);
  const [activeRegime, setActiveRegime] = useState(
    marketRegimes[4]?.id ?? fallbackRegime.id,
  );
  const [selectedSipYear, setSelectedSipYear] = useState(
    sipDematGrowth[sipDematGrowth.length - 1]?.year ?? fallbackSipPoint.year,
  );
  const [projectionCagr, setProjectionCagr] = useState(10.1);
  const [projectionInflation, setProjectionInflation] = useState(5);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;

    try {
      window.localStorage.setItem("india-market-theme", theme);
    } catch {
      // Ignore storage failures and keep the theme in memory.
    }
  }, [theme]);

  useEffect(() => {
    const updateActiveSection = () => {
      let current = navItems[0].id;
      let bestDistance = Number.POSITIVE_INFINITY;

      navItems.forEach((item) => {
        const element = document.getElementById(item.id);
        if (!element) {
          return;
        }

        const rect = element.getBoundingClientRect();
        const withinViewport =
          rect.top <= window.innerHeight * 0.42 && rect.bottom >= 180;
        if (!withinViewport) {
          return;
        }

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

  const selectedRegime =
    marketRegimes.find((regime) => regime.id === activeRegime) ??
    fallbackRegime;
  const selectedRegimeTone = regimeToneClasses[selectedRegime.tone];
  const selectedSipPoint =
    sipDematGrowth.find((point) => point.year === selectedSipYear) ??
    fallbackSipPoint;

  const worldFinal = fallbackWorldFinal;
  const maxDemat = Math.max(
    ...sipDematGrowth.map((point) => point.dematCrore),
    1,
  );
  const maxSip = Math.max(
    ...sipDematGrowth.map((point) => point.sipMonthlyCr),
    1,
  );
  const maxCrash = Math.max(
    ...crashEvents.map((event) => Math.abs(event.decline)),
    1,
  );

  const medianRecovery = useMemo(() => {
    const recoveries = crashEvents
      .map((crash) => crash.monthsToRecover)
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);

    const middle = Math.floor(recoveries.length / 2);
    if (recoveries.length % 2 === 0) {
      return (recoveries[middle - 1] + recoveries[middle]) / 2;
    }

    return recoveries[middle];
  }, []);

  const projectionYears = 25;
  const projectedSensex2050 = Math.round(
    80000 * Math.pow(1 + projectionCagr / 100, projectionYears),
  );
  const realCagr =
    ((1 + projectionCagr / 100) / (1 + projectionInflation / 100) - 1) * 100;
  const realMultiple = Math.pow(1 + realCagr / 100, projectionYears);
  const projectedRealValue = Math.round(80000 * realMultiple);

  const growthCards = [
    {
      label: "India",
      value: `${(worldFinal.india / 100).toFixed(1)}x`,
      note: "1990 to 2025 normalized growth in local currency terms.",
      tone: "emerald",
    },
    {
      label: "USA",
      value: `${(worldFinal.usa / 100).toFixed(1)}x`,
      note: "The S&P 500 remained powerful, but India still outran it in local-currency terms.",
      tone: "sky",
    },
    {
      label: "China",
      value: `${(worldFinal.china / 100).toFixed(1)}x`,
      note: "China’s path was explosive, but India’s late-period compounding has been more structurally durable.",
      tone: "violet",
    },
  ] as const;

  const handleDownloadIndexCsv = () =>
    downloadCsv(
      "india-stock-market-index-1947-2025.csv",
      continuousIndex.map((point) => ({
        year: point.year,
        normalized_index_1947_base_100: point.value,
      })),
    );

  const handleDownloadMasterCsv = () =>
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

  const handleDownloadRetailCsv = () =>
    downloadCsv(
      "india-retail-participation-sip-demat.csv",
      sipDematGrowth.map((row) => ({
        year: row.year,
        demat_crore: row.dematCrore,
        sip_monthly_crore: row.sipMonthlyCr,
        annual_sip_crore: row.annualSipCr,
      })),
    );

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-transparent text-slate-100">
      <StickyProgress />

      <div className="pointer-events-none fixed inset-0 -z-10 opacity-70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.16),transparent_30%),radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_24%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,6,23,0.08),rgba(2,6,23,0.5))]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 sm:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-300">
              India Market Atlas
            </p>
            <h1 className="text-sm font-medium text-white sm:text-base">
              1947–2025 stock market deep-dive
            </h1>
          </div>

          <nav className="hidden items-center gap-1 xl:flex">
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
                    <motion.span
                      layoutId="active-nav-pill"
                      className="absolute inset-0 rounded-full border border-white/10 bg-white/10 shadow-lg shadow-black/10"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 34,
                      }}
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
            <ThemeToggle
              theme={theme}
              onToggle={() =>
                setTheme((current) => (current === "dark" ? "light" : "dark"))
              }
            />
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

        <AnimatePresence initial={false}>
          {menuOpen ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden border-t border-white/10 bg-slate-950/95 px-6 py-4 backdrop-blur-xl lg:hidden"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <ThemeToggle
                    theme={theme}
                    onToggle={() =>
                      setTheme((current) =>
                        current === "dark" ? "light" : "dark",
                      )
                    }
                  />
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
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>

      <TickerBanner items={tickerStats} />

      <main className="relative z-10">
        <section className="mx-auto max-w-7xl px-6 pb-14 pt-14 sm:px-8 sm:pt-20 lg:pb-20">
          <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-3 rounded-full border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-100">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-300" />
                BSE est. 1875 • Asia’s oldest stock exchange
              </div>

              <div className="space-y-6">
                <h2 className="max-w-5xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  A deeper React experience for the complete history of India’s
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
                  ₹100 → ₹1,53,600 nominal
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
            </motion.div>

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
                      India’s market now benefits from deeper institutions,
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

        <section
          id="overview"
          className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-14"
        >
          <MotionReveal>
            <SectionHeading
              eyebrow="Overview"
              title="Animated stats for the entire 78-year record"
              subtitle="These headline metrics animate into view and frame the whole analysis: regime change, real returns, financialization, and the post-1979 acceleration that transformed Indian equities."
            />
          </MotionReveal>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {keyStats.map((stat, index) => (
              <MotionReveal key={stat.label} delay={index * 0.04}>
                <GradientPanel innerClassName="h-full">
                  <p className="text-sm font-medium text-slate-400">
                    {stat.label}
                  </p>
                  <AnimatedCounter
                    value={stat.value}
                    prefix={stat.prefix}
                    suffix={stat.suffix}
                    decimals={stat.decimals ?? 0}
                    className="mt-4 block text-4xl font-semibold tracking-tight text-white"
                  />
                  <p className="mt-4 text-sm leading-6 text-slate-300">
                    {stat.note}
                  </p>
                </GradientPanel>
              </MotionReveal>
            ))}
          </div>
        </section>

        <section
          id="chart"
          className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-14"
        >
          <MotionReveal>
            <SectionHeading
              eyebrow="Interactive chart"
              title="A truthful long-horizon chart with native pan and zoom, plus an optional technical lens"
              subtitle="The core visual now opens in an honest full-history mode that fits the complete 1947–2025 dataset on screen, then lets you zoom into regimes with native gestures. A separate technical reconstruction mode still exists for users who want market-style overlays without confusing reconstructed data for real traded monthly bars."
            />
          </MotionReveal>

          <div className="mt-10 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <MotionReveal>
              <GradientPanel>
                <InteractiveMarketChart
                  data={continuousIndex}
                  milestones={milestones}
                  crashEvents={crashEvents}
                  regimes={marketRegimes}
                  annotations={yearAnnotations}
                />
              </GradientPanel>
            </MotionReveal>

            <div className="space-y-6">
              <MotionReveal delay={0.05}>
                <GradientPanel>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Chart reading guide
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold text-white">
                    Why this version reads better
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-slate-300">
                    The chart no longer asks you to horizontally scroll through
                    an over-wide SVG to understand the story. You can start with
                    the whole history, zoom with intent, pan naturally, and only
                    switch into the technical reconstruction when you actually
                    want that lens.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleDownloadIndexCsv}
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                    >
                      Download index CSV
                    </button>
                    <a
                      href="#data"
                      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                    >
                      Jump to reference table
                    </a>
                  </div>
                </GradientPanel>
              </MotionReveal>

              <MotionReveal delay={0.1}>
                <GradientPanel>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Visual thesis
                  </p>
                  <div className="mt-4 space-y-4">
                    <ProgressMetric
                      label="Whole-history clarity"
                      value="Restored"
                      max={95}
                      tone="sky"
                      description="You can now see the entire 78-year range immediately, then zoom into any era without losing context."
                    />
                    <ProgressMetric
                      label="Interaction quality"
                      value="Native"
                      max={90}
                      tone="emerald"
                      description="Drag, wheel, and touch interactions now do the real work instead of button-based panning."
                    />
                    <ProgressMetric
                      label="Analytical honesty"
                      value="Higher"
                      max={82}
                      tone="amber"
                      description="The long-horizon view prioritizes the annual source data, while the technical mode is clearly labeled as reconstructed."
                    />
                  </div>
                </GradientPanel>
              </MotionReveal>
            </div>
          </div>
        </section>

        <section
          id="structure"
          className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-14"
        >
          <MotionReveal>
            <SectionHeading
              eyebrow="Structure"
              title="Regime explorer, sector evolution, and market breadth on one canvas"
              subtitle="This section surfaces the deeper market structure behind price: what led each era, what risks dominated it, and how India’s market breadth evolved from a tightly controlled niche to a mass-owned system."
            />
          </MotionReveal>

          <div className="mt-10 grid gap-8 xl:grid-cols-[0.75fr_1.25fr]">
            <div className="space-y-3">
              {marketRegimes.map((regime, index) => {
                const tone = regimeToneClasses[regime.tone];
                const active = regime.id === selectedRegime.id;

                return (
                  <MotionReveal key={regime.id} delay={index * 0.04}>
                    <button
                      type="button"
                      onClick={() => setActiveRegime(regime.id)}
                      className={cn(
                        "w-full rounded-[28px] border p-5 text-left transition",
                        active
                          ? "border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.1),transparent_60%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] shadow-2xl shadow-black/20"
                          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10",
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                            {regime.years}
                          </p>
                          <h3 className="mt-2 text-lg font-semibold text-white">
                            {regime.name}
                          </h3>
                        </div>
                        <span
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium",
                            tone.badge,
                          )}
                        >
                          {regime.returns}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        {regime.summary}
                      </p>
                      <div
                        className={cn(
                          "mt-4 h-1.5 rounded-full bg-white/5",
                          active && `bg-gradient-to-r ${tone.ring}`,
                        )}
                      >
                        <div
                          className={cn(
                            "h-full rounded-full",
                            tone.accent,
                            active ? "w-full" : "w-0",
                          )}
                        />
                      </div>
                    </button>
                  </MotionReveal>
                );
              })}
            </div>

            <div className="space-y-6">
              <MotionReveal>
                <GradientPanel>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-3xl font-semibold tracking-tight text-white">
                      {selectedRegime.name}
                    </h3>
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium",
                        selectedRegimeTone.badge,
                      )}
                    >
                      {selectedRegime.years}
                    </span>
                  </div>
                  <p className="mt-4 text-base leading-7 text-slate-200">
                    {selectedRegime.summary}
                  </p>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
                      <p className="text-sm text-slate-400">Primary driver</p>
                      <p className="mt-3 text-sm leading-7 text-white">
                        {selectedRegime.driver}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
                      <p className="text-sm text-slate-400">Dominant risk</p>
                      <p className="mt-3 text-sm leading-7 text-white">
                        {selectedRegime.risk}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 md:col-span-2">
                      <p className="text-sm text-slate-400">Investor lesson</p>
                      <p className="mt-3 text-sm leading-7 text-white">
                        {selectedRegime.lesson}
                      </p>
                    </div>
                  </div>
                </GradientPanel>
              </MotionReveal>

              <div className="grid gap-5 xl:grid-cols-2">
                <MotionReveal delay={0.05}>
                  <GradientPanel>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                      Sector evolution
                    </p>
                    <div className="mt-5 space-y-4">
                      {sectorEvolution.map((snapshot) => (
                        <div
                          key={snapshot.year}
                          className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                                {snapshot.era}
                              </p>
                              <h4 className="mt-1 text-lg font-semibold text-white">
                                {snapshot.year}
                              </h4>
                            </div>
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                              {snapshot.dominant}
                            </span>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {snapshot.challengers.map((challenger) => (
                              <span
                                key={challenger}
                                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                              >
                                {challenger}
                              </span>
                            ))}
                          </div>
                          <p className="mt-4 text-sm leading-6 text-slate-300">
                            {snapshot.note}
                          </p>
                          <p className="mt-2 text-xs leading-6 text-slate-400">
                            {snapshot.breadthSignal}
                          </p>
                        </div>
                      ))}
                    </div>
                  </GradientPanel>
                </MotionReveal>

                <MotionReveal delay={0.1}>
                  <GradientPanel>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                      Market breadth timeline
                    </p>
                    <div className="mt-5 space-y-4">
                      {marketBreadth.map((point) => (
                        <div
                          key={point.year}
                          className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h4 className="text-lg font-semibold text-white">
                                {point.year}
                              </h4>
                              <p className="mt-2 text-sm leading-6 text-slate-300">
                                {point.note}
                              </p>
                            </div>
                            <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs text-sky-200">
                              MCap/GDP {point.marketCapToGdp}%
                            </span>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-300">
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                              ₹{formatNumber(point.marketCapLakhCr)}L Cr MCap
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                              {formatNumber(point.listedCompaniesK, 1)}K listed
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                              {formatNumber(point.dematCrore, 1)} Cr demat
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                              ₹{formatNumber(point.dailyTurnoverCr)} Cr turnover
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GradientPanel>
                </MotionReveal>
              </div>
            </div>
          </div>
        </section>

        <section
          id="retail"
          className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-14"
        >
          <MotionReveal>
            <SectionHeading
              eyebrow="Retail engine"
              title="SIP and demat growth tracker"
              subtitle="This remains one of the biggest structural upgrades on the site: a dedicated section for the household-participation wave that changed the market’s resilience after 2020."
            />
          </MotionReveal>

          <div className="mt-10 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <MotionReveal>
              <GradientPanel>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                      Interactive retail tracker
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">
                      Select a year from 2016 to 2025
                    </h3>
                  </div>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                    Selected: {selectedSipPoint.year}
                  </span>
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/55 p-5">
                  <input
                    type="range"
                    min={sipDematGrowth[0]?.year}
                    max={sipDematGrowth[sipDematGrowth.length - 1]?.year}
                    step={1}
                    value={selectedSipYear}
                    onChange={(event) =>
                      setSelectedSipYear(Number(event.target.value))
                    }
                    className="w-full"
                  />

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-slate-400">Demat accounts</p>
                      <AnimatedCounter
                        value={selectedSipPoint.dematCrore}
                        suffix=" Cr"
                        decimals={1}
                        className="mt-2 block text-4xl font-semibold tracking-tight text-white"
                      />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Monthly SIP flow</p>
                      <AnimatedCounter
                        value={selectedSipPoint.sipMonthlyCr}
                        prefix="₹"
                        suffix=" Cr"
                        className="mt-2 block text-4xl font-semibold tracking-tight text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <ProgressMetric
                    label="Demat penetration"
                    value={`${formatNumber(selectedSipPoint.dematCrore, 1)} Cr`}
                    max={(selectedSipPoint.dematCrore / maxDemat) * 100}
                    tone="emerald"
                    description="Accounts expanded from niche ownership to mass participation in under a decade."
                  />
                  <ProgressMetric
                    label="Monthly SIP engine"
                    value={`₹${formatNumber(selectedSipPoint.sipMonthlyCr)} Cr`}
                    max={(selectedSipPoint.sipMonthlyCr / maxSip) * 100}
                    tone="sky"
                    description="Steady SIP flows now create a structural domestic bid that earlier cycles lacked."
                  />
                  <ProgressMetric
                    label="Annualized SIP pace"
                    value={`₹${formatNumber(selectedSipPoint.annualSipCr)} Cr`}
                    max={(selectedSipPoint.annualSipCr / (maxSip * 12)) * 100}
                    tone="violet"
                    description="This is the savings conveyor belt that changed how corrections behave."
                  />
                </div>
              </GradientPanel>
            </MotionReveal>

            <MotionReveal delay={0.08}>
              <GradientPanel>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                      Retail surge timeline
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">
                      Domestic flows became structural
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadRetailCsv}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                  >
                    Download retail CSV
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {sipDematGrowth.map((point) => {
                    const active = point.year === selectedSipPoint.year;
                    return (
                      <button
                        key={point.year}
                        type="button"
                        onClick={() => setSelectedSipYear(point.year)}
                        className={cn(
                          "rounded-2xl border p-4 text-left transition",
                          active
                            ? "border-emerald-400/30 bg-emerald-400/10 shadow-lg shadow-emerald-950/25"
                            : "border-white/10 bg-white/5 hover:bg-white/10",
                        )}
                      >
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                          {point.year}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {formatNumber(point.dematCrore, 1)} Cr
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Demat accounts
                        </p>
                        <p className="mt-3 text-sm font-medium text-sky-200">
                          ₹{formatNumber(point.sipMonthlyCr)} Cr/mo
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">
                    Why this matters
                  </p>
                  <p className="mt-3 text-sm leading-7 text-amber-50">
                    The 2020s are the first era in which retail participation is
                    not a side-story. It is a structural market force that can
                    absorb part of the FPI volatility older cycles could not
                    handle.
                  </p>
                </div>
              </GradientPanel>
            </MotionReveal>
          </div>
        </section>

        <section
          id="world"
          className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-14"
        >
          <MotionReveal>
            <SectionHeading
              eyebrow="India vs world"
              title="India, the USA, and China on one interactive scale with the same navigation model"
              subtitle="The comparison chart now uses the same fit-all, zoom, and pan logic as the main explorer. India still wins on local-currency multiple over the 1990–2025 period, but currency drag remains the permanent haircut global investors have to respect."
            />
          </MotionReveal>

          <div className="mt-10 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <MotionReveal>
              <GradientPanel>
                <ComparisonChart data={indiaVsWorld} />
              </GradientPanel>
            </MotionReveal>

            <div className="space-y-6">
              {growthCards.map((card, index) => (
                <MotionReveal key={card.label} delay={index * 0.05}>
                  <GradientPanel>
                    <p
                      className={cn(
                        "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
                        card.tone === "emerald"
                          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                          : card.tone === "sky"
                            ? "border-sky-400/20 bg-sky-400/10 text-sky-200"
                            : "border-violet-400/20 bg-violet-400/10 text-violet-200",
                      )}
                    >
                      {card.label}
                    </p>
                    <p className="mt-4 text-4xl font-semibold tracking-tight text-white">
                      {card.value}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {card.note}
                    </p>
                  </GradientPanel>
                </MotionReveal>
              ))}

              <MotionReveal delay={0.14}>
                <GradientPanel>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Currency lens
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold text-white">
                    Local outperformance, global haircut
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-slate-300">
                    India’s local-currency returns are spectacular, but long-run
                    rupee depreciation compresses the edge in USD terms. The
                    correct conclusion is not that India loses — it is that
                    currency remains a permanent emerging-market risk factor.
                  </p>
                </GradientPanel>
              </MotionReveal>
            </div>
          </div>
        </section>

        <section
          id="crashes"
          className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-14"
        >
          <MotionReveal>
            <SectionHeading
              eyebrow="Crashes & windows"
              title="The market kept breaking — and patience kept winning"
              subtitle="This section still reinforces the core behavioral finding: drawdowns were frequent, scary, and often violent, yet long windows kept neutralizing terrible entry points."
            />
          </MotionReveal>

          <div className="mt-10 grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
            <MotionReveal>
              <GradientPanel>
                <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      Major drawdown map
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      The severity of the fall mattered less than the discipline
                      to stay invested.
                    </p>
                  </div>
                  <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-sm text-rose-200">
                    Median recovery: {medianRecovery} months
                  </span>
                </div>

                <div className="space-y-5">
                  {crashEvents.map((crash) => (
                    <div
                      key={`${crash.name}-${crash.period}`}
                      className="rounded-3xl border border-white/10 bg-slate-950/55 p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-400">
                            {crash.period}
                          </p>
                          <h4 className="text-lg font-semibold text-white">
                            {crash.name}
                          </h4>
                        </div>
                        <div className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1 text-sm font-medium text-rose-200">
                          {crash.decline}%
                        </div>
                      </div>

                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-900/80 ring-1 ring-white/5">
                        <div
                          className="progress-fill h-full rounded-full bg-gradient-to-r from-rose-500 via-orange-400 to-amber-300"
                          style={{
                            width: `${(Math.abs(crash.decline) / maxCrash) * 100}%`,
                          }}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          {crash.monthsToBottom} months to bottom
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                          {crash.monthsToRecover === null
                            ? "Recovery ongoing"
                            : `${crash.monthsToRecover} months to recover`}
                        </span>
                      </div>

                      <p className="mt-4 text-sm leading-6 text-slate-400">
                        {crash.note}
                      </p>
                    </div>
                  ))}
                </div>
              </GradientPanel>
            </MotionReveal>

            <div className="space-y-6">
              <MotionReveal delay={0.05}>
                <GradientPanel className="bg-[linear-gradient(135deg,rgba(16,185,129,0.22),rgba(255,255,255,0.08),rgba(56,189,248,0.12))]">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">
                    Patience premium
                  </p>
                  <h3 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                    No 15-year window in the supplied Sensex dataset fell below
                    9% CAGR.
                  </h3>
                  <p className="mt-4 text-base leading-7 text-emerald-50">
                    The strongest edge in Indian equities was never perfect
                    timing. It was remaining invested through the exact moments
                    that felt least survivable.
                  </p>
                </GradientPanel>
              </MotionReveal>

              <MotionReveal delay={0.1}>
                <GradientPanel>
                  <h3 className="text-xl font-semibold text-white">
                    15-year rolling windows
                  </h3>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {rollingWindows.map((window) => (
                      <div
                        key={window.period}
                        className="rounded-2xl border border-white/10 bg-slate-950/55 p-5"
                      >
                        <p className="text-sm text-slate-400">
                          {window.period}
                        </p>
                        <p className="mt-2 text-3xl font-semibold text-white">
                          {window.cagr.toFixed(1)}%
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                          {window.verdict}
                        </p>
                      </div>
                    ))}
                  </div>
                </GradientPanel>
              </MotionReveal>

              <MotionReveal delay={0.14}>
                <GradientPanel>
                  <h3 className="text-xl font-semibold text-white">
                    Decade return bars
                  </h3>
                  <div className="mt-5 space-y-5">
                    {decadeReturns.map((period) => (
                      <div
                        key={period.period}
                        className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"
                      >
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-white">
                            {period.period}
                          </p>
                          <span className="text-xs text-slate-400">
                            Nominal vs real CAGR
                          </span>
                        </div>
                        <ProgressMetric
                          label="Nominal"
                          value={`${period.nominal > 0 ? "+" : ""}${period.nominal.toFixed(1)}%`}
                          max={Math.max(
                            Math.abs(period.nominal) * 4.2,
                            period.nominal === 0 ? 8 : 18,
                          )}
                          tone={
                            period.nominal >= 10
                              ? "emerald"
                              : period.nominal >= 0
                                ? "amber"
                                : "rose"
                          }
                          description="Headline annualized return"
                        />
                        <div className="mt-4" />
                        <ProgressMetric
                          label="Real"
                          value={`${period.real > 0 ? "+" : ""}${period.real.toFixed(1)}%`}
                          max={Math.max(
                            Math.abs(period.real) * 5.4,
                            period.real === 0 ? 8 : 18,
                          )}
                          tone={
                            period.real >= 5
                              ? "emerald"
                              : period.real >= 0
                                ? "amber"
                                : "rose"
                          }
                          description="Inflation-adjusted annualized return"
                        />
                      </div>
                    ))}
                  </div>
                </GradientPanel>
              </MotionReveal>
            </div>
          </div>
        </section>

        <section
          id="projector"
          className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-14"
        >
          <MotionReveal>
            <SectionHeading
              eyebrow="2050 projector"
              title="Preset scenarios plus a custom return-and-inflation simulator"
              subtitle="The long-term framing is now interactive: click a preset path or build your own projection using nominal CAGR and inflation assumptions."
            />
          </MotionReveal>

          <div className="mt-10 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <MotionReveal>
              <GradientPanel>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                      Scenario table
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">
                      Preset 2050 paths
                    </h3>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                    Click to load
                  </span>
                </div>

                <div className="mt-6 space-y-4">
                  {scenario2050.map((scenario) => (
                    <button
                      key={scenario.name}
                      type="button"
                      onClick={() => {
                        setProjectionCagr(scenario.cagr);
                        setProjectionInflation(scenario.inflation);
                      }}
                      className={cn(
                        "w-full rounded-2xl border p-5 text-left transition hover:bg-white/10",
                        scenarioToneClasses[scenario.tone],
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] opacity-80">
                            {scenario.probability}
                          </p>
                          <h4 className="mt-1 text-lg font-semibold text-white">
                            {scenario.name}
                          </h4>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white">
                          {scenario.cagr}% CAGR
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                          2050: {formatNumber(scenario.projectedSensex2050)}
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                          Inflation: {scenario.inflation}%
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                          Real multiple: {scenario.realMultiple.toFixed(2)}x
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-slate-100/90">
                        {scenario.note}
                      </p>
                    </button>
                  ))}
                </div>
              </GradientPanel>
            </MotionReveal>

            <MotionReveal delay={0.08}>
              <GradientPanel>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                      Custom simulator
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">
                      Build your own 2050 view
                    </h3>
                  </div>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                    25-year horizon
                  </span>
                </div>

                <div className="mt-6 grid gap-6">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <label
                        htmlFor="cagr"
                        className="text-sm font-medium text-white"
                      >
                        Nominal CAGR assumption
                      </label>
                      <span className="text-sm font-semibold text-slate-200">
                        {projectionCagr.toFixed(1)}%
                      </span>
                    </div>
                    <input
                      id="cagr"
                      type="range"
                      min={6}
                      max={15}
                      step={0.1}
                      value={projectionCagr}
                      onChange={(event) =>
                        setProjectionCagr(Number(event.target.value))
                      }
                      className="mt-4 w-full"
                    />
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <label
                        htmlFor="inflation"
                        className="text-sm font-medium text-white"
                      >
                        Inflation assumption
                      </label>
                      <span className="text-sm font-semibold text-slate-200">
                        {projectionInflation.toFixed(1)}%
                      </span>
                    </div>
                    <input
                      id="inflation"
                      type="range"
                      min={3}
                      max={7}
                      step={0.1}
                      value={projectionInflation}
                      onChange={(event) =>
                        setProjectionInflation(Number(event.target.value))
                      }
                      className="mt-4 w-full"
                    />
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm text-slate-400">
                      Projected 2050 Sensex
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      {formatNumber(projectedSensex2050)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm text-slate-400">
                      Real CAGR after inflation
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      {realCagr.toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <p className="text-sm text-slate-400">
                      Real 2025-rupee value
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-white">
                      {formatNumber(projectedRealValue)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <ProgressMetric
                    label="Nominal multiple"
                    value={`${(projectedSensex2050 / 80000).toFixed(2)}x`}
                    max={(projectedSensex2050 / 1500000) * 100}
                    tone="emerald"
                    description="How many times the current 80,000 level your scenario implies by 2050."
                  />
                  <ProgressMetric
                    label="Real multiple"
                    value={`${realMultiple.toFixed(2)}x`}
                    max={(realMultiple / 6) * 100}
                    tone="amber"
                    description="How much purchasing power remains after your inflation assumption is applied."
                  />
                </div>
              </GradientPanel>
            </MotionReveal>
          </div>
        </section>

        <section
          id="insights"
          className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-14"
        >
          <MotionReveal>
            <SectionHeading
              eyebrow="Ten deep insights"
              title="Structural lessons that survive beyond one rally or one correction"
              subtitle="The original insight list remains central, but now sits inside a denser, more interactive environment with stronger context and data exports around it."
            />
          </MotionReveal>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {insights.map((insight, index) => (
              <MotionReveal key={insight.title} delay={index * 0.035}>
                <GradientPanel innerClassName="h-full">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <h3 className="text-xl font-semibold text-white">
                      {insight.title}
                    </h3>
                  </div>
                  <p className="mt-5 text-sm leading-7 text-slate-300">
                    {insight.body}
                  </p>
                </GradientPanel>
              </MotionReveal>
            ))}
          </div>
        </section>

        <section
          id="data"
          className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-14"
        >
          <MotionReveal>
            <SectionHeading
              eyebrow="Reference table & exports"
              title="A denser data layer, plus downloadable CSV outputs"
              subtitle="This final section keeps the experience anchored to reference rows while making the research portable. You can now export the index series, master table, and retail participation dataset directly from the interface."
            />
          </MotionReveal>

          <MotionReveal delay={0.04} className="mt-8">
            <GradientPanel>
              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Download center
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-white">
                    Take the data with you
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    All exports are client-side CSV downloads generated from the
                    same structured React data used throughout the site.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 lg:justify-end">
                  <button
                    type="button"
                    onClick={handleDownloadIndexCsv}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                  >
                    Index CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadMasterCsv}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                  >
                    Master table CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadRetailCsv}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                  >
                    Retail CSV
                  </button>
                </div>
              </div>
            </GradientPanel>
          </MotionReveal>

          <div className="mt-10 grid gap-8 xl:grid-cols-[0.82fr_1.18fr]">
            <div className="space-y-5">
              {masterTable.slice(0, 7).map((row, index) => (
                <MotionReveal key={row.year} delay={index * 0.04}>
                  <GradientPanel>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-slate-400">{row.year}</p>
                        <h3 className="text-2xl font-semibold text-white">
                          Index {row.normalizedIndex}
                        </h3>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
                        {row.sensex === "—"
                          ? "Pre-Sensex"
                          : `Sensex ${row.sensex}`}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {row.event}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
                      <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1">
                        YoY: {row.yoy}
                      </span>
                      <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1">
                        CAGR from 1947: {row.cagrFrom1947}
                      </span>
                      <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1">
                        INR/USD: {row.inrUsd}
                      </span>
                    </div>
                  </GradientPanel>
                </MotionReveal>
              ))}
            </div>

            <MotionReveal delay={0.08}>
              <GradientPanel innerClassName="overflow-hidden p-0">
                <div className="border-b border-white/10 px-6 py-5">
                  <h3 className="text-xl font-semibold text-white">
                    Master table
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Selected rows from Independence through the 2025 estimate.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                    <thead className="bg-white/5 text-slate-300">
                      <tr>
                        <th className="px-4 py-3 font-medium">Year</th>
                        <th className="px-4 py-3 font-medium">
                          Normalized index
                        </th>
                        <th className="px-4 py-3 font-medium">Sensex</th>
                        <th className="px-4 py-3 font-medium">YoY</th>
                        <th className="px-4 py-3 font-medium">
                          CAGR from 1947
                        </th>
                        <th className="px-4 py-3 font-medium">INR/USD</th>
                        <th className="px-4 py-3 font-medium">Key event</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-200">
                      {masterTable.map((row) => (
                        <tr
                          key={`${row.year}-${row.event}`}
                          className="align-top hover:bg-white/[0.03]"
                        >
                          <td className="whitespace-nowrap px-4 py-4 font-medium text-white">
                            {row.year}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            {row.normalizedIndex}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            {row.sensex}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            {row.yoy}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            {row.cagrFrom1947}
                          </td>
                          <td className="whitespace-nowrap px-4 py-4">
                            {row.inrUsd}
                          </td>
                          <td className="min-w-[260px] px-4 py-4 text-slate-300">
                            {row.event}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GradientPanel>
            </MotionReveal>
          </div>
        </section>

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

export default App;
