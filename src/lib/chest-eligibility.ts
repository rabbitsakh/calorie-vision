import { prisma } from "@/lib/prisma";
import { toDateKeyTz } from "@/lib/dates";
import { computeDailyQuests } from "@/lib/daily-quests";
import { buildStreakPayload } from "@/lib/streak-payload";
import { CELEBRATION_STREAK_MILESTONES } from "@/lib/streak-chest";
import { resolveWaterTargetMl } from "@/lib/water-target";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDateKey(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m! - 1 &&
    dt.getUTCDate() === d
  );
}

/** Soft week chest: Mon..today all logged and at least 5 days so far. */
export function isSoftWeekPerfect(logged: number, daysSoFar: number): boolean {
  return daysSoFar >= 5 && logged === daysSoFar && logged > 0;
}

export async function assertChallengeChestEligible(
  userId: string,
  weekStart: string,
  challengeKey: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!isIsoDateKey(weekStart) || !challengeKey) {
    return { ok: false, error: "Нужны weekStart и challengeKey", status: 400 };
  }
  const challenge = await prisma.userChallenge.findFirst({
    where: {
      userId,
      weekStart,
      challengeKey,
      completedAt: { not: null },
    },
    select: { id: true },
  });
  if (!challenge) {
    return { ok: false, error: "Челлендж ещё не закрыт", status: 400 };
  }
  return { ok: true };
}

export async function assertStreakChestEligible(
  userId: string,
  milestone: number,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!Number.isFinite(milestone) || !CELEBRATION_STREAK_MILESTONES.includes(milestone)) {
    return { ok: false, error: "Неверная веха серии", status: 400 };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const today = toDateKeyTz(new Date(), user?.timezone);
  const streak = await buildStreakPayload(userId, today);
  if (streak.streak < milestone) {
    return { ok: false, error: "Серия ещё не достигла этой вехи", status: 400 };
  }
  return { ok: true };
}

export async function assertWeekChestEligible(
  userId: string,
  weekStart: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!isIsoDateKey(weekStart)) {
    return { ok: false, error: "Нужен weekStart", status: 400 };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const today = toDateKeyTz(new Date(), user?.timezone);
  const streak = await buildStreakPayload(userId, today);
  if (streak.weekStart !== weekStart) {
    return { ok: false, error: "Сундук только за текущую неделю", status: 400 };
  }
  if (!isSoftWeekPerfect(streak.daysLoggedThisWeek, streak.daysInWeekSoFar)) {
    return { ok: false, error: "Неделя ещё не закрыта мягко", status: 400 };
  }
  return { ok: true };
}

export async function assertQuestDayEligible(
  userId: string,
  date: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!isIsoDateKey(date)) {
    return { ok: false, error: "Нужна date", status: 400 };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true, waterTargetMl: true },
  });
  const today = toDateKeyTz(new Date(), user?.timezone);
  if (date > today) {
    return { ok: false, error: "Нельзя закрыть будущий день", status: 400 };
  }

  const [mealCount, waterAgg] = await Promise.all([
    prisma.mealEntry.count({ where: { userId, date } }),
    prisma.waterEntry.aggregate({
      where: { userId, date },
      _sum: { ml: true },
    }),
  ]);
  const waterTarget = resolveWaterTargetMl(user?.waterTargetMl);
  const waterMl = waterAgg._sum.ml ?? 0;
  const { allDone } = computeDailyQuests({
    mealCount,
    waterMl,
    waterTarget,
  });
  if (!allDone) {
    return { ok: false, error: "Квесты дня ещё не выполнены", status: 400 };
  }
  return { ok: true };
}
