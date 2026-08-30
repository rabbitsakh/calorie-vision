import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import {
  challengeChestSourceKey,
  pickRewardKey,
  REWARD_DEFS,
  rewardDef,
  serializeReward,
} from "@/lib/rewards";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const rows = await prisma.userReward.findMany({
      where: { userId: session.user.id },
      orderBy: { unlockedAt: "desc" },
    });
    const byKey = new Map(rows.map((r) => [r.rewardKey, r]));

    const rewards = REWARD_DEFS.map((def) => {
      const row = byKey.get(def.key);
      return serializeReward(def, row
        ? { unlockedAt: row.unlockedAt, source: row.source, sourceKey: row.sourceKey }
        : undefined);
    });

    return NextResponse.json({
      rewards,
      ownedCount: rows.length,
      total: REWARD_DEFS.length,
    });
  } catch (error) {
    console.error("rewards GET", error);
    return NextResponse.json({ error: "Не удалось загрузить награды" }, { status: 500 });
  }
}

type GrantBody = {
  source?: string;
  weekStart?: string;
  challengeKey?: string;
  sourceKey?: string;
};

/**
 * Grant chest loot for a completed weekly challenge (idempotent per sourceKey).
 */
export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json().catch(() => ({}))) as GrantBody;
    const source = body.source ?? "challenge";

    if (source !== "challenge") {
      return NextResponse.json({ error: "Пока только сундук за челлендж" }, { status: 400 });
    }

    const weekStart = body.weekStart?.trim();
    const challengeKey = body.challengeKey?.trim();
    if (!weekStart || !challengeKey) {
      return NextResponse.json({ error: "Нужны weekStart и challengeKey" }, { status: 400 });
    }

    const sourceKey = body.sourceKey?.trim() || challengeChestSourceKey(weekStart, challengeKey);

    const challenge = await prisma.userChallenge.findFirst({
      where: {
        userId: session.user.id,
        weekStart,
        challengeKey,
        completedAt: { not: null },
      },
    });
    if (!challenge) {
      return NextResponse.json({ error: "Челлендж ещё не закрыт" }, { status: 400 });
    }

    const existing = await prisma.userReward.findUnique({
      where: {
        userId_sourceKey: { userId: session.user.id, sourceKey },
      },
    });
    if (existing) {
      const def = rewardDef(existing.rewardKey) ?? {
        key: existing.rewardKey,
        title: "Награда",
        description: "Уже в коллекции",
        rarity: "common" as const,
      };
      return NextResponse.json({
        newlyGranted: false,
        reward: serializeReward(def, {
          unlockedAt: existing.unlockedAt,
          source: existing.source,
          sourceKey: existing.sourceKey,
        }),
      });
    }

    const owned = await prisma.userReward.findMany({
      where: { userId: session.user.id },
      select: { rewardKey: true },
    });
    const salt = weekStart.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const rewardKey = pickRewardKey(
      owned.map((r) => r.rewardKey),
      salt,
    );
    const def = rewardDef(rewardKey);
    if (!def) {
      return NextResponse.json({ error: "Нет награды в каталоге" }, { status: 500 });
    }

    const created = await prisma.userReward.create({
      data: {
        userId: session.user.id,
        rewardKey: def.key,
        source: "challenge",
        sourceKey,
      },
    });

    return NextResponse.json({
      newlyGranted: true,
      reward: serializeReward(def, {
        unlockedAt: created.unlockedAt,
        source: created.source,
        sourceKey: created.sourceKey,
      }),
    });
  } catch (error) {
    console.error("rewards POST", error);
    return NextResponse.json({ error: "Не удалось открыть сундук" }, { status: 500 });
  }
}
