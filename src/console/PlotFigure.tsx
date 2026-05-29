// React wrapper for Observable Plot. Plot renders an SVG/HTML node imperatively;
// this component mounts the latest render into a container and swaps it on any
// option change. This is the console's charting idiom — grammar-of-graphics
// figures, not a configured chart widget.

import { useEffect, useRef } from "react";
import type { PlotOptions } from "@observablehq/plot";
import * as Plot from "@observablehq/plot";

export interface PlotFigureProps {
  options: PlotOptions;
  /** Accessible description of what the figure shows. */
  ariaLabel: string;
  className?: string;
}

export default function PlotFigure({ options, ariaLabel, className }: PlotFigureProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const node = Plot.plot(options);
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", ariaLabel);
    host.replaceChildren(node);
    return () => host.replaceChildren();
  }, [options, ariaLabel]);

  return <div ref={ref} className={`figure ${className ?? ""}`} />;
}
