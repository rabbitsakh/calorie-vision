import { formatExportNumber, formatWorkoutExportClock } from "@/lib/workouts/export-csv";
import { decodeHtmlEntities } from "@/lib/html-text";
import { csvDocument } from "@/lib/export/csv";
import { exportPeriodLabel } from "@/lib/export/paths";
import { renderPdfDocument, type PdfBlock } from "@/lib/export/pdf-document";

export const WEIGHT_CSV_HEADERS = ["Дата", "Время", "Вес кг", "Заметка"] as const;

export type WeightExportEntry = {
  date: string;
  weightKg: number;
  note: string | null;
  measuredAt: Date | string | null;
};

export function buildWeightCsv(entries: readonly WeightExportEntry[], timezone: string): string {
  const rows = entries.map((entry) => [
    entry.date,
    formatWorkoutExportClock(entry.measuredAt, timezone),
    formatExportNumber(entry.weightKg),
    entry.note ? decodeHtmlEntities(entry.note) : "",
  ]);
  return csvDocument(WEIGHT_CSV_HEADERS, rows);
}

export function buildWeightPdfBlocks(
  entries: readonly WeightExportEntry[],
  timezone: string,
): PdfBlock[] {
  return entries.map((entry) => {
    const time = formatWorkoutExportClock(entry.measuredAt, timezone);
    const note = entry.note ? decodeHtmlEntities(entry.note).trim() : "";
    const lines = [`  ${formatExportNumber(entry.weightKg)} кг`];
    if (note) lines.push(`  ${note}`);
    return {
      heading: time ? `${entry.date}  ${time}` : entry.date,
      lines,
    };
  });
}

export async function buildWeightPdf(input: {
  entries: readonly WeightExportEntry[];
  timezone: string;
  from: string | null;
  to: string | null;
}): Promise<Buffer> {
  return renderPdfDocument({
    subtitle: "Вес",
    periodLabel: exportPeriodLabel(input.from, input.to),
    timezone: input.timezone,
    sections: [
      {
        title: "Вес",
        empty: "Нет замеров веса за выбранный период.",
        blocks: buildWeightPdfBlocks(input.entries, input.timezone),
      },
    ],
  });
}
