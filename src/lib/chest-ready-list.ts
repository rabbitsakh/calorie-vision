/**
 * Server: list grantable (or presentable) chests for the dock queue.
 */

import { prisma } from "@/lib/prisma";
import { challengeDef } from "@/lib/challenges";
import { toDateKeyTz } from "@/lib/dates";
import {
  challengeReadyItem,
  mergeReadyQueue,
  streakReadyItem,
  weekReadyItem,
  type ReadyChestItem,
} from "@/lib/chest-ready-queue";
import { isSoftWeekPerfect } from "@/lib/chest-eligibility";
import { nextQuestChestBatchIndex } from "@/lib/chest-progress";
import {
  challengeChestSourceKey,
  QUEST_DAYS_PER_CHEST,
  streakChestSourceKey,
  weekChestSourceKey,
} from "@/lib/rewards";
import { buildStreakPayload } from "@/lib/streak-payload";
import { CELEBRATION_STREAK_MILESTONES } from "@/lib/streak-chest";

async function countOpenedQuestChests(userId: string): Promise<number> {
  return prisma.userReward.count({
    where: {
      userId,
      source: "quest",
      sourceKey: { startsWith: "quest-chest:" },
    },
  });
}

async function ownedSourceKeys(userId: string, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await prisma.userReward.findMany({
    where: { userId, sourceKey: { in: keys } },
    select: { sourceKey: true },
  });
  return new Set(rows.map((r) => r.sourceKey));
}

/**
 * Build FIFO ready queue for chests 2.0 C3.
 * Quest first, then streak / week / challenge; referral rows already granted
 * are omitted here (client inbox / present-only).
 */
export async function listReadyChests(userId: string): Promise<{
  queue: ReadyChestItem[];
  questDayCount: number;
  openedQuestChests: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const today = toDateKeyTz(new Date(), user?.timezone);

  const [questDayCount, openedQuestChests, streak] = await Promise.all([
    prisma.userReward.count({ where: { userId, rewardKey: "quest_day" } }),
    countOpenedQuestChests(userId),
    buildStreakPayload(userId, today),
  ]);

  const questReady =
    nextQuestChestBatchIndex(questDayCount, openedQuestChests, QUEST_DAYS_PER_CHEST) != null
      ? Math.max(
          0,
          Math.floor(questDayCount / QUEST_DAYS_PER_CHEST) - openedQuestChests,
        )
      : 0;

  const streakKeys = CELEBRATION_STREAK_MILESTONES.map((m) => streakChestSourceKey(m));
  const weekKey = weekChestSourceKey(streak.weekStart);
  const candidateKeys = [...streakKeys, weekKey];

  const completedChallenges = await prisma.userChallenge.findMany({
    where: {
      userId,
      completedAt: { not: null },
    },
    select: { weekStart: true, challengeKey: true },
    orderBy: { completedAt: "asc" },
    take: 12,
  });
  for (const c of completedChallenges) {
    candidateKeys.push(challengeChestSourceKey(c.weekStart, c.challengeKey));
  }

  const owned = await ownedSourceKeys(userId, candidateKeys);

  const streakItems: ReadyChestItem[] = [];
  for (const m of CELEBRATION_STREAK_MILESTONES) {
    if (streak.streak < m) continue;
    const key = streakChestSourceKey(m);
    if (owned.has(key)) continue;
    streakItems.push(streakReadyItem(m));
  }

  let weekItem: ReadyChestItem | null = null;
  if (
    isSoftWeekPerfect(streak.daysLoggedThisWeek, streak.daysInWeekSoFar) &&
    !owned.has(weekKey)
  ) {
    weekItem = weekReadyItem(streak.weekStart);
  }

  const challengeItems: ReadyChestItem[] = [];
  for (const c of completedChallenges) {
    const key = challengeChestSourceKey(c.weekStart, c.challengeKey);
    if (owned.has(key)) continue;
    const title = challengeDef(c.challengeKey)?.title;
    challengeItems.push(challengeReadyItem(c.weekStart, c.challengeKey, title));
  }

  const queue = mergeReadyQueue({
    questReadyCount: questReady,
    streak: streakItems,
    week: weekItem,
    challenge: challengeItems,
  });

  return { queue, questDayCount, openedQuestChests };
}
