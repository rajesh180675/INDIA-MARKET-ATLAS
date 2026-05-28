import { GradientPanel } from "@/components/ui/GradientPanel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import MotionReveal from "@/components/MotionReveal";
import { insights } from "@/data/indiaMarketData";

export default function InsightsSection() {
  return (
    <section
      id="insights"
      className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-14"
    >
      <MotionReveal>
        <SectionHeading
          eyebrow="Ten deep insights"
          title="Structural lessons that survive beyond one rally or one correction"
          subtitle="The original insight list remains central, but now sits inside a denser, more interactive environment with stronger context and data exports around it."
        />
      </MotionReveal>

      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {insights.map((insight, index) => (
          <MotionReveal key={insight.title} delay={index * 0.035}>
            <GradientPanel innerClassName="h-full">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="text-xl font-semibold text-white">
                  {insight.title}
                </h3>
              </div>
              <p className="mt-5 text-sm leading-7 text-slate-300">
                {insight.body}
              </p>
            </GradientPanel>
          </MotionReveal>
        ))}
      </div>
    </section>
  );
}
