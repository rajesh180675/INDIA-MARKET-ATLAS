import { GradientPanel } from "@/components/ui/GradientPanel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import MotionReveal from "@/components/MotionReveal";
import ComparisonChart from "@/components/ComparisonChart";
import { indiaVsWorld } from "@/data/indiaMarketData";
import { cn } from "@/utils/cn";

export default function GlobalComparisonSection() {
  const worldFinal = indiaVsWorld[indiaVsWorld.length - 1] ?? {
    year: 2025,
    india: 100,
    usa: 100,
    china: 100,
  };

  const growthCards = [
    {
      label: "India",
      value: `${(worldFinal.india / 100).toFixed(1)}x`,
      note: "1990 to 2025 normalized growth in local currency terms.",
      tone: "emerald",
    },
    {
      label: "USA",
      value: `${(worldFinal.usa / 100).toFixed(1)}x`,
      note: "The S&P 500 remained powerful, but India still outran it in local-currency terms.",
      tone: "sky",
    },
    {
      label: "China",
      value: `${(worldFinal.china / 100).toFixed(1)}x`,
      note: "China's path was explosive, but India's late-period compounding has been more structurally durable.",
      tone: "violet",
    },
  ] as const;

  return (
    <section
      id="world"
      className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-14"
    >
      <MotionReveal>
        <SectionHeading
          eyebrow="India vs world"
          title="India, the USA, and China on one interactive scale with the same navigation model"
          subtitle="The comparison chart now uses the same fit-all, zoom, and pan logic as the main explorer. India still wins on local-currency multiple over the 1990–2025 period, but currency drag remains the permanent haircut global investors have to respect."
        />
      </MotionReveal>

      <div className="mt-10 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <MotionReveal>
          <GradientPanel>
            <ComparisonChart data={indiaVsWorld} />
          </GradientPanel>
        </MotionReveal>

        <div className="space-y-6">
          {growthCards.map((card, index) => (
            <MotionReveal key={card.label} delay={index * 0.05}>
              <GradientPanel>
                <p
                  className={cn(
                    "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
                    card.tone === "emerald"
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                      : card.tone === "sky"
                        ? "border-sky-400/20 bg-sky-400/10 text-sky-200"
                        : "border-violet-400/20 bg-violet-400/10 text-violet-200",
                  )}
                >
                  {card.label}
                </p>
                <p className="mt-4 text-4xl font-semibold tracking-tight text-white">
                  {card.value}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {card.note}
                </p>
              </GradientPanel>
            </MotionReveal>
          ))}

          <MotionReveal delay={0.14}>
            <GradientPanel>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                Currency lens
              </p>
              <h3 className="mt-3 text-2xl font-semibold text-white">
                Local outperformance, global haircut
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                India's local-currency returns are spectacular, but long-run
                rupee depreciation compresses the edge in USD terms. The
                correct conclusion is not that India loses — it is that
                currency remains a permanent emerging-market risk factor.
              </p>
            </GradientPanel>
          </MotionReveal>
        </div>
      </div>
    </section>
  );
}
