import { useMemo, useRef, useState } from "react";
import type { GlobalComparisonPoint } from "../data/indiaMarketData";

const width = 980;
const height = 360;
const padding = { top: 26, right: 26, bottom: 42, left: 56 };

function formatIndianNumber(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return Number(value).toLocaleString("en-IN");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildLinePath(
  data: GlobalComparisonPoint[],
  selector: (point: GlobalComparisonPoint) => number,
  scaleX: (year: number) => number,
  scaleY: (value: number) => number,
) {
  return data
    .map((point, index) => `${index === 0 ? "M" : "L"} ${scaleX(point.year).toFixed(2)} ${scaleY(selector(point)).toFixed(2)}`)
    .join(" ");
}

export default function ComparisonChart({ data }: { data: GlobalComparisonPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-[30px] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
        Comparison data is currently unavailable.
      </div>
    );
  }

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(data.length - 1);
  const [hovering, setHovering] = useState(false);

  const firstYear = data[0]?.year ?? 1990;
  const lastYear = data[data.length - 1]?.year ?? 2025;
  const values = data.flatMap((point) => [point.india, point.usa, point.china]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values) * 1.08;
  const logMin = Math.log10(minValue);
  const logMax = Math.log10(maxValue);

  const scaleX = (year: number) =>
    padding.left + ((year - firstYear) / (lastYear - firstYear)) * (width - padding.left - padding.right);
  const scaleY = (value: number) =>
    height - padding.bottom - ((Math.log10(value) - logMin) / (logMax - logMin)) * (height - padding.top - padding.bottom);

  const paths = useMemo(
    () => ({
      india: buildLinePath(data, (point) => point.india, scaleX, scaleY),
      usa: buildLinePath(data, (point) => point.usa, scaleX, scaleY),
      china: buildLinePath(data, (point) => point.china, scaleX, scaleY),
    }),
    [data],
  );

  const activePoint = data[activeIndex] ?? data[data.length - 1];
  const activeX = scaleX(activePoint.year);
  const tooltipLeft = (activeX / width) * 100;
  const tooltipTransform =
    activeX > width * 0.78 ? "translate(-100%, -110%)" : activeX < width * 0.22 ? "translate(0%, -110%)" : "translate(-50%, -110%)";

  const handleMove = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const index = Math.round(ratio * (data.length - 1));
    setActiveIndex(clamp(index, 0, data.length - 1));
    setHovering(true);
  };

  const winner = [
    { label: "India", value: activePoint.india },
    { label: "USA", value: activePoint.usa },
    { label: "China", value: activePoint.china },
  ].sort((a, b) => b.value - a.value)[0];

  return (
    <div
      className="relative rounded-[30px] p-4 sm:p-6"
      style={{ background: "var(--chart-panel-bg)", boxShadow: "var(--chart-panel-shadow)" }}
    >
      <div className="mb-5 flex flex-wrap gap-3 text-xs text-slate-400">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Base year = 1990</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Log scale</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Hover to compare</span>
      </div>

      <div className="relative overflow-x-auto rounded-[28px] border border-white/8 bg-black/10 p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[820px]"
          onMouseMove={(event) => handleMove(event.clientX)}
          onMouseLeave={() => setHovering(false)}
          onTouchStart={(event) => handleMove(event.touches[0].clientX)}
          onTouchMove={(event) => handleMove(event.touches[0].clientX)}
        >
          {[100, 300, 1000, 3000, 10000].map((value) => {
            const y = scaleY(value);
            return (
              <g key={value}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--chart-grid)" strokeDasharray="4 8" />
                <text x={10} y={y + 4} fill="var(--chart-axis-text)" fontSize="12">
                  {formatIndianNumber(value)}
                </text>
              </g>
            );
          })}

          {[1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025].map((year) => {
            const x = scaleX(year);
            return (
              <g key={year}>
                <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke="var(--chart-grid-soft)" />
                <text x={x} y={height - 14} textAnchor="middle" fill="var(--chart-axis-text)" fontSize="12">
                  {year}
                </text>
              </g>
            );
          })}

          <path d={paths.india} fill="none" stroke="#34d399" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d={paths.usa} fill="none" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d={paths.china} fill="none" stroke="#f472b6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          <line x1={activeX} y1={padding.top} x2={activeX} y2={height - padding.bottom} stroke="var(--chart-active-line)" strokeDasharray="6 6" />
          <circle cx={activeX} cy={scaleY(activePoint.india)} r="5.5" fill="#34d399" />
          <circle cx={activeX} cy={scaleY(activePoint.usa)} r="5" fill="#60a5fa" />
          <circle cx={activeX} cy={scaleY(activePoint.china)} r="5" fill="#f472b6" />
        </svg>

        <div
          className="pointer-events-none absolute rounded-2xl border border-white/10 p-4 shadow-2xl backdrop-blur-xl"
          style={{
            left: `${tooltipLeft}%`,
            top: "12%",
            transform: tooltipTransform,
            opacity: hovering ? 1 : 0.96,
            background: "var(--chart-tooltip-bg)",
            color: "var(--chart-tooltip-text)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">World comparison</p>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300">
              {activePoint.year}
            </span>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-6">
              <span className="text-emerald-300">India</span>
              <span className="font-semibold">{formatIndianNumber(activePoint.india)}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-sky-300">USA</span>
              <span className="font-semibold">{formatIndianNumber(activePoint.usa)}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-pink-300">China</span>
              <span className="font-semibold">{formatIndianNumber(activePoint.china)}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">Leader in {activePoint.year}: {winner.label}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3 text-xs">
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-200">India</span>
        <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-sky-200">USA</span>
        <span className="rounded-full border border-pink-400/20 bg-pink-400/10 px-3 py-1 text-pink-200">China</span>
      </div>
    </div>
  );
}
