/**
 * Admin-only AI coach: prompt, validation, structured action blocks.
 */

export const ADMIN_ASSISTANT_MAX_MESSAGES = 40;
export const ADMIN_ASSISTANT_MAX_CONTENT = 6000;

export type AssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantMode = "all" | "food" | "gym" | "week";

export type AssistantActions = {
  shopping?: string[];
  meals?: Array<{ name: string; kcal?: number; note?: string }>;
  workoutDays?: Array<{ day: string; focus: string; notes?: string }>;
  summary?: string;
};

export function parseAssistantMode(raw: unknown): AssistantMode {
  if (raw === "food" || raw === "gym" || raw === "week" || raw === "all") return raw;
  return "all";
}

export function parseAssistantMessages(raw: unknown): AssistantChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  if (raw.length > ADMIN_ASSISTANT_MAX_MESSAGES) return null;
  const out: AssistantChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > ADMIN_ASSISTANT_MAX_CONTENT) return null;
    out.push({ role, content: trimmed });
  }
  if (out[out.length - 1]?.role !== "user") return null;
  return out;
}

const MODE_HINT: Record<AssistantMode, string> = {
  all: "Смешанный режим: питание и зал.",
  food: "Фокус на питании: КБЖУ, рацион, вода, вес. Зал только если прямо спрашивают.",
  gym: "Фокус на зале: сплит, нагрузка, восстановление, кардио. Еда только если прямо спрашивают.",
  week: "Фокус на недельном плане: рацион + 2–4 тренировки с днями недели.",
};

export function buildAssistantSystemPrompt(
  contextBlock: string,
  mode: AssistantMode = "all",
): string {
  return [
    "Ты персональный AI-ассистент Calorie Vision для владельца аккаунта.",
    "Помогаешь с рационом (КБЖУ, вода, вес) и планом тренировок в зале.",
    MODE_HINT[mode],
    "Отвечай по-русски. Структура: сначала 1–2 фразы вывода, потом короткий список пунктов.",
    "Опирайся только на данные пользователя ниже. Не выдумывай записи дневника или тренировок.",
    "Не ставь медицинских диагнозов. Это журнал питания/зала, не лечение.",
    "Не предлагай удалять данные и не пиши SQL/код. Если данных мало — скажи, чего не хватает.",
    "Когда предлагаешь покупки или план тренировок, В КОНЦЕ ответа добавь блок:",
    "```cv-actions",
    '{"shopping":["продукт1","продукт2"],"meals":[{"name":"Блюдо","kcal":400,"note":"ужин"}],"workoutDays":[{"day":"Пн","focus":"Грудь/трицепс","notes":"3–4 упр."}],"summary":"кратко"}',
    "```",
    "Блок cv-actions обязателен, если есть конкретные продукты или дни тренировок. Иначе можно без блока.",
    "",
    "=== Данные пользователя ===",
    contextBlock.trim() || "(контекст пуст)",
    "=== Конец данных ===",
  ].join("\n");
}

/** Strip ```cv-actions ... ``` and return clean reply + parsed actions. */
export function splitAssistantReply(raw: string): {
  reply: string;
  actions: AssistantActions | null;
} {
  const text = raw.trim();
  const match = /```cv-actions\s*([\s\S]*?)```/i.exec(text);
  if (!match) return { reply: text, actions: null };
  const reply = `${text.slice(0, match.index).trim()}\n${text.slice(match.index + match[0].length).trim()}`.trim();
  try {
    const parsed = JSON.parse(match[1]!.trim()) as unknown;
    const actions = normalizeAssistantActions(parsed);
    return { reply: reply || text.replace(match[0], "").trim(), actions };
  } catch {
    return { reply: text.replace(match[0], "").trim() || text, actions: null };
  }
}

export function normalizeAssistantActions(raw: unknown): AssistantActions | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const out: AssistantActions = {};

  if (Array.isArray(obj.shopping)) {
    const shopping = obj.shopping
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30);
    if (shopping.length) out.shopping = shopping;
  }

  if (Array.isArray(obj.meals)) {
    const meals: NonNullable<AssistantActions["meals"]> = [];
    for (const item of obj.meals.slice(0, 20)) {
      if (!item || typeof item !== "object") continue;
      const name = (item as { name?: unknown }).name;
      if (typeof name !== "string" || !name.trim()) continue;
      const kcal = (item as { kcal?: unknown }).kcal;
      const note = (item as { note?: unknown }).note;
      meals.push({
        name: name.trim().slice(0, 120),
        kcal: typeof kcal === "number" && Number.isFinite(kcal) ? Math.round(kcal) : undefined,
        note: typeof note === "string" ? note.trim().slice(0, 120) : undefined,
      });
    }
    if (meals.length) out.meals = meals;
  }

  if (Array.isArray(obj.workoutDays)) {
    const workoutDays: NonNullable<AssistantActions["workoutDays"]> = [];
    for (const item of obj.workoutDays.slice(0, 14)) {
      if (!item || typeof item !== "object") continue;
      const day = (item as { day?: unknown }).day;
      const focus = (item as { focus?: unknown }).focus;
      if (typeof day !== "string" || typeof focus !== "string") continue;
      if (!day.trim() || !focus.trim()) continue;
      const notes = (item as { notes?: unknown }).notes;
      workoutDays.push({
        day: day.trim().slice(0, 32),
        focus: focus.trim().slice(0, 120),
        notes: typeof notes === "string" ? notes.trim().slice(0, 200) : undefined,
      });
    }
    if (workoutDays.length) out.workoutDays = workoutDays;
  }

  if (typeof obj.summary === "string" && obj.summary.trim()) {
    out.summary = obj.summary.trim().slice(0, 240);
  }

  return Object.keys(out).length ? out : null;
}

export type AssistantContextInput = {
  date: string;
  today: string;
  profile: {
    sex: string | null;
    heightCm: number | null;
    birthYear: number | null;
    goal: string | null;
    goalPace: string | null;
    activityLevel: string | null;
  };
  weightKg: number | null;
  weightTrend: Array<{ date: string; kg: number }>;
  waterMl: number;
  waterTargetMl: number;
  streakDays: number | null;
  challenge: string | null;
  day: {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
    fiber: number;
    sugar: number;
    target: {
      calories: number;
      protein: number;
      fat: number;
      carbs: number;
      fiber?: number;
      sugar?: number;
    } | null;
    meals: Array<{
      dishName: string;
      calories: number;
      protein: number | null;
      fat: number | null;
      carbs: number | null;
      portionGrams: number | null;
      mealType: string | null;
    }>;
  };
  recentDays: Array<{
    date: string;
    calories: number;
    dishes: string[];
  }>;
  weekCalories: Array<{ date: string; calories: number }>;
  workouts: Array<{
    date: string;
    muscleLabels: string[];
    exerciseCount: number;
    setCount: number;
    totalLoad: number;
    cardioDistanceKm: number;
    cardioDurationSec: number;
    ended: boolean;
    note: string | null;
    exercises?: string[];
  }>;
  routines: Array<{ name: string; exerciseCount: number; weekdays?: number[] | null }>;
};

export function formatAssistantContext(input: AssistantContextInput): string {
  const lines: string[] = [];
  lines.push(`Сегодня: ${input.today}. Контекст дня: ${input.date}.`);
  const p = input.profile;
  lines.push(
    `Профиль: пол=${p.sex ?? "—"}, рост=${p.heightCm ?? "—"} см, год рождения=${p.birthYear ?? "—"}, цель=${p.goal ?? "—"}, темп=${p.goalPace ?? "—"}, активность=${p.activityLevel ?? "—"}.`,
  );
  if (input.weightKg != null) lines.push(`Вес сейчас: ${input.weightKg} кг.`);
  if (input.weightTrend.length) {
    lines.push(
      "Вес (последние записи): " +
        input.weightTrend.map((w) => `${w.date.slice(5)}=${w.kg}`).join(", "),
    );
  }
  lines.push(`Вода сегодня: ${input.waterMl} / ${input.waterTargetMl} мл.`);
  if (input.streakDays != null) lines.push(`Серия записей: ${input.streakDays} дн.`);
  if (input.challenge) lines.push(`Активный челлендж: ${input.challenge}.`);

  const d = input.day;
  const t = d.target;
  const remain =
    t != null
      ? {
          kcal: Math.max(0, Math.round(t.calories - d.calories)),
          protein: Math.max(0, Math.round((t.protein - d.protein) * 10) / 10),
          fat: Math.max(0, Math.round((t.fat - d.fat) * 10) / 10),
          carbs: Math.max(0, Math.round((t.carbs - d.carbs) * 10) / 10),
        }
      : null;
  lines.push(
    `День ${input.date}: ${d.calories} ккал` +
      (t ? ` / цель ${t.calories}` : "") +
      `; Б ${d.protein}` +
      (t ? `/${t.protein}` : "") +
      ` Ж ${d.fat}` +
      (t ? `/${t.fat}` : "") +
      ` У ${d.carbs}` +
      (t ? `/${t.carbs}` : "") +
      (d.fiber ? `; клетч. ${d.fiber}` : "") +
      (d.sugar ? `; сахар ${d.sugar}` : "") +
      `.`,
  );
  if (remain) {
    lines.push(
      `Остаток на день: ~${remain.kcal} ккал, Б ${remain.protein}, Ж ${remain.fat}, У ${remain.carbs}.`,
    );
  }
  if (d.meals.length === 0) {
    lines.push("Приёмы пищи выбранного дня: пока пусто.");
  } else {
    lines.push("Приёмы пищи выбранного дня:");
    for (const m of d.meals.slice(0, 40)) {
      const macros = [
        m.protein != null ? `Б${m.protein}` : null,
        m.fat != null ? `Ж${m.fat}` : null,
        m.carbs != null ? `У${m.carbs}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      lines.push(
        `- ${m.mealType ?? "meal"}: ${m.dishName} — ${m.calories} ккал` +
          (m.portionGrams ? `, ${m.portionGrams} г` : "") +
          (macros ? ` (${macros})` : ""),
      );
    }
  }

  if (input.recentDays.length) {
    lines.push("Недавние дни (кратко):");
    for (const day of input.recentDays.slice(0, 7)) {
      const dishes = day.dishes.slice(0, 6).join("; ") || "пусто";
      lines.push(`- ${day.date}: ${day.calories} ккал — ${dishes}`);
    }
  }

  if (input.weekCalories.length) {
    lines.push(
      "Калории за неделю контекста: " +
        input.weekCalories.map((w) => `${w.date.slice(5)}=${w.calories}`).join(", "),
    );
  }

  if (input.workouts.length === 0) {
    lines.push("Недавние тренировки: нет.");
  } else {
    lines.push("Недавние тренировки:");
    for (const w of input.workouts.slice(0, 14)) {
      const parts = [
        w.muscleLabels.join("/") || "зал",
        `${w.exerciseCount} упр.`,
        `${w.setCount} подх.`,
        w.totalLoad > 0 ? `нагрузка ${w.totalLoad}` : null,
        w.cardioDistanceKm > 0 ? `${w.cardioDistanceKm} км` : null,
        w.cardioDurationSec > 0 ? `${Math.round(w.cardioDurationSec / 60)} мин кардио` : null,
        w.ended ? "завершена" : "открыта",
        w.exercises?.length ? `упр: ${w.exercises.slice(0, 8).join(", ")}` : null,
        w.note ? `заметка: ${w.note}` : null,
      ].filter(Boolean);
      lines.push(`- ${w.date}: ${parts.join(", ")}`);
    }
  }

  if (input.routines.length) {
    lines.push(
      "Шаблоны: " +
        input.routines
          .slice(0, 10)
          .map((r) => {
            const days =
              Array.isArray(r.weekdays) && r.weekdays.length
                ? ` дни=${r.weekdays.join("/")}`
                : "";
            return `${r.name} (${r.exerciseCount} упр.${days})`;
          })
          .join("; "),
    );
  }

  return lines.join("\n");
}

export type AssistantContextSnapshot = {
  date: string;
  today: string;
  calories: number;
  targetCalories: number | null;
  remainingCalories: number | null;
  protein: number;
  targetProtein: number | null;
  waterMl: number;
  waterTargetMl: number;
  weightKg: number | null;
  streakDays: number | null;
  challenge: string | null;
  recentWorkoutLabel: string | null;
};

export function buildContextSnapshot(input: AssistantContextInput): AssistantContextSnapshot {
  const t = input.day.target;
  return {
    date: input.date,
    today: input.today,
    calories: input.day.calories,
    targetCalories: t?.calories ?? null,
    remainingCalories: t != null ? Math.max(0, Math.round(t.calories - input.day.calories)) : null,
    protein: input.day.protein,
    targetProtein: t?.protein ?? null,
    waterMl: input.waterMl,
    waterTargetMl: input.waterTargetMl,
    weightKg: input.weightKg,
    streakDays: input.streakDays,
    challenge: input.challenge,
    recentWorkoutLabel: input.workouts[0]
      ? `${input.workouts[0].date}: ${input.workouts[0].muscleLabels.join("/") || "зал"}`
      : null,
  };
}
