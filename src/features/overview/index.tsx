import { GradientPanel } from "@/components/ui/GradientPanel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import AnimatedCounter from "@/components/AnimatedCounter";
import MotionReveal from "@/components/MotionReveal";
import { keyStats } from "@/data/indiaMarketData";

export default function OverviewSection() {
  return (
    <section
      id="overview"
      className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-14"
    >
      <MotionReveal>
        <SectionHeading
          eyebrow="Overview"
          title="Animated stats for the entire 78-year record"
          subtitle="These headline metrics animate into view and frame the whole analysis: regime change, real returns, financialization, and the post-1979 acceleration that transformed Indian equities."
        />
      </MotionReveal>

      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {keyStats.map((stat, index) => (
          <MotionReveal key={stat.label} delay={index * 0.04}>
            <GradientPanel innerClassName="h-full">
              <p className="text-sm font-medium text-slate-400">
                {stat.label}
              </p>
              <AnimatedCounter
                value={stat.value}
                prefix={stat.prefix}
                suffix={stat.suffix}
                decimals={stat.decimals ?? 0}
                className="mt-4 block text-4xl font-semibold tracking-tight text-white"
              />
              <p className="mt-4 text-sm leading-6 text-slate-300">
                {stat.note}
              </p>
            </GradientPanel>
          </MotionReveal>
        ))}
      </div>
    </section>
  );
}
