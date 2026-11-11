/**
 * Chests 2.0 C4 — старый ускоритель шкалы.
 * Зал или настроение давали второй quest_day в тот же день.
 * С 3.6.13 новые бонусы выключены: шкала врала, а настроение ставилось одним тапом.
 * Тренировка с подходами снова копится отдельно, см. grantGymChestForDate.
 */

import { prisma } from "@/lib/prisma";

export function questDayBoostSourceKey(date: string): string {
  return `quest-day-boost:${date}`;
}

export type DayBoostKind = "gym" | "evening" | null;

/**
 * Detect whether the day qualifies for a meter boost (gym XOR evening is enough).
 */
export async function detectDayBoost(
  userId: string,
  date: string,
): Promise<DayBoostKind> {
  const [gymSession, note] = await Promise.all([
    prisma.workoutSession.findFirst({
      where: {
        userId,
        date,
        OR: [
          { endedAt: { not: null } },
          { exercises: { some: { sets: { some: {} } } } },
        ],
      },
      select: { id: true },
    }),
    prisma.diaryNote.findUnique({
      where: { userId_date: { userId, date } },
      select: { mood: true },
    }),
  ]);

  if (gymSession) return "gym";
  if (note?.mood != null && note.mood >= 1) return "evening";
  return null;
}

/** Новые бонусные зачёты выключены. Уже выданные строки не удаляются. */
export const GRANT_NEW_QUEST_DAY_BOOST = false;

/**
 * Раньше зал или настроение давали второй quest_day.
 * Для новых дней зачёт больше не создаётся.
 */
export async function maybeGrantQuestDayBoost(
  userId: string,
  _date: string,
): Promise<{ boosted: boolean; kind: DayBoostKind; questDayCount: number }> {
  void GRANT_NEW_QUEST_DAY_BOOST;
  const questDayCount = await prisma.userReward.count({
    where: { userId, rewardKey: "quest_day" },
  });
  return { boosted: false, kind: null, questDayCount };
}
