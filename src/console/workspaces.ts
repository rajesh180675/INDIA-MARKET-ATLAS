// Workspace registry — the console's information architecture. The app is a set
// of analytical WORKSPACES selected from the rail, not a scroll of sections.
// Each workspace owns a slug (URL-addressable), a title, a one-line scope, and
// a `usesYearWindow` flag that tells the shell whether to render the global
// year-window control for it.

export interface WorkspaceDef {
  slug: string;
  title: string;
  scope: string;
  /** Whether this workspace responds to the global from/to year window. */
  usesYearWindow: boolean;
}

export const WORKSPACES: WorkspaceDef[] = [
  {
    slug: "index",
    title: "Index Explorer",
    scope: "The 78-year equity record in four denominations",
    usesYearWindow: true,
  },
  {
    slug: "macro",
    title: "Macro Lab",
    scope: "16 indicators, cross-plotted and overlaid",
    usesYearWindow: true,
  },
  {
    slug: "race",
    title: "Asset Race",
    scope: "₹100 in 1979 across equity, gold, USD, FD, inflation",
    usesYearWindow: false,
  },
  {
    slug: "sip",
    title: "SIP Simulator",
    scope: "Every possible start × end SIP scenario, vs lumpsum",
    usesYearWindow: false,
  },
  {
    slug: "vol",
    title: "Volatility & Risk",
    scope: "Monthly Sensex (1997+) — drawdowns, rolling Sharpe, vol",
    usesYearWindow: false,
  },
  {
    slug: "regimes",
    title: "Regimes & Crashes",
    scope: "Policy eras and every major drawdown",
    usesYearWindow: false,
  },
  {
    slug: "projections",
    title: "Projection Studio",
    scope: "Assumption-driven paths to 2050",
    usesYearWindow: false,
  },
];

export const DEFAULT_WORKSPACE = "index";

export function resolveWorkspace(slug: string): WorkspaceDef {
  return WORKSPACES.find((w) => w.slug === slug) ?? WORKSPACES[0];
}
