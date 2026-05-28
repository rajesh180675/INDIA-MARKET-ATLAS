import { useState } from "react";
import { GradientPanel } from "@/components/ui/GradientPanel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ProgressMetric } from "@/components/ui/ProgressMetric";
import AnimatedCounter from "@/components/AnimatedCounter";
import MotionReveal from "@/components/MotionReveal";
import { sipDematGrowth } from "@/data/indiaMarketData";
import { downloadCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/format";
import { cn } from "@/utils/cn";

export default function RetailSection() {
  const fallbackSipPoint = sipDematGrowth[0] ?? {
    year: 2025,
    dematCrore: 0,
    sipMonthlyCr: 0,
    annualSipCr: 0,
  };

  const [selectedSipYear, setSelectedSipYear] = useState(
    sipDematGrowth[sipDematGrowth.length - 1]?.year ?? fallbackSipPoint.year,
  );

  const selectedSipPoint =
    sipDematGrowth.find((point) => point.year === selectedSipYear) ??
    fallbackSipPoint;

  const maxDemat = Math.max(
    ...sipDematGrowth.map((point) => point.dematCrore),
    1,
  );
  const maxSip = Math.max(
    ...sipDematGrowth.map((point) => point.sipMonthlyCr),
    1,
  );

  const handleDownloadRetailCsv = () =>
    downloadCsv(
      "india-retail-participation-sip-demat.csv",
      sipDematGrowth.map((row) => ({
        year: row.year,
        demat_crore: row.dematCrore,
        sip_monthly_crore: row.sipMonthlyCr,
        annual_sip_crore: row.annualSipCr,
      })),
    );

  return (
    <section
      id="retail"
      className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-14"
    >
      <MotionReveal>
        <SectionHeading
          eyebrow="Retail engine"
          title="SIP and demat growth tracker"
          subtitle="This remains one of the biggest structural upgrades on the site: a dedicated section for the household-participation wave that changed the market's resilience after 2020."
        />
      </MotionReveal>

      <div className="mt-10 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <MotionReveal>
          <GradientPanel>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Interactive retail tracker
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  Select a year from 2016 to 2025
                </h3>
              </div>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                Selected: {selectedSipPoint.year}
              </span>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/55 p-5">
              <input
                type="range"
                min={sipDematGrowth[0]?.year}
                max={sipDematGrowth[sipDematGrowth.length - 1]?.year}
                step={1}
                value={selectedSipYear}
                onChange={(event) =>
                  setSelectedSipYear(Number(event.target.value))
                }
                className="w-full"
              />

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-slate-400">Demat accounts</p>
                  <AnimatedCounter
                    value={selectedSipPoint.dematCrore}
                    suffix=" Cr"
                    decimals={1}
                    className="mt-2 block text-4xl font-semibold tracking-tight text-white"
                  />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Monthly SIP flow</p>
                  <AnimatedCounter
                    value={selectedSipPoint.sipMonthlyCr}
                    prefix="₹"
                    suffix=" Cr"
                    className="mt-2 block text-4xl font-semibold tracking-tight text-white"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <ProgressMetric
                label="Demat penetration"
                value={`${formatNumber(selectedSipPoint.dematCrore, 1)} Cr`}
                max={(selectedSipPoint.dematCrore / maxDemat) * 100}
                tone="emerald"
                description="Accounts expanded from niche ownership to mass participation in under a decade."
              />
              <ProgressMetric
                label="Monthly SIP engine"
                value={`₹${formatNumber(selectedSipPoint.sipMonthlyCr)} Cr`}
                max={(selectedSipPoint.sipMonthlyCr / maxSip) * 100}
                tone="sky"
                description="Steady SIP flows now create a structural domestic bid that earlier cycles lacked."
              />
              <ProgressMetric
                label="Annualized SIP pace"
                value={`₹${formatNumber(selectedSipPoint.annualSipCr)} Cr`}
                max={(selectedSipPoint.annualSipCr / (maxSip * 12)) * 100}
                tone="violet"
                description="This is the savings conveyor belt that changed how corrections behave."
              />
            </div>
          </GradientPanel>
        </MotionReveal>

        <MotionReveal delay={0.08}>
          <GradientPanel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Retail surge timeline
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  Domestic flows became structural
                </h3>
              </div>
              <button
                type="button"
                onClick={handleDownloadRetailCsv}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Download retail CSV
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {sipDematGrowth.map((point) => {
                const active = point.year === selectedSipPoint.year;
                return (
                  <button
                    key={point.year}
                    type="button"
                    onClick={() => setSelectedSipYear(point.year)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition",
                      active
                        ? "border-emerald-400/30 bg-emerald-400/10 shadow-lg shadow-emerald-950/25"
                        : "border-white/10 bg-white/5 hover:bg-white/10",
                    )}
                  >
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                      {point.year}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {formatNumber(point.dematCrore, 1)} Cr
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Demat accounts
                    </p>
                    <p className="mt-3 text-sm font-medium text-sky-200">
                      ₹{formatNumber(point.sipMonthlyCr)} Cr/mo
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">
                Why this matters
              </p>
              <p className="mt-3 text-sm leading-7 text-amber-50">
                The 2020s are the first era in which retail participation is
                not a side-story. It is a structural market force that can
                absorb part of the FPI volatility older cycles could not
                handle.
              </p>
            </div>
          </GradientPanel>
        </MotionReveal>
      </div>
    </section>
  );
}
