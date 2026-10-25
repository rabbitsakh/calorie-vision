/**
 * Chests 2.0 C4 — calm-day meter acceleration.
 * Gym session or evening check-in (mood) on the same day → +1 bonus quest-day credit.
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

/**
 * Grant optional boost credit for a calm day (idempotent).
 * Counts as an extra `quest_day` row toward the 3-day meter.
 */
export async function maybeGrantQuestDayBoost(
  userId: string,
  date: string,
): Promise<{ boosted: boolean; kind: DayBoostKind; questDayCount: number }> {
  const kind = await detectDayBoost(userId, date);
  if (!kind) {
    const questDayCount = await prisma.userReward.count({
      where: { userId, rewardKey: "quest_day" },
    });
    return { boosted: false, kind: null, questDayCount };
  }

  const sourceKey = questDayBoostSourceKey(date);
  const existing = await prisma.userReward.findUnique({
    where: { userId_sourceKey: { userId, sourceKey } },
  });
  if (!existing) {
    await prisma.userReward.create({
      data: {
        userId,
        rewardKey: "quest_day",
        source: "quest",
        sourceKey,
      },
    });
  }

  const questDayCount = await prisma.userReward.count({
    where: { userId, rewardKey: "quest_day" },
  });
  return { boosted: !existing, kind, questDayCount };
}
