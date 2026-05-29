// React wrapper for Observable Plot. Plot renders an SVG/HTML node imperatively;
// this component mounts the latest render into a container and swaps it on any
// option change or container size change. This is the console's charting idiom —
// grammar-of-graphics figures, not a configured chart widget.

import { useEffect, useRef, useState } from "react";
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
  // Track container width so figures re-render when the viewport changes
  // (rotation, sidebar collapse, window resize). Default 0 → first effect uses
  // current ref width.
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // Establish ResizeObserver for responsive re-renders. Debounced to one
    // animation frame to coalesce burst events (drag-resize fires ~60fps).
    let raf = 0;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]?.contentRect.width ?? 0);
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWidth(w));
    });
    ro.observe(host);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // Pass measured width into Plot — only when we have a non-zero measurement.
    // If width is 0 (first render before observer fires), skip; the observer
    // will trigger the next pass with a real width.
    if (width <= 0) return;
    const node = Plot.plot({ ...options, width });
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", ariaLabel);
    host.replaceChildren(node);
    return () => host.replaceChildren();
  }, [options, ariaLabel, width]);

  return <div ref={ref} className={`figure ${className ?? ""}`} />;
}
