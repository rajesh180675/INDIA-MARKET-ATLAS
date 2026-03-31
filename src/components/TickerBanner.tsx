import { cn } from "../utils/cn";

export type TickerItem = {
  label: string;
  value: string;
  change?: string;
  tone?: "emerald" | "amber" | "sky" | "rose" | "violet";
};

const toneClasses: Record<NonNullable<TickerItem["tone"]>, string> = {
  emerald: "text-emerald-300",
  amber: "text-amber-300",
  sky: "text-sky-300",
  rose: "text-rose-300",
  violet: "text-violet-300",
};

export default function TickerBanner({ items }: { items: TickerItem[] }) {
  const loopedItems = [...items, ...items];

  return (
    <div className="ticker-mask border-y border-white/10 bg-slate-950/65 backdrop-blur-xl">
      <div className="ticker-track py-3">
        {loopedItems.map((item, index) => (
          <div key={`${item.label}-${index}`} className="ticker-item">
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              {item.label}
            </span>
            <span className="text-sm font-semibold text-white">{item.value}</span>
            {item.change ? (
              <span className={cn("text-xs font-medium", toneClasses[item.tone ?? "sky"])}>{item.change}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
