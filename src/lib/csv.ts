export function convertToCsv(rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const escape = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`;

  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escape(row[header] ?? "")).join(","),
    ),
  ].join("\n");
}

export function downloadCsv(
  filename: string,
  rows: Array<Record<string, string | number>>,
) {
  if (typeof window === "undefined") return;

  const csv = convertToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
