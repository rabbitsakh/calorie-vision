import { decodeHtmlEntities } from "@/lib/html-text";
import { formatWorkoutExportClock } from "@/lib/workouts/export-csv";
import { csvDocument } from "@/lib/export/csv";
import { exportPeriodLabel } from "@/lib/export/paths";
import { renderPdfDocument, type PdfBlock } from "@/lib/export/pdf-document";

const MEAL_TYPE_RU: Record<string, string> = {
  BREAKFAST: "Завтрак",
  LUNCH: "Обед",
  DINNER: "Ужин",
  SNACK: "Перекус",
};

export const DIARY_CSV_HEADERS = [
  "Дата",
  "Время",
  "Приём пищи",
  "Блюдо",
  "Ккал",
  "Белки г",
  "Жиры г",
  "Углеводы г",
  "Клетчатка г",
  "Сахар г",
  "Порция г",
  "Исправлено",
] as const;

export type DiaryExportEntry = {
  date: string;
  createdAt: Date | string;
  eatenAt: Date | string | null;
  dishName: string;
  mealType: string | null;
  calories: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  sugar: number | null;
  portionGrams: number | null;
  wasCorrected: boolean;
};

function mealTypeLabel(mealType: string | null): string {
  if (!mealType) return "";
  return MEAL_TYPE_RU[mealType] ?? mealType;
}

function clockOf(entry: DiaryExportEntry, timezone: string): string {
  return formatWorkoutExportClock(entry.eatenAt ?? entry.createdAt, timezone);
}

function macroBits(entry: DiaryExportEntry): string {
  return [
    entry.protein ? `Б:${entry.protein}г` : null,
    entry.fat ? `Ж:${entry.fat}г` : null,
    entry.carbs ? `У:${entry.carbs}г` : null,
    entry.fiber ? `клетч.:${entry.fiber}г` : null,
    entry.sugar ? `сахар:${entry.sugar}г` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildDiaryCsv(entries: readonly DiaryExportEntry[], timezone: string): string {
  const rows = entries.map((entry) => [
    entry.date,
    clockOf(entry, timezone),
    mealTypeLabel(entry.mealType),
    decodeHtmlEntities(entry.dishName),
    entry.calories,
    entry.protein ?? "",
    entry.fat ?? "",
    entry.carbs ?? "",
    entry.fiber ?? "",
    entry.sugar ?? "",
    entry.portionGrams ?? "",
    entry.wasCorrected ? "да" : "",
  ]);
  return csvDocument(DIARY_CSV_HEADERS, rows);
}

export function buildDiaryPdfBlocks(
  entries: readonly DiaryExportEntry[],
  timezone: string,
): PdfBlock[] {
  const byDate = new Map<string, DiaryExportEntry[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.date) ?? [];
    list.push(entry);
    byDate.set(entry.date, list);
  }

  const blocks: PdfBlock[] = [];
  for (const [date, dayEntries] of byDate) {
    const totalCal = dayEntries.reduce((sum, entry) => sum + entry.calories, 0);
    blocks.push({
      heading: `${date}  (${totalCal} ккал)`,
      lines: dayEntries.map((entry) => {
        const name = decodeHtmlEntities(entry.dishName);
        const prefix = [clockOf(entry, timezone), mealTypeLabel(entry.mealType)].filter(Boolean).join(" ");
        const macros = macroBits(entry);
        return `  ${prefix ? `${prefix}  ` : ""}${name} — ${entry.calories} ккал${macros ? `  ${macros}` : ""}`;
      }),
    });
  }
  return blocks;
}

export async function buildDiaryPdf(input: {
  entries: readonly DiaryExportEntry[];
  timezone: string;
  from: string | null;
  to: string | null;
}): Promise<Buffer> {
  return renderPdfDocument({
    subtitle: "Дневник питания",
    periodLabel: exportPeriodLabel(input.from, input.to),
    timezone: input.timezone,
    sections: [
      {
        title: "Дневник питания",
        empty: "Нет записей в дневнике за выбранный период.",
        blocks: buildDiaryPdfBlocks(input.entries, input.timezone),
      },
    ],
  });
}
