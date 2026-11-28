import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { toDateKeyTz } from "@/lib/dates";
import {
  COLLECTION_ITEMS,
  COLLECTION_SETS,
  DUST_EXCHANGE_COST,
  WINTER_SEASON,
  baseItems,
  collectionItem,
  completionReady,
  exchangeDust,
  isWinterSeason,
  publicRarity,
  seasonItems,
  setFilled,
  wardrobeKeys,
  type SetKey,
} from "@/lib/collection-sets";
import { rewardDef } from "@/lib/rewards";

export const dynamic = "force-dynamic";

async function payload(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      timezone: true,
      equippedFrameKey: true,
      equippedStickerKey: true,
      equippedCheerKey: true,
    },
  });
  const today = toDateKeyTz(new Date(), user?.timezone);
  const [ownedRows, dustRows, seenRows] = await Promise.all([
    prisma.userReward.findMany({ where: { userId }, select: { rewardKey: true } }),
    prisma.userCollectionDust.findMany({ where: { userId } }),
    prisma.userRewardSeen.findMany({ where: { userId }, select: { rewardKey: true } }),
  ]);
  const owned = [...new Set(ownedRows.map((row) => row.rewardKey))];
  const seen = new Set(seenRows.map((row) => row.rewardKey));
  const dust = Object.fromEntries(dustRows.map((row) => [row.setKey, row.amount]));
  const equipped = new Set(
    [user?.equippedFrameKey, user?.equippedStickerKey, user?.equippedCheerKey].filter(
      (key): key is string => Boolean(key),
    ),
  );
  return {
    today,
    dustCost: DUST_EXCHANGE_COST,
    odds: "Обычный день: 70% обычный, 18% редкий, 7% эпический, 5% легендарный. Еда и зал в один день: 55% редкий, 25% эпический, 20% легендарный.",
    season: {
      ...WINTER_SEASON,
      active: isWinterSeason(today),
      items: seasonItems().map((entry) => serialize(entry.key, owned, seen, equipped)),
    },
    sets: COLLECTION_SETS.map((set) => {
      const progress = setFilled(set.key, owned);
      const prize = collectionItem(set.completionKey);
      return {
        key: set.key,
        title: set.title,
        filled: progress.filled,
        total: progress.total,
        dust: dust[set.key] ?? 0,
        items: baseItems(set.key).map((entry) => serialize(entry.key, owned, seen, equipped)),
        completion: prize
          ? {
              ...serialize(prize.key, owned, seen, equipped),
              title: prize.title,
            }
          : null,
      };
    }),
    wardrobe: wardrobeKeys(owned).map((key) => {
      const def = rewardDef(key);
      return {
        key,
        title: def?.title ?? key,
        rarity: publicRarity(def?.rarity ?? "rare"),
        owned: true,
        unseen: !seen.has(key),
        equipped: equipped.has(key),
      };
    }),
    unseen: owned.filter((key) => COLLECTION_ITEMS.some((entry) => entry.key === key) && !seen.has(key))
      .length,
  };
}

function serialize(
  key: string,
  owned: string[],
  seen: Set<string>,
  equipped: Set<string>,
) {
  const entry = collectionItem(key);
  const has = owned.includes(key);
  return {
    key,
    title: has ? entry?.title ?? key : null,
    rarity: publicRarity(entry?.rarity ?? "rare"),
    group: entry?.group ?? "sticker",
    owned: has,
    unseen: has && !seen.has(key),
    equipped: equipped.has(key),
  };
}

export async function GET() {
  try {
    const { session, response } = await requireSession();
    if (response) return response;
    return NextResponse.json(await payload(session.user.id));
  } catch (error) {
    console.error("collection GET", error);
    return NextResponse.json({ error: "Не удалось открыть коллекцию" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      setKey?: string;
      rewardKey?: string;
    };
    const userId = session.user.id;
    if (body.action === "seen" && body.rewardKey) {
      await prisma.userRewardSeen.upsert({
        where: { userId_rewardKey: { userId, rewardKey: body.rewardKey } },
        create: { userId, rewardKey: body.rewardKey },
        update: {},
      });
      return NextResponse.json(await payload(userId));
    }
    if (body.action === "exchange" && body.setKey && body.rewardKey) {
      const [dustRow, ownedRows] = await Promise.all([
        prisma.userCollectionDust.findUnique({
          where: { userId_setKey: { userId, setKey: body.setKey } },
        }),
        prisma.userReward.findMany({ where: { userId }, select: { rewardKey: true } }),
      ]);
      const result = exchangeDust({
        setKey: body.setKey,
        rewardKey: body.rewardKey,
        dust: dustRow?.amount ?? 0,
        ownedKeys: ownedRows.map((row) => row.rewardKey),
      });
      if (!result.ok) {
        const text =
          result.reason === "dust"
            ? "Нужно 10 пыли этого набора"
            : result.reason === "owned"
              ? "Эта ячейка уже собрана"
              : "Эту ячейку нельзя выбрать";
        return NextResponse.json({ error: text }, { status: 400 });
      }
      await prisma.$transaction([
        prisma.userCollectionDust.update({
          where: { userId_setKey: { userId, setKey: body.setKey } },
          data: { amount: result.dustLeft },
        }),
        prisma.userReward.create({
          data: {
            userId,
            rewardKey: result.rewardKey,
            source: "leaf",
            sourceKey: `dust:${body.setKey}:${result.rewardKey}`,
          },
        }),
      ]);
      if (body.setKey === "fruits" || body.setKey === "sport" || body.setKey === "sakhalin") {
        const ready = completionReady(body.setKey as SetKey, [
          ...ownedRows.map((row) => row.rewardKey),
          result.rewardKey,
        ]);
        if (ready) {
          await prisma.userReward
            .create({
              data: {
                userId,
                rewardKey: ready,
                source: "leaf",
                sourceKey: `set-complete:${body.setKey}`,
              },
            })
            .catch(() => undefined);
        }
      }
      return NextResponse.json(await payload(userId));
    }
    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch (error) {
    console.error("collection POST", error);
    return NextResponse.json({ error: "Не удалось обновить коллекцию" }, { status: 500 });
  }
}
