import { buildDiaryCsv, buildDiaryPdfBlocks, type DiaryExportEntry } from "@/lib/export/diary";
import { ALL_EXPORT_CSV_NAMES, exportPeriodLabel } from "@/lib/export/paths";
import { renderPdfDocument } from "@/lib/export/pdf-document";
import { buildWeightCsv, buildWeightPdfBlocks, type WeightExportEntry } from "@/lib/export/weight";
import { buildZip } from "@/lib/export/zip";
import { buildWorkoutCsv, buildWorkoutPdfBlocks, type WorkoutExportSession } from "@/lib/workouts/export-csv";

export type FullExportInput = {
  meals: readonly DiaryExportEntry[];
  sessions: readonly WorkoutExportSession[];
  weights: readonly WeightExportEntry[];
  timezone: string;
  from: string | null;
  to: string | null;
};

/** Three UTF-8 CSVs (with BOM) in one ZIP — Excel opens each table on its own. */
export function buildAllZip(input: Omit<FullExportInput, "from" | "to">): Buffer {
  return buildZip([
    { name: ALL_EXPORT_CSV_NAMES.ration, data: buildDiaryCsv(input.meals, input.timezone) },
    { name: ALL_EXPORT_CSV_NAMES.workouts, data: buildWorkoutCsv(input.sessions, input.timezone) },
    { name: ALL_EXPORT_CSV_NAMES.weight, data: buildWeightCsv(input.weights, input.timezone) },
  ]);
}

export async function buildAllPdf(input: FullExportInput): Promise<Buffer> {
  const workoutBlocks = buildWorkoutPdfBlocks(input.sessions, input.timezone).map((block) => ({
    heading: block.heading,
    sub: block.muscles || undefined,
    lines: block.lines,
  }));

  return renderPdfDocument({
    subtitle: "Все данные",
    periodLabel: exportPeriodLabel(input.from, input.to),
    timezone: input.timezone,
    sections: [
      {
        title: "Рацион",
        empty: "Нет записей в дневнике за выбранный период.",
        blocks: buildDiaryPdfBlocks(input.meals, input.timezone),
      },
      {
        title: "Тренировки",
        empty: "Нет тренировок за выбранный период.",
        blocks: workoutBlocks,
      },
      {
        title: "Вес",
        empty: "Нет замеров веса за выбранный период.",
        blocks: buildWeightPdfBlocks(input.weights, input.timezone),
      },
    ],
  });
}
