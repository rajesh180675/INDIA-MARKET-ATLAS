import { lazy, Suspense } from "react";
import { useTheme } from "./console/useTheme";
import { readInt, useAtlasState } from "./console/url-state";
import { resolveWorkspace, WORKSPACES } from "./console/workspaces";
import { YearWindow } from "./console/controls";
import { MAX_YEAR, MIN_YEAR } from "./domain/atlas";

const IndexExplorer = lazy(() => import("./console/workspaces/IndexExplorer"));
const MacroLab = lazy(() => import("./console/workspaces/MacroLab"));
const AssetRace = lazy(() => import("./console/workspaces/AssetRace"));
const SipSimulator = lazy(() => import("./console/workspaces/SipSimulator"));
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

  return (
    <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col lg:flex-row">
      {/* Workspace rail — vertical instrument nav, not a scroll navbar */}
      <aside
        className="rule-b lg:rule-b-0 lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:border-r"
        style={{ borderColor: "var(--rule)" }}
        aria-label="Workspaces"
      >
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
                  onClick={() => setWorkspace(w.slug)}
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
                  <div className="mt-0.5 text-[11.5px] leading-snug" style={{ color: "var(--ink-faint)" }}>
                    {w.scope}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Global year-window control — shown only for workspaces that use it */}
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

          <div className="rule-t mt-auto flex items-center justify-between pt-4">
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
        </div>
      </aside>

      {/* Active workspace */}
      <main className="min-w-0 flex-1 px-5 py-6 sm:px-8">
        <header className="rule-b mb-6 pb-4">
          <h1 className="display text-3xl sm:text-4xl">{ws.title}</h1>
          <p className="mt-1.5 text-[15px]" style={{ color: "var(--ink-soft)" }}>
            {ws.scope}
          </p>
        </header>

        <Suspense
          fallback={
            <div
              className="surface animate-pulse"
              style={{ height: 360 }}
              aria-label="Loading workspace"
            />
          }
        >
          {renderWorkspace(ws.slug, theme)}
        </Suspense>
      </main>
    </div>
  );
}
