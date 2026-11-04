export type ExportKind = "ration" | "workouts" | "weight" | "all";
export type ExportFileFormat = "csv" | "pdf" | "zip";

const STEMS: Record<ExportKind, string> = {
  ration: "calorie-vision-ration",
  workouts: "calorie-vision-workouts",
  weight: "calorie-vision-weight",
  all: "calorie-vision-all",
};

/** Files inside the «всё вместе» ZIP. UTF-8 names, one table per domain. */
export const ALL_EXPORT_CSV_NAMES = {
  ration: "рацион.csv",
  workouts: "тренировки.csv",
  weight: "вес.csv",
} as const;

export function exportApiPath(kind: ExportKind): string {
  if (kind === "ration") return "/api/export";
  return `/api/export/${kind}`;
}

export function exportQueryPath(
  kind: ExportKind,
  format: "csv" | "pdf",
  from?: string | null,
  to?: string | null,
): string {
  const query = new URLSearchParams({ format });
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  return `${exportApiPath(kind)}?${query.toString()}`;
}

/**
 * Download name. «Всё вместе» CSV is a ZIP of three tables, so the extension is `.zip`
 * even when the query format is `csv`.
 */
export function exportDownloadName(
  kind: ExportKind,
  format: ExportFileFormat,
  from?: string | null,
  to?: string | null,
): string {
  const ext = kind === "all" && format === "csv" ? "zip" : format;
  const stem = STEMS[kind];
  if (from && to) return `${stem}-${from}-${to}.${ext}`;
  return `${stem}.${ext}`;
}

export function exportPeriodLabel(from: string | null, to: string | null): string {
  if (from && to) return `${from} — ${to}`;
  return from ?? to ?? "всё время";
}
