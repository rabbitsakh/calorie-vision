/**
 * Admin-only AI coach: prompt + message validation (Wave: personal assistant).
 */

export const ADMIN_ASSISTANT_MAX_MESSAGES = 24;
export const ADMIN_ASSISTANT_MAX_CONTENT = 4000;

export type AssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};

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

export function buildAssistantSystemPrompt(contextBlock: string): string {
  return [
    "Ты персональный AI-ассистент Calorie Vision для владельца аккаунта.",
    "Помогаешь с рационом (КБЖУ, вода, вес) и планом тренировок в зале.",
    "Отвечай по-русски, коротко и по делу: 2–6 предложений или короткий список.",
    "Опирайся только на данные пользователя ниже. Не выдумывай записи дневника или тренировок.",
    "Не ставь медицинских диагнозов. Это журнал питания/зала, не лечение.",
    "Не предлагай удалять данные и не пиши SQL/код. Если данных мало — скажи, чего не хватает.",
    "Можешь предложить конкретный план еды на день или схему тренировки на неделю текстом.",
    "",
    "=== Данные пользователя ===",
    contextBlock.trim() || "(контекст пуст)",
    "=== Конец данных ===",
  ].join("\n");
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
  waterMl: number;
  waterTargetMl: number;
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
  }>;
  routines: Array<{ name: string; exerciseCount: number }>;
};

export function formatAssistantContext(input: AssistantContextInput): string {
  const lines: string[] = [];
  lines.push(`Сегодня: ${input.today}. Контекст дня: ${input.date}.`);
  const p = input.profile;
  lines.push(
    `Профиль: пол=${p.sex ?? "—"}, рост=${p.heightCm ?? "—"} см, год рождения=${p.birthYear ?? "—"}, цель=${p.goal ?? "—"}, темп=${p.goalPace ?? "—"}, активность=${p.activityLevel ?? "—"}.`,
  );
  if (input.weightKg != null) lines.push(`Вес: ${input.weightKg} кг.`);
  lines.push(`Вода: ${input.waterMl} / ${input.waterTargetMl} мл.`);

  const d = input.day;
  const t = d.target;
  lines.push(
    `День ${input.date}: ${d.calories} ккал` +
      (t ? ` / цель ${t.calories}` : "") +
      `; Б ${d.protein}` +
      (t ? `/${t.protein}` : "") +
      ` Ж ${d.fat}` +
      (t ? `/${t.fat}` : "") +
      ` У ${d.carbs}` +
      (t ? `/${t.carbs}` : "") +
      `.`,
  );
  if (d.meals.length === 0) {
    lines.push("Приёмы пищи: пока пусто.");
  } else {
    lines.push("Приёмы пищи:");
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

  if (input.weekCalories.length) {
    lines.push(
      "Калории за неделю: " +
        input.weekCalories.map((w) => `${w.date.slice(5)}=${w.calories}`).join(", "),
    );
  }

  if (input.workouts.length === 0) {
    lines.push("Недавние тренировки: нет.");
  } else {
    lines.push("Недавние тренировки:");
    for (const w of input.workouts.slice(0, 12)) {
      const parts = [
        w.muscleLabels.join("/") || "зал",
        `${w.exerciseCount} упр.`,
        `${w.setCount} подх.`,
        w.totalLoad > 0 ? `нагрузка ${w.totalLoad}` : null,
        w.cardioDistanceKm > 0 ? `${w.cardioDistanceKm} км` : null,
        w.cardioDurationSec > 0 ? `${Math.round(w.cardioDurationSec / 60)} мин кардио` : null,
        w.ended ? "завершена" : "открыта",
        w.note ? `заметка: ${w.note}` : null,
      ].filter(Boolean);
      lines.push(`- ${w.date}: ${parts.join(", ")}`);
    }
  }

  if (input.routines.length) {
    lines.push(
      "Шаблоны: " +
        input.routines
          .slice(0, 8)
          .map((r) => `${r.name} (${r.exerciseCount} упр.)`)
          .join("; "),
    );
  }

  return lines.join("\n");
}
