export function formatNumber(value: number | string | null | undefined, decimals = 0) {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return "—";
  return numericValue.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value: number | null | undefined, decimals = 1) {
  if (!Number.isFinite(value)) return "—";
  return `${Number(value).toFixed(decimals)}%`;
}
