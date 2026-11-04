/** Spreadsheet cell. Comma, quotes and line breaks are RFC 4180. */
export function escCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** UTF-8 BOM so Excel on Windows opens Cyrillic CSV as text, not a single column of mojibake. */
export const CSV_BOM = "\uFEFF";

export function csvDocument(
  header: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  const lines = [
    header.join(","),
    ...rows.map((row) => row.map((cell) => escCsv(cell)).join(",")),
  ];
  return `${CSV_BOM}${lines.join("\r\n")}`;
}
