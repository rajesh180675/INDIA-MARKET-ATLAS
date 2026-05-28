export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-300">
        {eyebrow}
      </p>
      <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      <p className="text-base leading-7 text-slate-300 sm:text-lg">
        {subtitle}
      </p>
    </div>
  );
}
