export type CustomFoodCsvRow = {
  name: string;
  calories: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  portionGrams?: number | null;
};

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === "," || ch === ";") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function toNumber(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const n = Number(value.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) ? n : null;
}

const HEADER_ALIASES: Record<string, keyof CustomFoodCsvRow | "skip"> = {
  name: "name",
  название: "name",
  dish: "name",
  product: "name",
  calories: "calories",
  kcal: "calories",
  калории: "calories",
  ккал: "calories",
  protein: "protein",
  белки: "protein",
  белок: "protein",
  fat: "fat",
  жиры: "fat",
  жир: "fat",
  carbs: "carbs",
  carbohydrates: "carbs",
  углеводы: "carbs",
  fiber: "fiber",
  клетчатка: "fiber",
  sugar: "sugar",
  сахар: "sugar",
  portion: "portionGrams",
  portiongrams: "portionGrams",
  порция: "portionGrams",
  grams: "portionGrams",
  г: "portionGrams",
};

/**
 * Parse custom-foods CSV. Header row optional; expected columns:
 * name, calories, protein, fat, carbs, portion[, fiber, sugar]
 */
export function parseCustomFoodsCsv(text: string): { rows: CustomFoodCsvRow[]; errors: string[] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], errors: ["Пустой файл"] };
  }

  const firstCells = parseCsvLine(lines[0]!);
  const firstLower = firstCells.map((c) => c.toLowerCase().replace(/\s/g, ""));
  const hasHeader = firstLower.some((c) => c in HEADER_ALIASES && HEADER_ALIASES[c] === "name");

  let mapping: Array<keyof CustomFoodCsvRow | null>;
  let dataStart = 0;

  if (hasHeader) {
    mapping = firstLower.map((c) => {
      const key = HEADER_ALIASES[c];
      return key && key !== "skip" ? key : null;
    });
    dataStart = 1;
  } else {
    mapping = ["name", "calories", "protein", "fat", "carbs", "portionGrams"];
  }

  const nameIdx = mapping.indexOf("name");
  const calIdx = mapping.indexOf("calories");
  if (nameIdx < 0 || calIdx < 0) {
    return { rows: [], errors: ["Нужны колонки name и calories (или название и ккал)"] };
  }

  const rows: CustomFoodCsvRow[] = [];
  const errors: string[] = [];

  for (let i = dataStart; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);
    const name = (cells[nameIdx] ?? "").trim();
    const calories = toNumber(cells[calIdx]);
    if (!name || calories == null || calories <= 0) {
      errors.push(`Строка ${i + 1}: пропущена (нет названия или калорий)`);
      continue;
    }

    const row: CustomFoodCsvRow = { name, calories: Math.round(calories) };
    for (let c = 0; c < mapping.length; c++) {
      const field = mapping[c];
      if (!field || field === "name" || field === "calories") continue;
      const n = toNumber(cells[c]);
      row[field] = n;
    }
    rows.push(row);
  }

  return { rows, errors };
}
