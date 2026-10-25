import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import {
  assertChallengeChestEligible,
  assertQuestDayEligible,
  assertStreakChestEligible,
  assertWeekChestEligible,
} from "@/lib/chest-eligibility";
import { buildChestMeter, nextQuestChestBatchIndex } from "@/lib/chest-progress";
import { grantChestReward, markQuestDayComplete } from "@/lib/reward-grant";
import {
  challengeChestSourceKey,
  QUEST_DAYS_PER_CHEST,
  questChestSourceKey,
  questDaySourceKey,
  REWARD_DEFS,
  nextMetaProgress,
  serializeReward,
  streakChestSourceKey,
  weekChestSourceKey,
  type ChestSource,
} from "@/lib/rewards";

export const dynamic = "force-dynamic";

async function countOpenedQuestChests(userId: string): Promise<number> {
  return prisma.userReward.count({
    where: {
      userId,
      source: "quest",
      sourceKey: { startsWith: "quest-chest:" },
    },
  });
}

export async function GET() {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const rows = await prisma.userReward.findMany({
      where: {
        userId: session.user.id,
        NOT: { rewardKey: "quest_day" },
      },
      orderBy: { unlockedAt: "desc" },
    });
    const byKey = new Map(rows.map((r) => [r.rewardKey, r]));

    const rewards = REWARD_DEFS.map((def) => {
      const row = byKey.get(def.key);
      return serializeReward(
        def,
        row
          ? { unlockedAt: row.unlockedAt, source: row.source, sourceKey: row.sourceKey }
          : undefined,
      );
    });

    const ownedUnique = rewards.filter((r) => r.unlocked).length;
    const questDayCount = await prisma.userReward.count({
      where: { userId: session.user.id, rewardKey: "quest_day" },
    });
    const openedQuestChests = await countOpenedQuestChests(session.user.id);
    const chest = buildChestMeter({
      questDayCount,
      openedQuestChests,
      questDaysPerChest: QUEST_DAYS_PER_CHEST,
      ownedCount: ownedUnique,
    });

    return NextResponse.json({
      rewards,
      ownedCount: ownedUnique,
      total: REWARD_DEFS.length,
      questDayCount,
      questDaysPerChest: QUEST_DAYS_PER_CHEST,
      openedQuestChests,
      readyCount: chest.readyCount,
      nextChestIn: chest.nextIn,
      chest,
      metaNext: nextMetaProgress(ownedUnique),
    });
  } catch (error) {
    console.error("rewards GET", error);
    return NextResponse.json({ error: "Не удалось загрузить награды" }, { status: 500 });
  }
}

type GrantBody = {
  source?: ChestSource;
  /** Chests 2.0: mark calm day vs open ready chest (quest only). */
  action?: "mark" | "open";
  weekStart?: string;
  challengeKey?: string;
  milestone?: number;
  date?: string;
};

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json().catch(() => ({}))) as GrantBody;
    const source = (body.source ?? "challenge") as ChestSource;
    const userId = session.user.id;

    if (source === "challenge") {
      const weekStart = body.weekStart?.trim() ?? "";
      const challengeKey = body.challengeKey?.trim() ?? "";
      const eligible = await assertChallengeChestEligible(userId, weekStart, challengeKey);
      if (!eligible.ok) {
        return NextResponse.json({ error: eligible.error }, { status: eligible.status });
      }
      const sourceKey = challengeChestSourceKey(weekStart, challengeKey);
      const result = await grantChestReward(userId, "challenge", sourceKey, sourceKey);
      return NextResponse.json(result);
    }

    if (source === "streak") {
      const milestone = Number(body.milestone);
      const eligible = await assertStreakChestEligible(userId, milestone);
      if (!eligible.ok) {
        return NextResponse.json({ error: eligible.error }, { status: eligible.status });
      }
      const sourceKey = streakChestSourceKey(milestone);
      const result = await grantChestReward(userId, "streak", sourceKey, sourceKey);
      return NextResponse.json(result);
    }

    if (source === "week") {
      const weekStart = body.weekStart?.trim() ?? "";
      const eligible = await assertWeekChestEligible(userId, weekStart);
      if (!eligible.ok) {
        return NextResponse.json({ error: eligible.error }, { status: eligible.status });
      }
      const sourceKey = weekChestSourceKey(weekStart);
      const result = await grantChestReward(userId, "week", sourceKey, sourceKey);
      return NextResponse.json(result);
    }

    if (source === "quest") {
      const action = body.action === "open" ? "open" : "mark";
      const date = body.date?.trim() ?? "";

      if (action === "open") {
        // Open does not require today's quest eligibility — only earned unopened batches.
        const questDayCount = await prisma.userReward.count({
          where: { userId, rewardKey: "quest_day" },
        });
        const openedQuestChests = await countOpenedQuestChests(userId);
        const batchIndex = nextQuestChestBatchIndex(
          questDayCount,
          openedQuestChests,
          QUEST_DAYS_PER_CHEST,
        );
        if (batchIndex == null) {
          const chest = buildChestMeter({
            questDayCount,
            openedQuestChests,
            questDaysPerChest: QUEST_DAYS_PER_CHEST,
          });
          return NextResponse.json({
            newlyGranted: false,
            reward: null,
            questDayCount,
            questDaysPerChest: QUEST_DAYS_PER_CHEST,
            openedQuestChests,
            readyCount: chest.readyCount,
            nextChestIn: chest.nextIn,
            chest,
            error: "Нет готового сундука",
          });
        }
        const sourceKey = questChestSourceKey(batchIndex);
        const result = await grantChestReward(userId, "quest", sourceKey, sourceKey);
        const openedAfter = await countOpenedQuestChests(userId);
        const chest = buildChestMeter({
          questDayCount,
          openedQuestChests: openedAfter,
          questDaysPerChest: QUEST_DAYS_PER_CHEST,
        });
        return NextResponse.json({
          ...result,
          questDayCount,
          questDaysPerChest: QUEST_DAYS_PER_CHEST,
          openedQuestChests: openedAfter,
          readyCount: chest.readyCount,
          nextChestIn: chest.nextIn,
          chest,
        });
      }

      // mark — record calm day; do not auto-grant (open is explicit via ChestDock).
      const eligible = await assertQuestDayEligible(userId, date);
      if (!eligible.ok) {
        return NextResponse.json({ error: eligible.error }, { status: eligible.status });
      }
      const dayKey = questDaySourceKey(date);
      const { questDayCount } = await markQuestDayComplete(userId, date, dayKey);
      const openedQuestChests = await countOpenedQuestChests(userId);
      const chest = buildChestMeter({
        questDayCount,
        openedQuestChests,
        questDaysPerChest: QUEST_DAYS_PER_CHEST,
      });
      return NextResponse.json({
        newlyGranted: false,
        reward: null,
        questDayCount,
        questDaysPerChest: QUEST_DAYS_PER_CHEST,
        openedQuestChests,
        readyCount: chest.readyCount,
        nextChestIn: chest.nextIn,
        chest,
      });
    }

    return NextResponse.json({ error: "Неизвестный источник сундука" }, { status: 400 });
  } catch (error) {
    console.error("rewards POST", error);
    return NextResponse.json({ error: "Не удалось открыть сундук" }, { status: 500 });
  }
}
