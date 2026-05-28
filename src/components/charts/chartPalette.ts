import { useMemo } from "react";

export type ChartPalette = ReturnType<typeof useChartPalette>;

export function useChartPalette(theme: "dark" | "light") {
  return useMemo(
    () =>
      theme === "light"
        ? {
            text: "#0f172a",
            muted: "#475569",
            subtle: "#64748b",
            grid: "rgba(15, 23, 42, 0.08)",
            gridStrong: "rgba(15, 23, 42, 0.14)",
            axis: "#475569",
            panel: "#ffffff",
            panelBorder: "rgba(15, 23, 42, 0.08)",
            line: "#0f172a",
            areaTop: "rgba(14, 165, 233, 0.34)",
            areaBottom: "rgba(14, 165, 233, 0.04)",
            drawdown: "rgba(249, 115, 22, 0.16)",
            drawdownLine: "#f97316",
            bull: "#0f766e",
            bear: "#dc2626",
            ma20: "#ea580c",
            ma50: "#0284c7",
            ma200: "#059669",
            crash: "#e11d48",
            milestone: "#7c3aed",
            overlayFill: "rgba(124, 58, 237, 0.08)",
            sliderBg: "rgba(15, 23, 42, 0.04)",
            sliderFill: "rgba(14, 165, 233, 0.12)",
            shadow: "#f8fafc",
          }
        : {
            text: "#f8fafc",
            muted: "#cbd5e1",
            subtle: "#94a3b8",
            grid: "rgba(255, 255, 255, 0.08)",
            gridStrong: "rgba(255, 255, 255, 0.15)",
            axis: "#cbd5e1",
            panel: "#020617",
            panelBorder: "rgba(255, 255, 255, 0.08)",
            line: "#e2e8f0",
            areaTop: "rgba(56, 189, 248, 0.34)",
            areaBottom: "rgba(56, 189, 248, 0.04)",
            drawdown: "rgba(251, 146, 60, 0.16)",
            drawdownLine: "#fb923c",
            bull: "#34d399",
            bear: "#fb7185",
            ma20: "#f59e0b",
            ma50: "#38bdf8",
            ma200: "#34d399",
            crash: "#fb7185",
            milestone: "#c084fc",
            overlayFill: "rgba(192, 132, 252, 0.08)",
            sliderBg: "rgba(255, 255, 255, 0.03)",
            sliderFill: "rgba(56, 189, 248, 0.14)",
            shadow: "#020617",
          },
    [theme],
  );
}
