import { useState } from "react";
import { GradientPanel } from "@/components/ui/GradientPanel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import MotionReveal from "@/components/MotionReveal";
import {
  marketBreadth,
  marketRegimes,
  sectorEvolution,
} from "@/data/indiaMarketData";
import { formatNumber } from "@/lib/format";
import { cn } from "@/utils/cn";

const regimeToneClasses = {
  red: {
    badge: "border-rose-400/20 bg-rose-400/10 text-rose-200",
    ring: "from-rose-500/30 via-orange-500/10 to-transparent",
    accent: "bg-rose-400",
  },
  amber: {
    badge: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    ring: "from-amber-500/30 via-yellow-500/10 to-transparent",
    accent: "bg-amber-400",
  },
  blue: {
    badge: "border-sky-400/20 bg-sky-400/10 text-sky-200",
    ring: "from-sky-500/30 via-cyan-500/10 to-transparent",
    accent: "bg-sky-400",
  },
  emerald: {
    badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    ring: "from-emerald-500/30 via-lime-500/10 to-transparent",
    accent: "bg-emerald-400",
  },
  violet: {
    badge: "border-violet-400/20 bg-violet-400/10 text-violet-200",
    ring: "from-violet-500/30 via-fuchsia-500/10 to-transparent",
    accent: "bg-violet-400",
  },
} as const;

export default function StructureSection() {
  const fallbackRegime = marketRegimes[0];
  const [activeRegime, setActiveRegime] = useState(
    marketRegimes[4]?.id ?? fallbackRegime.id,
  );

  const selectedRegime =
    marketRegimes.find((regime) => regime.id === activeRegime) ?? fallbackRegime;
  const selectedRegimeTone = regimeToneClasses[selectedRegime.tone];

  return (
    <section
      id="structure"
      className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-14"
    >
      <MotionReveal>
        <SectionHeading
          eyebrow="Structure"
          title="Regime explorer, sector evolution, and market breadth on one canvas"
          subtitle="This section surfaces the deeper market structure behind price: what led each era, what risks dominated it, and how India's market breadth evolved from a tightly controlled niche to a mass-owned system."
        />
      </MotionReveal>

      <div className="mt-10 grid gap-8 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-3">
          {marketRegimes.map((regime, index) => {
            const tone = regimeToneClasses[regime.tone];
            const active = regime.id === selectedRegime.id;

            return (
              <MotionReveal key={regime.id} delay={index * 0.04}>
                <button
                  type="button"
                  onClick={() => setActiveRegime(regime.id)}
                  className={cn(
                    "w-full rounded-[28px] border p-5 text-left transition",
                    active
                      ? "border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.1),transparent_60%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] shadow-2xl shadow-black/20"
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10",
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                        {regime.years}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-white">
                        {regime.name}
                      </h3>
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium",
                        tone.badge,
                      )}
                    >
                      {regime.returns}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {regime.summary}
                  </p>
                  <div
                    className={cn(
                      "mt-4 h-1.5 rounded-full bg-white/5",
                      active && `bg-gradient-to-r ${tone.ring}`,
                    )}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full",
                        tone.accent,
                        active ? "w-full" : "w-0",
                      )}
                    />
                  </div>
                </button>
              </MotionReveal>
            );
          })}
        </div>

        <div className="space-y-6">
          <MotionReveal>
            <GradientPanel>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-3xl font-semibold tracking-tight text-white">
                  {selectedRegime.name}
                </h3>
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    selectedRegimeTone.badge,
                  )}
                >
                  {selectedRegime.years}
                </span>
              </div>
              <p className="mt-4 text-base leading-7 text-slate-200">
                {selectedRegime.summary}
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
                  <p className="text-sm text-slate-400">Primary driver</p>
                  <p className="mt-3 text-sm leading-7 text-white">
                    {selectedRegime.driver}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
                  <p className="text-sm text-slate-400">Dominant risk</p>
                  <p className="mt-3 text-sm leading-7 text-white">
                    {selectedRegime.risk}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5 md:col-span-2">
                  <p className="text-sm text-slate-400">Investor lesson</p>
                  <p className="mt-3 text-sm leading-7 text-white">
                    {selectedRegime.lesson}
                  </p>
                </div>
              </div>
            </GradientPanel>
          </MotionReveal>

          <div className="grid gap-5 xl:grid-cols-2">
            <MotionReveal delay={0.05}>
              <GradientPanel>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Sector evolution
                </p>
                <div className="mt-5 space-y-4">
                  {sectorEvolution.map((snapshot) => (
                    <div
                      key={snapshot.year}
                      className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                            {snapshot.era}
                          </p>
                          <h4 className="mt-1 text-lg font-semibold text-white">
                            {snapshot.year}
                          </h4>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                          {snapshot.dominant}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {snapshot.challengers.map((challenger) => (
                          <span
                            key={challenger}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                          >
                            {challenger}
                          </span>
                        ))}
                      </div>
                      <p className="mt-4 text-sm leading-6 text-slate-300">
                        {snapshot.note}
                      </p>
                      <p className="mt-2 text-xs leading-6 text-slate-400">
                        {snapshot.breadthSignal}
                      </p>
                    </div>
                  ))}
                </div>
              </GradientPanel>
            </MotionReveal>

            <MotionReveal delay={0.1}>
              <GradientPanel>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Market breadth timeline
                </p>
                <div className="mt-5 space-y-4">
                  {marketBreadth.map((point) => (
                    <div
                      key={point.year}
                      className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="text-lg font-semibold text-white">
                            {point.year}
                          </h4>
                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            {point.note}
                          </p>
                        </div>
                        <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs text-sky-200">
                          MCap/GDP {point.marketCapToGdp}%
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-300">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          ₹{formatNumber(point.marketCapLakhCr)}L Cr MCap
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          {formatNumber(point.listedCompaniesK, 1)}K listed
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          {formatNumber(point.dematCrore, 1)} Cr demat
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          ₹{formatNumber(point.dailyTurnoverCr)} Cr turnover
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </GradientPanel>
            </MotionReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
