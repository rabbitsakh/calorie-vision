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
import { listReadyChests } from "@/lib/chest-ready-list";
import type { ReadyChestItem } from "@/lib/chest-ready-queue";
import { grantChestReward, markQuestDayComplete, type GrantChestResult } from "@/lib/reward-grant";
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

async function ownedUniqueCount(userId: string): Promise<number> {
  const rows = await prisma.userReward.findMany({
    where: {
      userId,
      NOT: { rewardKey: "quest_day" },
    },
    select: { rewardKey: true },
  });
  return new Set(rows.map((r) => r.rewardKey)).size;
}

async function buildChestResponse(userId: string) {
  const [{ queue, questDayCount, openedQuestChests }, ownedUnique] = await Promise.all([
    listReadyChests(userId),
    ownedUniqueCount(userId),
  ]);
  const chest = buildChestMeter({
    questDayCount,
    openedQuestChests,
    questDaysPerChest: QUEST_DAYS_PER_CHEST,
    ownedCount: ownedUnique,
    queue,
  });
  return {
    questDayCount,
    questDaysPerChest: QUEST_DAYS_PER_CHEST,
    openedQuestChests,
    readyCount: chest.readyCount,
    nextChestIn: chest.nextIn,
    chest,
    metaNext: nextMetaProgress(ownedUnique),
    ownedCount: ownedUnique,
  };
}

type GrantOrError =
  | GrantChestResult
  | { newlyGranted: false; reward: null; metaRewards?: undefined }
  | { error: string; status: number };

async function grantFromReadyItem(userId: string, head: ReadyChestItem): Promise<GrantOrError> {
  if (head.source === "quest") {
    const questDayCount = await prisma.userReward.count({
      where: { userId, rewardKey: "quest_day" },
    });
    const openedQuestChests = await prisma.userReward.count({
      where: {
        userId,
        source: "quest",
        sourceKey: { startsWith: "quest-chest:" },
      },
    });
    const batchIndex = nextQuestChestBatchIndex(
      questDayCount,
      openedQuestChests,
      QUEST_DAYS_PER_CHEST,
    );
    if (batchIndex == null) {
      return { newlyGranted: false, reward: null };
    }
    const sourceKey = questChestSourceKey(batchIndex);
    return grantChestReward(userId, "quest", sourceKey, sourceKey);
  }

  if (head.source === "streak") {
    const milestone = head.milestone ?? Number(head.sourceKey.split(":")[1]);
    const eligible = await assertStreakChestEligible(userId, milestone);
    if (!eligible.ok) {
      return { error: eligible.error, status: eligible.status };
    }
    const sourceKey = streakChestSourceKey(milestone);
    return grantChestReward(userId, "streak", sourceKey, sourceKey);
  }

  if (head.source === "week") {
    const weekStart = head.weekStart ?? head.sourceKey.replace(/^week:/, "");
    const eligible = await assertWeekChestEligible(userId, weekStart);
    if (!eligible.ok) {
      return { error: eligible.error, status: eligible.status };
    }
    const sourceKey = weekChestSourceKey(weekStart);
    return grantChestReward(userId, "week", sourceKey, sourceKey);
  }

  if (head.source === "challenge") {
    const weekStart = head.weekStart ?? "";
    const challengeKey = head.challengeKey ?? "";
    const eligible = await assertChallengeChestEligible(userId, weekStart, challengeKey);
    if (!eligible.ok) {
      return { error: eligible.error, status: eligible.status };
    }
    const sourceKey = challengeChestSourceKey(weekStart, challengeKey);
    return grantChestReward(userId, "challenge", sourceKey, sourceKey);
  }

  return { error: "Неизвестный источник в очереди", status: 400 };
}

function isGrantError(
  value: GrantOrError,
): value is { error: string; status: number } {
  return "error" in value && typeof value.error === "string";
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

    const chestPayload = await buildChestResponse(session.user.id);

    return NextResponse.json({
      rewards,
      total: REWARD_DEFS.length,
      ...chestPayload,
    });
  } catch (error) {
    console.error("rewards GET", error);
    return NextResponse.json({ error: "Не удалось загрузить награды" }, { status: 500 });
  }
}

type GrantBody = {
  source?: ChestSource | "next";
  /** Chests 2.0: mark calm day vs open ready chest. */
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
    const source = (body.source ?? "challenge") as ChestSource | "next";
    const userId = session.user.id;

    // C3 — open head of unified ready queue (ChestDock «Открыть»).
    if (source === "next") {
      const { queue } = await listReadyChests(userId);
      const head = queue[0];
      if (!head) {
        const chestPayload = await buildChestResponse(userId);
        return NextResponse.json({
          newlyGranted: false,
          reward: null,
          ...chestPayload,
          error: "Нет готового сундука",
        });
      }
      const granted = await grantFromReadyItem(userId, head);
      if (isGrantError(granted)) {
        return NextResponse.json({ error: granted.error }, { status: granted.status });
      }
      const chestPayload = await buildChestResponse(userId);
      return NextResponse.json({ ...granted, ...chestPayload });
    }

    if (source === "challenge") {
      const weekStart = body.weekStart?.trim() ?? "";
      const challengeKey = body.challengeKey?.trim() ?? "";
      const eligible = await assertChallengeChestEligible(userId, weekStart, challengeKey);
      if (!eligible.ok) {
        return NextResponse.json({ error: eligible.error }, { status: eligible.status });
      }
      const sourceKey = challengeChestSourceKey(weekStart, challengeKey);
      const result = await grantChestReward(userId, "challenge", sourceKey, sourceKey);
      const chestPayload = await buildChestResponse(userId);
      return NextResponse.json({ ...result, ...chestPayload });
    }

    if (source === "streak") {
      const milestone = Number(body.milestone);
      const eligible = await assertStreakChestEligible(userId, milestone);
      if (!eligible.ok) {
        return NextResponse.json({ error: eligible.error }, { status: eligible.status });
      }
      const sourceKey = streakChestSourceKey(milestone);
      const result = await grantChestReward(userId, "streak", sourceKey, sourceKey);
      const chestPayload = await buildChestResponse(userId);
      return NextResponse.json({ ...result, ...chestPayload });
    }

    if (source === "week") {
      const weekStart = body.weekStart?.trim() ?? "";
      const eligible = await assertWeekChestEligible(userId, weekStart);
      if (!eligible.ok) {
        return NextResponse.json({ error: eligible.error }, { status: eligible.status });
      }
      const sourceKey = weekChestSourceKey(weekStart);
      const result = await grantChestReward(userId, "week", sourceKey, sourceKey);
      const chestPayload = await buildChestResponse(userId);
      return NextResponse.json({ ...result, ...chestPayload });
    }

    if (source === "quest") {
      const action = body.action === "open" ? "open" : "mark";
      const date = body.date?.trim() ?? "";

      if (action === "open") {
        // Prefer quest head; fall back to any ready (same as next).
        const { queue } = await listReadyChests(userId);
        const head = queue.find((i) => i.source === "quest") ?? queue[0];
        if (!head) {
          const chestPayload = await buildChestResponse(userId);
          return NextResponse.json({
            newlyGranted: false,
            reward: null,
            ...chestPayload,
            error: "Нет готового сундука",
          });
        }
        const granted = await grantFromReadyItem(userId, head);
        if (isGrantError(granted)) {
          return NextResponse.json({ error: granted.error }, { status: granted.status });
        }
        const chestPayload = await buildChestResponse(userId);
        return NextResponse.json({ ...granted, ...chestPayload });
      }

      const eligible = await assertQuestDayEligible(userId, date);
      if (!eligible.ok) {
        return NextResponse.json({ error: eligible.error }, { status: eligible.status });
      }
      const dayKey = questDaySourceKey(date);
      await markQuestDayComplete(userId, date, dayKey);
      const chestPayload = await buildChestResponse(userId);
      return NextResponse.json({
        newlyGranted: false,
        reward: null,
        ...chestPayload,
      });
    }

    return NextResponse.json({ error: "Неизвестный источник сундука" }, { status: 400 });
  } catch (error) {
    console.error("rewards POST", error);
    return NextResponse.json({ error: "Не удалось открыть сундук" }, { status: 500 });
  }
}
