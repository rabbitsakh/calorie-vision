/**
 * Soft motivation voice — shared Russian copy without shame/pressure framing.
 */

import { pluralDays } from "@/lib/russian-text";

export function streakAtRiskTitle(days: number, compact = false): string {
  const n = Math.max(0, Math.round(days));
  if (compact) {
    return `Серия ${n} ${pluralDays(n)} ждёт запись`;
  }
  return `Серия ${n} ${pluralDays(n)} ждёт одну запись`;
}

export function streakAtRiskBody(): string {
  return "Одна отметка до полуночи сохранит ритм — без давления.";
}

export function streakAtRiskPushTitle(days: number, variantB: boolean): string {
  const n = Math.max(0, Math.round(days));
  return variantB
    ? `Серия ${n} дн. ждёт вас сегодня`
    : `Серия ${n} дн. — одна запись сохранит ритм`;
}

export function breakfastStreakBody(days: number, variantB: boolean): string {
  const n = Math.max(0, Math.round(days));
  return variantB
    ? `Серия ${n} дн. — отметьте завтрак, когда удобно.`
    : `Серия ${n} дн. — завтрак закроет день в ритме.`;
}

export function emptyMealSlotTitle(meal: "lunch" | "dinner", variantB: boolean): string {
  if (meal === "lunch") {
    return variantB ? "Пора обедать" : "Обед ещё впереди";
  }
  return variantB ? "Ужин ещё впереди" : "Время ужина";
}

export function undereatSuggestionTip(pctCalories: number): string {
  if (pctCalories < 30) {
    return "Пока мало записей — полноценный обед или ужин помогут добрать день.";
  }
  return "К цели ещё есть запас — следующий приём можно добавить без спешки.";
}

export function aggressiveDeficitTip(when: string, abs: number): string {
  return `${when} заметно ниже цели (−${abs} ккал). Лучше держать мягкий дефицит, без жёстких урезаний.`;
}

export function freezeBannerCopy(): string {
  return "Вчера не было записей — можно мягко сохранить серию заморозкой (1 раз в неделю).";
}

/** Soft return after a miss when freeze is already used / unavailable. */
export function softRecoveryTitle(): string {
  return "Спокойный новый старт";
}

export function softRecoveryBody(): string {
  return "Вчера был пропуск — одна запись сегодня снова откроет день, без давления.";
}

/** Monday splash / server tip from last-week logging stats. */
export function mondayWeekWrapTip(daysLogged: number, daysInWeek = 7): string {
  const logged = Math.max(0, Math.min(daysInWeek, Math.round(daysLogged)));
  if (logged >= 5) {
    return `Прошлая неделя: ${logged} из ${daysInWeek} дней. Новая неделя — свежий старт.`;
  }
  if (logged >= 1) {
    return `Прошлая неделя: ${logged} из ${daysInWeek} дней с записями. Сегодня можно начать спокойно.`;
  }
  return "Новая неделя — достаточно одного приёма, чтобы войти в ритм.";
}

/** Soft week ritual on Plan: Sunday evening or Monday morning (local weekday 0=Sun). */
export type WeekRitualWindow = "sunday-evening" | "monday-morning";

export function resolveWeekRitualWindow(weekday: number, hour: number): WeekRitualWindow | null {
  const h = Number.isFinite(hour) ? ((Math.floor(hour) % 24) + 24) % 24 : 12;
  const d = Number.isFinite(weekday) ? Math.trunc(weekday) : -1;
  if (d === 0 && h >= 17) return "sunday-evening";
  if (d === 1 && h < 12) return "monday-morning";
  return null;
}

export function weekRitualCopy(
  window: WeekRitualWindow,
  daysLogged: number,
): { title: string; body: string } {
  const n = Math.max(0, Math.min(7, Math.round(daysLogged)));
  if (window === "sunday-evening") {
    if (n >= 5) {
      return {
        title: "Неделя почти дома",
        body: `Уже ${n} дней с записями — можно спокойно закрыть день и не торопить себя.`,
      };
    }
    return {
      title: "Неделя почти дома",
      body: "Сколько успели — уже ритм. Вечер без оценок: одна запись или просто отдых.",
    };
  }
  return {
    title: "Мягкий старт недели",
    body: mondayWeekWrapTip(n),
  };
}
