import { exportPeriodLabel } from "@/lib/export/paths";
import { renderPdfDocument } from "@/lib/export/pdf-document";
import { buildWorkoutPdfBlocks, type WorkoutExportSession } from "@/lib/workouts/export-csv";

export async function buildWorkoutPdf(input: {
  sessions: readonly WorkoutExportSession[];
  timezone: string;
  from: string | null;
  to: string | null;
}): Promise<Buffer> {
  const blocks = buildWorkoutPdfBlocks(input.sessions, input.timezone);
  return renderPdfDocument({
    subtitle: "Дневник тренировок",
    periodLabel: exportPeriodLabel(input.from, input.to),
    timezone: input.timezone,
    sections: [
      {
        title: "Дневник тренировок",
        empty: "Нет тренировок за выбранный период.",
        blocks: blocks.map((block) => ({
          heading: block.heading,
          sub: block.muscles || undefined,
          lines: block.lines,
        })),
      },
    ],
  });
}
