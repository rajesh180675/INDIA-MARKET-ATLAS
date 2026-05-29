// Resolve themed colors from CSS custom properties for Observable Plot.
// Plot writes stroke/fill as SVG attributes, which do NOT resolve var(); so we
// read the computed values and pass concrete colors. Callers depend on `theme`
// so figures recompute on theme switch.

export interface AtlasColors {
  ink: string;
  inkSoft: string;
  inkFaint: string;
  rule: string;
  ruleStrong: string;
  signal: string;
  pos: string;
  neg: string;
  posWash: string;
  negWash: string;
  cat: string[];
}

function readVar(name: string): string {
  if (typeof window === "undefined") return "#000";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#000";
}

export function atlasColors(): AtlasColors {
  return {
    ink: readVar("--ink"),
    inkSoft: readVar("--ink-soft"),
    inkFaint: readVar("--ink-faint"),
    rule: readVar("--rule"),
    ruleStrong: readVar("--rule-strong"),
    signal: readVar("--signal"),
    pos: readVar("--pos"),
    neg: readVar("--neg"),
    posWash: readVar("--pos-wash"),
    negWash: readVar("--neg-wash"),
    cat: [
      readVar("--c1"),
      readVar("--c2"),
      readVar("--c3"),
      readVar("--c4"),
      readVar("--c5"),
      readVar("--c6"),
    ],
  };
}
