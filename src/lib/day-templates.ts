/** Local day templates (MVP) — meal lists saved in localStorage. */

export type DayTemplateMeal = {
  dishName: string;
  calories: number;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  portionGrams?: number | null;
  mealType?: string | null;
};

export type DayTemplate = {
  id: string;
  name: string;
  meals: DayTemplateMeal[];
  createdAt: string;
};

export const DAY_TEMPLATES_KEY = "cv-day-templates";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

function getStorage(): StorageLike | null {
  try {
    const root = globalThis as {
      window?: { localStorage?: StorageLike };
      localStorage?: StorageLike;
    };
    return root.window?.localStorage ?? root.localStorage ?? null;
  } catch {
    return null;
  }
}

function isMeal(value: unknown): value is DayTemplateMeal {
  if (!value || typeof value !== "object") return false;
  const meal = value as DayTemplateMeal;
  return typeof meal.dishName === "string" && typeof meal.calories === "number";
}

function isTemplate(value: unknown): value is DayTemplate {
  if (!value || typeof value !== "object") return false;
  const t = value as DayTemplate;
  return (
    typeof t.id === "string" &&
    typeof t.name === "string" &&
    typeof t.createdAt === "string" &&
    Array.isArray(t.meals) &&
    t.meals.every(isMeal)
  );
}

export function loadDayTemplates(storage?: StorageLike | null): DayTemplate[] {
  const store = storage === undefined ? getStorage() : storage;
  if (!store) return [];
  try {
    const raw = store.getItem(DAY_TEMPLATES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTemplate);
  } catch {
    return [];
  }
}

export function saveDayTemplates(templates: DayTemplate[], storage?: StorageLike | null): void {
  const store = storage === undefined ? getStorage() : storage;
  if (!store) return;
  try {
    store.setItem(DAY_TEMPLATES_KEY, JSON.stringify(templates));
  } catch {
    // quota / private mode
  }
}

export function createDayTemplate(
  name: string,
  meals: DayTemplateMeal[],
  storage?: StorageLike | null,
  now: Date = new Date(),
): DayTemplate {
  const trimmed = name.trim() || "Шаблон дня";
  const template: DayTemplate = {
    id: `tpl-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    meals: meals.map((m) => ({
      dishName: m.dishName,
      calories: m.calories,
      protein: m.protein ?? null,
      fat: m.fat ?? null,
      carbs: m.carbs ?? null,
      fiber: m.fiber ?? null,
      sugar: m.sugar ?? null,
      portionGrams: m.portionGrams ?? null,
      mealType: m.mealType ?? null,
    })),
    createdAt: now.toISOString(),
  };
  const next = [template, ...loadDayTemplates(storage)];
  saveDayTemplates(next, storage);
  return template;
}

export function deleteDayTemplate(id: string, storage?: StorageLike | null): DayTemplate[] {
  const next = loadDayTemplates(storage).filter((t) => t.id !== id);
  saveDayTemplates(next, storage);
  return next;
}
