import { cn } from "@/utils/cn";

const toneClasses = {
  emerald: "from-emerald-400 to-lime-300",
  sky: "from-sky-400 to-cyan-300",
  amber: "from-amber-400 to-orange-300",
  rose: "from-rose-400 to-orange-300",
  violet: "from-violet-400 to-fuchsia-300",
} as const;

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function ProgressMetric({
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
