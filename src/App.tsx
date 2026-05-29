import { lazy, Suspense, useEffect, useState } from "react";
import { useTheme } from "./console/useTheme";
import { readInt, useAtlasState } from "./console/url-state";
import { resolveWorkspace, WORKSPACES } from "./console/workspaces";
import { YearWindow } from "./console/controls";
import CommandPalette from "./console/CommandPalette";
import { MAX_YEAR, MIN_YEAR } from "./domain/atlas";

const IndexExplorer = lazy(() => import("./console/workspaces/IndexExplorer"));
const MacroLab = lazy(() => import("./console/workspaces/MacroLab"));
const AssetRace = lazy(() => import("./console/workspaces/AssetRace"));
const SipSimulator = lazy(() => import("./console/workspaces/SipSimulator"));
const VolatilityRisk = lazy(() => import("./console/workspaces/VolatilityRisk"));
const SectorLab = lazy(() => import("./console/workspaces/SectorLab"));
const RegimesCrashes = lazy(() => import("./console/workspaces/RegimesCrashes"));
const ProjectionStudio = lazy(() => import("./console/workspaces/ProjectionStudio"));

function renderWorkspace(slug: string, theme: string) {
  switch (slug) {
    case "macro":
      return <MacroLab theme={theme} />;
    case "race":
      return <AssetRace theme={theme} />;
    case "sip":
      return <SipSimulator theme={theme} />;
    case "vol":
      return <VolatilityRisk theme={theme} />;
    case "sectors":
      return <SectorLab theme={theme} />;
    case "regimes":
      return <RegimesCrashes theme={theme} />;
    case "projections":
      return <ProjectionStudio theme={theme} />;
    default:
      return <IndexExplorer theme={theme} />;
  }
}

export default function App() {
  const { theme, toggle } = useTheme();
  const { state, setWorkspace, setParams } = useAtlasState();
  const ws = resolveWorkspace(state.workspace);
  const from = readInt(state.params, "from", MIN_YEAR);
  const to = readInt(state.params, "to", MAX_YEAR);

  // Mobile drawer state — desktop layout uses static sidebar via lg: utilities,
  // so this state has no effect at lg+ breakpoint.
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer on Escape and when route resolves to a new workspace
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  function pickWorkspace(slug: string) {
    setWorkspace(slug);
    setDrawerOpen(false);
  }

  // Single source of truth for the rail content; reused by desktop sidebar
  // and mobile drawer. Pure presentation, all interactions wire to props.
  const rail = (
    <div className="flex h-full flex-col p-5">
      <div className="rule-b pb-4">
        <div className="eyebrow">India Market Atlas</div>
        <div className="display mt-1 text-[19px] leading-tight">Research Console</div>
        <div className="num mt-1 text-[12px]" style={{ color: "var(--ink-faint)" }}>
          {MIN_YEAR}–{MAX_YEAR}
        </div>
      </div>

      <nav className="mt-4 flex flex-col gap-1" aria-label="Workspace selection">
        {WORKSPACES.map((w) => {
          const active = w.slug === ws.slug;
          return (
            <button
              key={w.slug}
              type="button"
              onClick={() => pickWorkspace(w.slug)}
              aria-current={active ? "page" : undefined}
              className="group rounded-none border-l-2 px-3 py-2 text-left transition"
              style={{
                borderColor: active ? "var(--signal)" : "transparent",
                background: active ? "var(--signal-wash)" : "transparent",
              }}
            >
              <div
                className="text-[14px] font-medium"
                style={{ color: active ? "var(--signal)" : "var(--ink)" }}
              >
                {w.title}
              </div>
              <div
                className="mt-0.5 text-[11.5px] leading-snug"
                style={{ color: "var(--ink-faint)" }}
              >
                {w.scope}
              </div>
            </button>
          );
        })}
      </nav>

      {ws.usesYearWindow ? (
        <div className="rule-t mt-4 pt-4">
          <YearWindow
            min={MIN_YEAR}
            max={MAX_YEAR}
            from={from}
            to={to}
            onChange={(f, t) => setParams({ from: String(f), to: String(t) })}
          />
        </div>
      ) : null}

      <div className="rule-t mt-auto flex items-center justify-between gap-2 pt-4">
        <span className="eyebrow">Theme</span>
        <button
          type="button"
          onClick={toggle}
          className="segmented px-3 py-1.5 text-[12px]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
        >
          {theme === "light" ? "◐ Light" : "◑ Dark"}
        </button>
      </div>
      <div
        className="num mt-2 text-[10.5px]"
        style={{ color: "var(--ink-faint)", letterSpacing: "0.04em" }}
        aria-hidden="true"
      >
        Press ⌘K / Ctrl+K to search
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col lg:flex-row">
      {/* Mobile top bar — hidden at lg+ where the desktop sidebar takes over */}
      <header
        className="rule-b sticky top-0 z-30 flex items-center justify-between px-4 py-3 lg:hidden"
        style={{ background: "var(--bg)", borderColor: "var(--rule)" }}
      >
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open workspace menu"
          aria-expanded={drawerOpen}
          aria-controls="atlas-mobile-rail"
          className="segmented px-3 py-1.5 text-[12px]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
        >
          ☰ Menu
        </button>
        <div className="text-center">
          <div className="eyebrow">India Market Atlas</div>
          <div className="display text-[15px] leading-tight">{ws.title}</div>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="segmented px-2.5 py-1.5 text-[12px]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
        >
          {theme === "light" ? "◐" : "◑"}
        </button>
      </header>

      {/* Desktop sidebar — always rendered, visible at lg+ */}
      <aside
        className="hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:w-60 lg:shrink-0 lg:border-r"
        style={{ borderColor: "var(--rule)" }}
        aria-label="Workspaces"
      >
        {rail}
      </aside>

      {/* Mobile drawer — overlay, click-outside dismiss, focus-trap-light via Escape */}
      {drawerOpen ? (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Workspace menu"
        >
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }}
          />
          <aside
            id="atlas-mobile-rail"
            className="absolute left-0 top-0 h-full w-[80vw] max-w-[320px] overflow-y-auto"
            style={{
              background: "var(--bg)",
              borderRight: "1px solid var(--rule)",
            }}
          >
            <div
              className="rule-b flex items-center justify-end px-3 py-2"
              style={{ borderColor: "var(--rule)" }}
            >
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="segmented px-3 py-1 text-[12px]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
              >
                Close ✕
              </button>
            </div>
            {rail}
          </aside>
        </div>
      ) : null}

      {/* Active workspace */}
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        {/* Print-only citation header */}
        <div className="print-citation">
          <div style={{ fontSize: "10pt", letterSpacing: "0.18em", textTransform: "uppercase" }}>
            India Market Atlas — Research Console
          </div>
          <div style={{ fontSize: "16pt", fontWeight: 600, marginTop: 4 }}>{ws.title}</div>
          <div style={{ fontSize: "9pt", marginTop: 4 }}>
            {ws.scope} · Generated {new Date().toISOString().slice(0, 10)} · Hash: {window.location.hash || "#/"}
          </div>
        </div>

        <header className="rule-b mb-6 hidden items-baseline justify-between pb-4 lg:flex">
          <div>
            <h1 className="display text-3xl sm:text-4xl">{ws.title}</h1>
            <p className="mt-1.5 text-[15px]" style={{ color: "var(--ink-soft)" }}>
              {ws.scope}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="segmented px-3 py-1.5 text-[12px]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
            aria-label="Print or save current view as PDF"
            title="Print / save as PDF (Ctrl+P)"
          >
            ⎙ Print
          </button>
        </header>

        {/* Mobile-only scope subheader (h1 lives in the top bar there) */}
        <p
          className="mb-5 text-[13px] lg:hidden"
          style={{ color: "var(--ink-soft)" }}
        >
          {ws.scope}
        </p>

        <Suspense
          fallback={
            <div
              className="surface animate-pulse"
              style={{ height: 360 }}
              aria-label="Loading workspace"
            />
          }
        >
          {/* h1 for a11y on mobile (visually replaced by the top bar) */}
          <h1 className="sr-only lg:hidden">{ws.title}</h1>
          {renderWorkspace(ws.slug, theme)}
        </Suspense>
      </main>

      <CommandPalette />
    </div>
  );
}
