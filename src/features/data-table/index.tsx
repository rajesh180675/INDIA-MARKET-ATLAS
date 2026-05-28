import { GradientPanel } from "@/components/ui/GradientPanel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import MotionReveal from "@/components/MotionReveal";
import { continuousIndex, masterTable } from "@/data/indiaMarketData";
import { downloadCsv } from "@/lib/csv";

function handleDownloadIndexCsv() {
  downloadCsv(
    "india-stock-market-index-1947-2025.csv",
    continuousIndex.map((point) => ({
      year: point.year,
      normalized_index_1947_base_100: point.value,
    })),
  );
}

function handleDownloadMasterCsv() {
  downloadCsv(
    "india-stock-market-master-table.csv",
    masterTable.map((row) => ({
      year: row.year,
      normalized_index: row.normalizedIndex,
      sensex: row.sensex,
      yoy: row.yoy,
      cagr_from_1947: row.cagrFrom1947,
      inr_usd: row.inrUsd,
      event: row.event,
    })),
  );
}

export default function DataTableSection() {
  return (
    <section
      id="data"
      className="mx-auto max-w-7xl px-6 py-10 sm:px-8 sm:py-14"
    >
      <MotionReveal>
        <SectionHeading
          eyebrow="Reference table & exports"
          title="A denser data layer, plus downloadable CSV outputs"
          subtitle="This final section keeps the experience anchored to reference rows while making the research portable. You can now export the index series, master table, and retail participation dataset directly from the interface."
        />
      </MotionReveal>

      <MotionReveal delay={0.04} className="mt-8">
        <GradientPanel>
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                Download center
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                Take the data with you
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                All exports are client-side CSV downloads generated from the
                same structured React data used throughout the site.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <button
                type="button"
                onClick={handleDownloadIndexCsv}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Index CSV
              </button>
              <button
                type="button"
                onClick={handleDownloadMasterCsv}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Master table CSV
              </button>
            </div>
          </div>
        </GradientPanel>
      </MotionReveal>

      <div className="mt-10 grid gap-8 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-5">
          {masterTable.slice(0, 7).map((row, index) => (
            <MotionReveal key={row.year} delay={index * 0.04}>
              <GradientPanel>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-400">{row.year}</p>
                    <h3 className="text-2xl font-semibold text-white">
                      Index {row.normalizedIndex}
                    </h3>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
                    {row.sensex === "—"
                      ? "Pre-Sensex"
                      : `Sensex ${row.sensex}`}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {row.event}
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
                  <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1">
                    YoY: {row.yoy}
                  </span>
                  <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1">
                    CAGR from 1947: {row.cagrFrom1947}
                  </span>
                  <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1">
                    INR/USD: {row.inrUsd}
                  </span>
                </div>
              </GradientPanel>
            </MotionReveal>
          ))}
        </div>

        <MotionReveal delay={0.08}>
          <GradientPanel innerClassName="overflow-hidden p-0">
            <div className="border-b border-white/10 px-6 py-5">
              <h3 className="text-xl font-semibold text-white">
                Master table
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Selected rows from Independence through the 2025 estimate.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                <thead className="bg-white/5 text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-medium">Year</th>
                    <th className="px-4 py-3 font-medium">Normalized index</th>
                    <th className="px-4 py-3 font-medium">Sensex</th>
                    <th className="px-4 py-3 font-medium">YoY</th>
                    <th className="px-4 py-3 font-medium">CAGR from 1947</th>
                    <th className="px-4 py-3 font-medium">INR/USD</th>
                    <th className="px-4 py-3 font-medium">Key event</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-200">
                  {masterTable.map((row) => (
                    <tr
                      key={`${row.year}-${row.event}`}
                      className="align-top hover:bg-white/[0.03]"
                    >
                      <td className="whitespace-nowrap px-4 py-4 font-medium text-white">
                        {row.year}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        {row.normalizedIndex}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        {row.sensex}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        {row.yoy}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        {row.cagrFrom1947}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        {row.inrUsd}
                      </td>
                      <td className="min-w-[260px] px-4 py-4 text-slate-300">
                        {row.event}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GradientPanel>
        </MotionReveal>
      </div>
    </section>
  );
}
