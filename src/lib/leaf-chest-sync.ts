import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toDateKeyTz } from "@/lib/dates";
import {
  collectionItem,
  completionReady,
  pickCollectionDrop,
  setTitle,
} from "@/lib/collection-sets";
import {
  addSpark,
  chestSalt,
  cosmeticForChest,
  creditReady,
  dateInCreditWindow,
  leafRewardSourceKey,
  leafView,
  mealCountsAsPlate,
  oldestUnopened,
  sealReadyChests,
  sessionEffortOk,
  shiftDateKeyUtc,
  spendSpareLeaf,
  LEAF_PENDING_NOTE,
  LEAF_RARITY_LABEL,
  type LeafPublic,
  type LeafRarity,
  type LeafSpark,
  type LeafWorld,
  type SealedChest,
  type SpareDeny,
} from "@/lib/leaf-chest";

const SPARE_REASON: Record<SpareDeny, string> = {
  none: "Запасного листка нет",
  today: "На сегодня листок не ставится",
  future: "На будущий день листок не ставится",
  "not-yesterday": "Листок закрывает только вчера",
  already: "На этот день листок уже есть",
};

function isUnique(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function asRarity(value: string): LeafRarity {
  if (value === "rare" || value === "epic" || value === "gold") return value;
  return "common";
}

async function readWorld(userId: string): Promise<LeafWorld> {
  const [sparks, chests, ledger] = await Promise.all([
    prisma.leafSpark.findMany({ where: { userId } }),
    prisma.leafChest.findMany({ where: { userId }, orderBy: { seq: "asc" } }),
    prisma.leafChestLedger.findUnique({ where: { userId } }),
  ]);
  return {
    sparks: sparks.map((row) => ({
      date: row.dateKey,
      food: row.food,
      workout: row.workout,
      spare: row.spare,
    })),
    chests: chests.map(
      (row): SealedChest => ({
        seq: row.seq,
        rarity: asRarity(row.rarity),
        combo: row.combo,
        opened: row.openedAt != null,
        rewardKey: row.rewardKey,
      }),
    ),
    ledger: {
      commonStreak: ledger?.commonStreak ?? 0,
      sinceGold: ledger?.sinceGold ?? 0,
      spareLeaf: ledger?.spareLeaf ?? false,
    },
  };
}

async function persistLeafWorld(userId: string, before: LeafWorld, after: LeafWorld): Promise<void> {
  const previous = new Map(before.sparks.map((spark) => [spark.date, spark]));
  const sparkWrites: LeafSpark[] = after.sparks.filter((spark) => {
    const prev = previous.get(spark.date);
    return (
      !prev ||
      prev.food !== spark.food ||
      prev.workout !== spark.workout ||
      prev.spare !== spark.spare
    );
  });
  const knownSeq = new Set(before.chests.map((chest) => chest.seq));
  const newChests = after.chests.filter((chest) => !knownSeq.has(chest.seq));
  const ledgerChanged =
    before.ledger.commonStreak !== after.ledger.commonStreak ||
    before.ledger.sinceGold !== after.ledger.sinceGold ||
    before.ledger.spareLeaf !== after.ledger.spareLeaf;

  if (sparkWrites.length === 0 && newChests.length === 0 && !ledgerChanged) return;

  await prisma.$transaction(async (tx) => {
    for (const spark of sparkWrites) {
      await tx.leafSpark.upsert({
        where: { userId_dateKey: { userId, dateKey: spark.date } },
        create: {
          userId,
          dateKey: spark.date,
          food: spark.food,
          workout: spark.workout,
          spare: spark.spare,
        },
        update: { food: spark.food, workout: spark.workout, spare: spark.spare },
      });
    }
    for (const chest of newChests) {
      try {
        await tx.leafChest.create({
          data: {
            userId,
            seq: chest.seq,
            rarity: chest.rarity,
            combo: chest.combo,
          },
        });
      } catch (error) {
        if (!isUnique(error)) throw error;
      }
    }
    if (ledgerChanged || newChests.length > 0) {
      await tx.leafChestLedger.upsert({
        where: { userId },
        create: {
          userId,
          commonStreak: after.ledger.commonStreak,
          sinceGold: after.ledger.sinceGold,
          spareLeaf: after.ledger.spareLeaf,
        },
        update: {
          commonStreak: after.ledger.commonStreak,
          sinceGold: after.ledger.sinceGold,
          spareLeaf: after.ledger.spareLeaf,
        },
      });
    }
  });
}

export async function syncLeafWorld(
  userId: string,
  now = new Date(),
): Promise<{ view: LeafPublic; world: LeafWorld; today: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const today = toDateKeyTz(now, user?.timezone);
  const yesterday = shiftDateKeyUtc(today, -1);
  const dates = [yesterday, today];

  const [stored, meals, sessions] = await Promise.all([
    readWorld(userId),
    prisma.mealEntry.findMany({
      where: { userId, date: { in: dates } },
      select: { date: true, calories: true, createdAt: true },
    }),
    prisma.workoutSession.findMany({
      where: { userId, date: { in: dates } },
      select: {
        date: true,
        startedAt: true,
        endedAt: true,
        exercises: {
          select: {
            sets: {
              select: {
                setType: true,
                completed: true,
                reps: true,
                durationSec: true,
                distanceKm: true,
              },
            },
          },
        },
      },
    }),
  ]);

  let credited = stored;
  let pending = false;
  for (const date of dates) {
    if (!dateInCreditWindow(date, today)) continue;
    const foodReady = meals.some(
      (meal) => meal.date === date && mealCountsAsPlate(meal.calories) && creditReady(meal.createdAt, now),
    );
    const foodPending = meals.some(
      (meal) => meal.date === date && mealCountsAsPlate(meal.calories) && !creditReady(meal.createdAt, now),
    );
    const workoutReady = sessions.some((session) => {
      if (session.date !== date || !session.endedAt) return false;
      const effort = sessionEffortOk({
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        sets: session.exercises.flatMap((exercise) => exercise.sets),
      });
      return effort && creditReady(session.endedAt, now);
    });
    const workoutPending = sessions.some((session) => {
      if (session.date !== date || !session.endedAt) return false;
      const effort = sessionEffortOk({
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        sets: session.exercises.flatMap((exercise) => exercise.sets),
      });
      return effort && !creditReady(session.endedAt, now);
    });
    if ((foodPending && !foodReady) || workoutPending) pending = true;
    if (foodReady || workoutReady) {
      credited = addSpark(credited, {
        date,
        food: foodReady,
        workout: workoutReady,
        spare: false,
      }).world;
    }
  }

  const sealed = sealReadyChests(credited, () => randomInt(0, 100));
  await persistLeafWorld(userId, stored, sealed);
  const world = sealed.chests.length > stored.chests.length ? await readWorld(userId) : sealed;
  return {
    world,
    today,
    view: leafView(world, today, pending ? LEAF_PENDING_NOTE : null),
  };
}

export type OpenedLeaf = {
  opened: boolean;
  view: LeafPublic;
  reward: { key: string; title: string; description: string } | null;
  rarity: LeafRarity | null;
  rarityLabel: string | null;
  dust: { setKey: string; setTitle: string; amount: number; total: number } | null;
  setCompleted: { setKey: string; setTitle: string; rewardTitle: string } | null;
};

export async function openLeafChest(userId: string): Promise<OpenedLeaf> {
  const synced = await syncLeafWorld(userId);
  const pending = oldestUnopened(synced.world);
  if (!pending) {
    return {
      opened: false,
      view: synced.view,
      reward: null,
      rarity: null,
      rarityLabel: null,
      dust: null,
      setCompleted: null,
    };
  }

  const sourceKey = leafRewardSourceKey(pending.seq);
  const existing = await prisma.userReward.findUnique({
    where: { userId_sourceKey: { userId, sourceKey } },
  });
  let rewardKey = pending.rewardKey ?? existing?.rewardKey ?? null;
  let dust: OpenedLeaf["dust"] = null;
  let setCompleted: OpenedLeaf["setCompleted"] = null;
  if (!rewardKey && !existing) {
    const ownedRows = await prisma.userReward.findMany({
      where: { userId },
      select: { rewardKey: true },
    });
    const owned = ownedRows.map((row) => row.rewardKey);
    const drop = pickCollectionDrop({
      tier: pending.rarity,
      ownedKeys: owned,
      salt: chestSalt(pending.seq),
      today: synced.today,
    });
    if (drop.kind === "item") {
      rewardKey = drop.key;
      try {
        await prisma.userReward.create({
          data: { userId, rewardKey, source: "leaf", sourceKey },
        });
      } catch (error) {
        if (!isUnique(error)) throw error;
      }
      const prize = completionReady(drop.setKey, [...owned, rewardKey]);
      if (prize) {
        const prizeItem = collectionItem(prize);
        try {
          await prisma.userReward.create({
            data: {
              userId,
              rewardKey: prize,
              source: "leaf",
              sourceKey: `set-complete:${drop.setKey}`,
            },
          });
        } catch (error) {
          if (!isUnique(error)) throw error;
        }
        if (prizeItem) {
          setCompleted = {
            setKey: drop.setKey,
            setTitle: setTitle(drop.setKey),
            rewardTitle: prizeItem.title,
          };
        }
      }
    } else {
      const row = await prisma.userCollectionDust.upsert({
        where: { userId_setKey: { userId, setKey: drop.setKey } },
        create: { userId, setKey: drop.setKey, amount: drop.amount },
        update: { amount: { increment: drop.amount } },
      });
      dust = {
        setKey: drop.setKey,
        setTitle: setTitle(drop.setKey),
        amount: drop.amount,
        total: row.amount,
      };
      rewardKey = drop.duplicateKey;
    }
  }

  await prisma.leafChest.updateMany({
    where: { userId, seq: pending.seq, openedAt: null },
    data: { rewardKey, openedAt: new Date() },
  });

  const world: LeafWorld = {
    ...synced.world,
    chests: synced.world.chests.map((chest) =>
      chest.seq === pending.seq ? { ...chest, opened: true, rewardKey } : chest,
    ),
  };
  return {
    opened: true,
    view: leafView(world, synced.today, synced.view.pendingNote),
    reward: rewardKey ? cosmeticForChest(rewardKey) : null,
    rarity: pending.rarity,
    rarityLabel: LEAF_RARITY_LABEL[pending.rarity],
    dust,
    setCompleted,
  };
}

export async function spendYesterdaySpare(
  userId: string,
): Promise<{ ok: true; view: LeafPublic } | { ok: false; error: string }> {
  const synced = await syncLeafWorld(userId);
  const spent = spendSpareLeaf(synced.world, shiftDateKeyUtc(synced.today, -1), synced.today);
  if (!spent.ok) return { ok: false, error: SPARE_REASON[spent.reason] };
  const sealed = sealReadyChests(spent.world, () => randomInt(0, 100));
  await persistLeafWorld(userId, synced.world, sealed);
  return { ok: true, view: leafView(sealed, synced.today, synced.view.pendingNote) };
}
