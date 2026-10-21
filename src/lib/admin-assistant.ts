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
  meals?: Array<{
    name: string;
    kcal?: number;
    protein?: number;
    fat?: number;
    carbs?: number;
    note?: string;
    /** Wall-clock HH:MM when the meal was eaten (user timezone). */
    time?: string;
  }>;
  /** Delete meals on targetDate matching dish name (substring). */
  deleteMeals?: Array<{ match: string }>;
  /** Patch meals on targetDate matching dish name. */
  patchMeals?: Array<{
    match: string;
    name?: string;
    kcal?: number;
    protein?: number;
    fat?: number;
    carbs?: number;
    portionGrams?: number;
  }>;
  workoutDays?: Array<{ day: string; focus: string; notes?: string }>;
  summary?: string;
  /** When true (or user asked to save), server writes meals/plan automatically. */
  apply?: boolean;
  /** Target day: YYYY-MM-DD / сегодня / завтра / Пн… */
  targetDate?: string;
  waterMl?: number;
  weightKg?: number;
  /** Replace existing weight for the day without confirm gate. */
  overwriteWeight?: boolean;
  /** Start today's planned routine as a live session. */
  startWorkout?: boolean;
};

export function parseAssistantMode(raw: unknown): AssistantMode {
  if (raw === "food" || raw === "gym" || raw === "week" || raw === "all") return raw;
  return "all";
}

/**
 * Keep the newest turns within the API budget, preferring a user-start boundary
 * so a long localStorage history (up to 80) never 400s the chat.
 */
export function truncateAssistantMessages(
  messages: AssistantChatMessage[],
  max = ADMIN_ASSISTANT_MAX_MESSAGES,
): AssistantChatMessage[] {
  if (messages.length <= max) return messages;
  let slice = messages.slice(-max);
  const firstUser = slice.findIndex((m) => m.role === "user");
  if (firstUser > 0) slice = slice.slice(firstUser);
  return slice;
}

/** Client helper: strip empties/welcome, then truncate for the API. */
export function buildAssistantHistory(
  turns: Array<{ id?: string; role: string; content?: string | null }>,
  max = ADMIN_ASSISTANT_MAX_MESSAGES,
): AssistantChatMessage[] {
  const out: AssistantChatMessage[] = [];
  for (const t of turns) {
    if (t.id === "welcome") continue;
    if (t.role !== "user" && t.role !== "assistant") continue;
    const content = String(t.content ?? "").trim();
    if (!content) continue;
    out.push({
      role: t.role,
      content: content.slice(0, ADMIN_ASSISTANT_MAX_CONTENT),
    });
  }
  return truncateAssistantMessages(out, max);
}

export function parseAssistantMessages(raw: unknown): AssistantChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: AssistantChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") return null;
    // Skip empty/placeholder turns (client may keep failed assistant shells).
    if (typeof content !== "string") continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    out.push({ role, content: trimmed.slice(0, ADMIN_ASSISTANT_MAX_CONTENT) });
  }
  const truncated = truncateAssistantMessages(out);
  if (truncated.length === 0) return null;
  if (truncated[truncated.length - 1]?.role !== "user") return null;
  return truncated;
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
  prefsBlock?: string | null,
): string {
  return [
    "Ты живой персональный AI-компаньон Calorie Vision — тёплый, конкретный, без канцелярита.",
    "Говори по-русски как умный друг в зале/на кухне: коротко, по делу, с лёгкой энергией.",
    "Сначала 1 фраза-вывод («Ок, кидаю в план», «По остатку лучше белок»), потом 2–5 пунктов.",
    MODE_HINT[mode],
    "Опирайся только на данные ниже. Не выдумывай прошлые записи. Учитывай «Не предлагает».",
    "Не ставь диагнозов. Не предлагай удалять всё подряд и не пиши SQL/код.",
    "",
    "ТЫ УМЕЕШЬ ЗАПИСЫВАТЬ: блюда (с БЖУ), правки/удаление блюд, план зала по дням, покупки, воду (мл), вес (кг), старт сегодняшней тренировки.",
    "КРИТИЧНО: если пользователь просит добавить/записать/сохранить/съел+добавь/удали/исправь — НЕЛЬЗЯ только текстом «Добавляю».",
    "Без блока ```cv-actions``` с \"apply\": true сервер НИЧЕГО не запишет. Всегда заканчивай таким блоком.",
    "Несколько блюд/единиц = несколько объектов в meals[] (2 батончика → 2 объекта; «печень и чебурек» → 2). Оцени kcal/БЖУ, если не указали.",
    "Можно совмещать действия в одном cv-actions: meals + waterMl + weightKg + shopping + workoutDays и т.д. — клиент покажет кнопки по видам.",
    "Удалить блюдо: deleteMeals:[{\"match\":\"омлет\"}]. Исправить: patchMeals:[{\"match\":\"омлет\",\"protein\":30,\"kcal\":280}].",
    "Вес: weightKg. Если на день уже есть вес — сервер спросит подтверждение; не ставь overwriteWeight сам.",
    "Совет без просьбы записать — без apply / без блока.",
    "meals.note = завтрак|обед|ужин|перекус. meals.time = HH:MM если пользователь сказал время («в 10:30»).",
    "workoutDays.day = Пн/Вт/… или сегодня/завтра.",
    "План зала (workoutDays): в notes — реальные упражнения через запятую («Жим лёжа, Разводка»). Не пиши «добавил в план» — подтвердят кнопкой «В план зала».",
    "Блюда (meals) и вода (waterMl): не пиши «добавил» / «записал» — пользователь подтвердит «В дневник» / «В воду».",
    "Покупки (shopping) и старт (startWorkout): тоже только после подтверждения.",
    "weightKg, deleteMeals, patchMeals, targetDate.",
    "",
    "Пример (обязательный хвост при записи):",
    "```cv-actions",
    '{"apply":true,"targetDate":"сегодня","meals":[{"name":"Протеин изолят","kcal":260,"protein":60,"fat":1,"carbs":2,"note":"перекус","time":"10:30"}],"summary":"перекус в 10:30 — подтверди"}',
    "```",
    "Пример плана зала (клиент покажет CTA):",
    "```cv-actions",
    '{"apply":true,"workoutDays":[{"day":"Пн","focus":"Грудь","notes":"Жим лёжа, Разводка гантелей, Отжимания"},{"day":"Ср","focus":"Спина","notes":"Тяга верхнего блока, Подтягивания"}],"summary":"план на 2 дня — подтверди"}',
    "```",
    "",
    "=== Данные пользователя ===",
    contextBlock.trim() || "(контекст пуст)",
    prefsBlock?.trim() ? `\n=== Предпочтения ===\n${prefsBlock.trim()}` : "",
    "=== Конец данных ===",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Strip ```cv-actions / ```json ... ``` (or trailing {…}) and return clean reply + actions. */
export function splitAssistantReply(raw: string): {
  reply: string;
  actions: AssistantActions | null;
} {
  const text = raw.trim();
  const match =
    /```cv-actions\s*([\s\S]*?)```/i.exec(text) ??
    /```json\s*([\s\S]*?)```/i.exec(text);

  if (match) {
    const reply =
      `${text.slice(0, match.index).trim()}\n${text.slice(match.index + match[0].length).trim()}`.trim();
    try {
      const parsed = JSON.parse(match[1]!.trim()) as unknown;
      const actions = normalizeAssistantActions(parsed);
      return { reply: reply || text.replace(match[0], "").trim(), actions };
    } catch {
      return { reply: text.replace(match[0], "").trim() || text, actions: null };
    }
  }

  // Fallback: last JSON object in the reply (models sometimes omit the fence).
  const start = text.lastIndexOf('{"apply"');
  const startAlt = start >= 0 ? start : text.lastIndexOf('{"meals"');
  if (startAlt >= 0) {
    const end = text.lastIndexOf("}");
    if (end > startAlt) {
      try {
        const parsed = JSON.parse(text.slice(startAlt, end + 1)) as unknown;
        const actions = normalizeAssistantActions(parsed);
        if (actions) {
          return { reply: text.slice(0, startAlt).trim() || text, actions };
        }
      } catch {
        // ignore
      }
    }
  }

  return { reply: text, actions: null };
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
      const row = item as Record<string, unknown>;
      const name = row.name;
      if (typeof name !== "string" || !name.trim()) continue;
      const num = (v: unknown) =>
        typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : undefined;
      const kcal = row.kcal;
      const timeRaw =
        typeof row.time === "string"
          ? row.time
          : typeof row.eatenAt === "string"
            ? row.eatenAt
            : undefined;
      let time: string | undefined;
      if (typeof timeRaw === "string") {
        const hhmm = /^(\d{1,2})[:.](\d{2})$/.exec(timeRaw.trim());
        if (hhmm) {
          const h = Number(hhmm[1]);
          const mi = Number(hhmm[2]);
          if (Number.isFinite(h) && Number.isFinite(mi) && h <= 23 && mi <= 59) {
            time = `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
          }
        }
      }
      meals.push({
        name: name.trim().slice(0, 120),
        kcal: typeof kcal === "number" && Number.isFinite(kcal) ? Math.round(kcal) : undefined,
        protein: num(row.protein),
        fat: num(row.fat),
        carbs: num(row.carbs),
        note: typeof row.note === "string" ? row.note.trim().slice(0, 120) : undefined,
        ...(time ? { time } : {}),
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

  if (obj.apply === true) out.apply = true;
  if (typeof obj.targetDate === "string" && obj.targetDate.trim()) {
    out.targetDate = obj.targetDate.trim().slice(0, 32);
  }
  if (typeof obj.waterMl === "number" && Number.isFinite(obj.waterMl)) {
    out.waterMl = Math.round(obj.waterMl);
  }
  if (typeof obj.weightKg === "number" && Number.isFinite(obj.weightKg)) {
    out.weightKg = Math.round(obj.weightKg * 10) / 10;
  }
  if (obj.overwriteWeight === true) out.overwriteWeight = true;
  if (obj.startWorkout === true) out.startWorkout = true;

  if (Array.isArray(obj.deleteMeals)) {
    const deleteMeals: NonNullable<AssistantActions["deleteMeals"]> = [];
    for (const item of obj.deleteMeals.slice(0, 20)) {
      if (!item || typeof item !== "object") continue;
      const match = (item as { match?: unknown }).match;
      if (typeof match !== "string" || !match.trim()) continue;
      deleteMeals.push({ match: match.trim().slice(0, 120) });
    }
    if (deleteMeals.length) out.deleteMeals = deleteMeals;
  }

  if (Array.isArray(obj.patchMeals)) {
    const patchMeals: NonNullable<AssistantActions["patchMeals"]> = [];
    const num = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : undefined;
    for (const item of obj.patchMeals.slice(0, 20)) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (typeof row.match !== "string" || !row.match.trim()) continue;
      const kcal = row.kcal;
      patchMeals.push({
        match: row.match.trim().slice(0, 120),
        name: typeof row.name === "string" ? row.name.trim().slice(0, 120) : undefined,
        kcal: typeof kcal === "number" && Number.isFinite(kcal) ? Math.round(kcal) : undefined,
        protein: num(row.protein),
        fat: num(row.fat),
        carbs: num(row.carbs),
        portionGrams: num(row.portionGrams),
      });
    }
    if (patchMeals.length) out.patchMeals = patchMeals;
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
