// Workspace registry — the console's information architecture. The app is a set
// of analytical WORKSPACES selected from the rail, not a scroll of sections.
// Each workspace owns a slug (URL-addressable), a title, and a one-line scope.

export interface WorkspaceDef {
  slug: string;
  title: string;
  scope: string;
}

export const WORKSPACES: WorkspaceDef[] = [
  { slug: "index", title: "Index Explorer", scope: "The 78-year equity record in four denominations" },
  { slug: "macro", title: "Macro Lab", scope: "16 indicators, cross-plotted and overlaid" },
  { slug: "regimes", title: "Regimes & Crashes", scope: "Policy eras and every major drawdown" },
  { slug: "projections", title: "Projection Studio", scope: "Assumption-driven paths to 2050" },
];

export const DEFAULT_WORKSPACE = "index";

export function resolveWorkspace(slug: string): WorkspaceDef {
  return WORKSPACES.find((w) => w.slug === slug) ?? WORKSPACES[0];
}
