/**
 * Wave M: rule-based weekly gym + ration digest (optional GigaChat tip separate).
 * Non-chatbot: one headline + 1–2 concrete next-week steps.
 */

export type WeeklyGymRationContext = {
  weekLabel: string;
  daysLogged: number;
  avgCalories: number;
  calorieTarget: number | null;
  avgProtein: number;
  proteinTarget: number | null;
  sessionCount: number;
  weeklyTonnage: number;
  weekTrendPct: number | null;
  streak: number;
};

export type WeeklyGymRationDigest = {
  headline: string;
  steps: string[];
};

function proteinGapG(ctx: WeeklyGymRationContext): number | null {
  if (ctx.proteinTarget == null || ctx.proteinTarget <= 0 || ctx.avgProtein <= 0) {
    return null;
  }
  return Math.round(ctx.proteinTarget - ctx.avgProtein);
}

function calorieGapPct(ctx: WeeklyGymRationContext): number | null {
  if (ctx.calorieTarget == null || ctx.calorieTarget <= 0 || ctx.avgCalories <= 0) {
    return null;
  }
  return Math.round(((ctx.avgCalories - ctx.calorieTarget) / ctx.calorieTarget) * 100);
}

/**
 * Build a short weekly focus card. Returns null when the week has no ration and no gym.
 */
export function buildWeeklyGymRationDigest(
  ctx: WeeklyGymRationContext,
): WeeklyGymRationDigest | null {
  if (ctx.daysLogged <= 0 && ctx.sessionCount <= 0) return null;

  const steps: string[] = [];
  let headline = "Фокус на следующую неделю";

  const pGap = proteinGapG(ctx);
  const cGap = calorieGapPct(ctx);
  const hasGym = ctx.sessionCount > 0;
  const trendDown =
    ctx.weekTrendPct != null && Number.isFinite(ctx.weekTrendPct) && ctx.weekTrendPct <= -8;

  if (hasGym && pGap != null && pGap >= 15) {
    headline = "Зал был — доберите белок";
    steps.push(
      `После тренировки цель по белку ближе: сейчас ~${Math.round(ctx.avgProtein)} г/день, нужно ~${Math.round(ctx.proteinTarget!)} г.`,
    );
  } else if (hasGym && trendDown) {
    headline = "Нагрузка чуть просела";
    steps.push(
      `На этой неделе ${ctx.sessionCount} ${sessionWord(ctx.sessionCount)} — держите тот же ритм, без гонки за тоннажем.`,
    );
  } else if (hasGym) {
    headline = "Зал и рацион в одном ритме";
    steps.push(
      `${ctx.sessionCount} ${sessionWord(ctx.sessionCount)} · ${Math.round(ctx.weeklyTonnage)} кг·повт — зафиксируйте следующий день тренировки в плане.`,
    );
  } else if (ctx.daysLogged >= 1 && ctx.daysLogged < 4) {
    headline = "Сначала регулярность лога";
    steps.push(
      `Записей ${ctx.daysLogged} из 7 — цель на неделю: ещё 2–3 дня с хотя бы одним приёмом.`,
    );
  } else if (ctx.daysLogged >= 5) {
    headline = "Неделя собрана";
    steps.push(`Дневник ${ctx.daysLogged}/7 — сохраните темп: лог до правок.`);
  } else {
    headline = "Фокус на следующую неделю";
    steps.push(`Дневник ${ctx.daysLogged}/7 — один полный день уже двигает серию.`);
  }

  // Second step: complementary signal (protein / kcal / gym start / streak).
  if (steps.length < 2) {
    if (!hasGym && ctx.daysLogged >= 3) {
      steps.push("Если есть силы — одна короткая силовая или кардио на неделе усилит прогресс.");
    } else if (hasGym && pGap != null && pGap >= 15 && !steps[0]!.includes("белк")) {
      steps.push(`Белок: запас ~${pGap} г/день до цели — удобно закрыть после зала.`);
    } else if (cGap != null && Math.abs(cGap) >= 12) {
      if (cGap > 0) {
        steps.push(`Среднее ккал выше цели (~${cGap}%) — без жёсткости: чуть меньше перекусов в 1–2 днях.`);
      } else {
        steps.push(`Среднее ккал ниже цели (~${Math.abs(cGap)}%) — добавьте плотный приём в тренировочный день.`);
      }
    } else if (ctx.streak >= 3) {
      steps.push(`Серия ${ctx.streak} дн. — не ломайте её пустым днём.`);
    } else if (hasGym && pGap != null && pGap > -10 && pGap < 15) {
      steps.push("Белок рядом с целью — повторите тот же паттерн приёмов после зала.");
    } else {
      steps.push("Один конкретный шаг: отметьте завтрашний план еды или тренировки заранее.");
    }
  }

  return {
    headline,
    steps: steps.slice(0, 2),
  };
}

function sessionWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "тренировка";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "тренировки";
  return "тренировок";
}

/** Compact fallback tip when GigaChat is unavailable (one sentence). */
export function ruleWeeklyDigestTip(digest: WeeklyGymRationDigest): string {
  const first = digest.steps[0] ?? digest.headline;
  if (first.length <= 160) return first;
  return digest.headline;
}
