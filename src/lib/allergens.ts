/** Soft allergen tags — profile + confirm warning (Wave 8). */

export const ALLERGEN_OPTIONS = [
  { id: "milk", label: "Молоко" },
  { id: "eggs", label: "Яйца" },
  { id: "gluten", label: "Глютен" },
  { id: "nuts", label: "Орехи" },
  { id: "peanuts", label: "Арахис" },
  { id: "soy", label: "Соя" },
  { id: "fish", label: "Рыба" },
  { id: "shellfish", label: "Морепродукты" },
  { id: "sesame", label: "Кунжут" },
] as const;

export type AllergenId = (typeof ALLERGEN_OPTIONS)[number]["id"];

const ALLERGEN_IDS = new Set<string>(ALLERGEN_OPTIONS.map((o) => o.id));

/** Russian / common name hints per allergen (lowercase substrings). */
const HINTS: Record<AllergenId, string[]> = {
  milk: ["молок", "молоч", "сыр", "творог", "сливк", "йогурт", "кефир", "сметан", "масло сливоч", "лактоз"],
  eggs: ["яйц", "омлет", "майонез", "меренг"],
  gluten: ["пшениц", "хлеб", "мука", "макарон", "паста", "глютен", "ячмен", "рожь", "овсян", "булк", "батон", "лаваш", "пицц"],
  nuts: ["орех", "миндал", "фундук", "кешью", "грецк", "пекан", "фисташ"],
  peanuts: ["арахис", "арахисов"],
  soy: ["соя", "соев", "тофу", "эдамаме", "edamame"],
  fish: ["рыб", "лосос", "семг", "треск", "тунц", "сельдь", "скумбр", "форел", "судак"],
  shellfish: ["кревет", "кальмар", "мидии", "устриц", "краб", "морепродукт", "гребешок"],
  sesame: ["кунжут", "тахин", "тахини"],
};

export function parseAllergensJson(raw: unknown): AllergenId[] {
  if (!Array.isArray(raw)) return [];
  const out: AllergenId[] = [];
  for (const item of raw) {
    if (typeof item === "string" && ALLERGEN_IDS.has(item) && !out.includes(item as AllergenId)) {
      out.push(item as AllergenId);
    }
  }
  return out;
}

export function normalizeAllergenIds(raw: unknown): AllergenId[] {
  return parseAllergensJson(raw);
}

export function allergenLabel(id: AllergenId): string {
  return ALLERGEN_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

/** Soft match: dish/brand text vs profile allergens. */
export function matchAllergensInText(
  text: string,
  allergens: AllergenId[],
): AllergenId[] {
  if (!allergens.length) return [];
  const hay = text.toLowerCase();
  if (!hay.trim()) return [];
  const hits: AllergenId[] = [];
  for (const id of allergens) {
    const hints = HINTS[id] ?? [];
    if (hints.some((h) => hay.includes(h))) {
      hits.push(id);
    }
  }
  return hits;
}
