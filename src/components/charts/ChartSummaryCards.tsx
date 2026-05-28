type SummaryCard = {
  label: string;
  value: string;
  note: string;
};

export default function ChartSummaryCards({ cards }: { cards: SummaryCard[] }) {
  return (
    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <p className="text-sm text-slate-400">{card.label}</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {card.value}
          </p>
          <p className="mt-2 text-sm text-slate-300">{card.note}</p>
        </div>
      ))}
    </div>
  );
}
