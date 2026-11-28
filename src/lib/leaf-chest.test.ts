import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  addSpark,
  awardSpareLeaf,
  baseRarity,
  copyHasBannedWord,
  creditReady,
  emptyLeafWorld,
  leafView,
  mealCountsAsPlate,
  pickCosmeticForChest,
  resolveRarity,
  rolledTier,
  sealReadyChests,
  sessionCountsAsGym,
  setCountsAsWorkout,
  spendSpareLeaf,
  type LeafSpark,
  type LeafWorld,
} from "./leaf-chest.ts";

function spark(date: string, food: boolean, workout: boolean, spare = false): LeafSpark {
  return { date, food, workout, spare };
}

function withSparks(dates: LeafSpark[]): LeafWorld {
  let world = emptyLeafWorld();
  for (const item of dates) world = addSpark(world, item).world;
  return world;
}

describe("шансы сундука", () => {
  test("обычный день 70/18/7/5", () => {
    const counts = { common: 0, rare: 0, epic: 0, gold: 0 };
    for (let roll = 0; roll < 100; roll += 1) counts[baseRarity(roll)] += 1;
    assert.deepEqual(counts, { common: 70, rare: 18, epic: 7, gold: 5 });
  });

  test("еда и зал в один день дают 0/55/25/20", () => {
    const counts = { common: 0, rare: 0, epic: 0, gold: 0 };
    for (let roll = 0; roll < 100; roll += 1) counts[rolledTier(roll, true)] += 1;
    assert.deepEqual(counts, { common: 0, rare: 55, epic: 25, gold: 20 });
  });

  test("границы броска", () => {
    assert.equal(baseRarity(0), "common");
    assert.equal(baseRarity(69), "common");
    assert.equal(baseRarity(70), "rare");
    assert.equal(baseRarity(87), "rare");
    assert.equal(baseRarity(88), "epic");
    assert.equal(baseRarity(94), "epic");
    assert.equal(baseRarity(95), "gold");
    assert.equal(rolledTier(54, true), "rare");
    assert.equal(rolledTier(55, true), "epic");
    assert.equal(rolledTier(79, true), "epic");
    assert.equal(rolledTier(80, true), "gold");
  });
});

describe("гарантии", () => {
  test("четвёртый обычный становится редким и счётчик обычных сбрасывается", () => {
    let commonStreak = 0;
    let sinceGold = 0;
    const got: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const next = resolveRarity({ roll: 0, combo: false, commonStreak, sinceGold });
      got.push(next.rarity);
      commonStreak = next.commonStreak;
      sinceGold = next.sinceGold;
    }
    assert.deepEqual(got, ["common", "common", "common", "rare"]);
    assert.equal(commonStreak, 0);
  });

  test("двенадцатый без золотого становится золотым", () => {
    let commonStreak = 0;
    let sinceGold = 0;
    const got: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      const next = resolveRarity({ roll: 70, combo: false, commonStreak, sinceGold });
      got.push(next.rarity);
      commonStreak = next.commonStreak;
      sinceGold = next.sinceGold;
    }
    assert.equal(got[11], "gold");
    assert.equal(sinceGold, 0);
    assert.equal(commonStreak, 0);
    assert.equal(got.slice(0, 11).includes("gold"), false);
  });

  test("подъём от еды и зала закрывает гарантию обычных", () => {
    const next = resolveRarity({ roll: 0, combo: true, commonStreak: 3, sinceGold: 2 });
    assert.equal(next.rarity, "rare");
    assert.equal(next.commonStreak, 0);
    assert.equal(next.sinceGold, 3);
  });

  test("четыре обычных подряд не случаются", () => {
    let commonStreak = 0;
    let sinceGold = 0;
    let run = 0;
    for (let i = 0; i < 40; i += 1) {
      const next = resolveRarity({ roll: 0, combo: false, commonStreak, sinceGold });
      run = next.rarity === "common" ? run + 1 : 0;
      assert.ok(run < 4);
      commonStreak = next.commonStreak;
      sinceGold = next.sinceGold;
    }
  });
});

describe("пропуск дня", () => {
  test("день между листками ничего не стирает", () => {
    const world = withSparks([
      spark("2026-11-16", true, false),
      spark("2026-11-18", false, true),
    ]);
    const view = leafView(world, "2026-11-20");
    assert.equal(world.sparks.length, 2);
    assert.equal(view.filled, 2);
    assert.equal(view.ready, false);
    assert.equal(view.line, "Ещё один день — и сундук твой.");
  });

  test("два соседних дня говорят фразой с макета", () => {
    const world = withSparks([
      spark("2026-11-20", true, false),
      spark("2026-11-21", false, true),
    ]);
    const view = leafView(world, "2026-11-22");
    assert.equal(view.line, "Вчера зал, позавчера завтрак — остался сегодняшний листок.");
    assert.equal(copyHasBannedWord(view.line), null);
    assert.equal(copyHasBannedWord(view.sheetHint), null);
    assert.equal(copyHasBannedWord(view.finePrint), null);
  });
});

describe("запасной листок", () => {
  test("закрывает только пустое вчера и не копится", () => {
    let world = awardSpareLeaf(emptyLeafWorld());
    world = awardSpareLeaf(world);
    assert.equal(world.ledger.spareLeaf, true);

    const today = "2026-11-22";
    const onToday = spendSpareLeaf(world, today, today);
    assert.equal(onToday.ok, false);
    if (!onToday.ok) assert.equal(onToday.reason, "today");

    const future = spendSpareLeaf(world, "2026-11-23", today);
    assert.equal(future.ok, false);
    if (!future.ok) assert.equal(future.reason, "future");

    const older = spendSpareLeaf(world, "2026-11-20", today);
    assert.equal(older.ok, false);
    if (!older.ok) assert.equal(older.reason, "not-yesterday");

    const spent = spendSpareLeaf(world, "2026-11-21", today);
    assert.equal(spent.ok, true);
    if (spent.ok) {
      assert.equal(spent.world.ledger.spareLeaf, false);
      const leaf = spent.world.sparks[0];
      assert.equal(leaf?.date, "2026-11-21");
      assert.equal(leaf?.spare, true);
      assert.equal(leaf?.food, false);
      assert.equal(leaf?.workout, false);
      const again = spendSpareLeaf(spent.world, "2026-11-21", today);
      assert.equal(again.ok, false);
    }
  });

  test("не ставится на день, где листок уже есть", () => {
    let world = withSparks([spark("2026-11-21", true, false)]);
    world = awardSpareLeaf(world);
    const spent = spendSpareLeaf(world, "2026-11-21", "2026-11-22");
    assert.equal(spent.ok, false);
    if (!spent.ok) assert.equal(spent.reason, "already");
    assert.equal(world.sparks.length, 1);
  });
});

describe("защита от повторной выдачи", () => {
  test("вторая запись той же даты не добавляет листок", () => {
    const first = addSpark(emptyLeafWorld(), spark("2026-11-20", true, false));
    const second = addSpark(first.world, spark("2026-11-20", true, false));
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.world.sparks.length, 1);
  });

  test("сундук с тем же номером не переигрывается", () => {
    let world = withSparks([
      spark("2026-11-18", true, false),
      spark("2026-11-19", true, false),
      spark("2026-11-20", true, false),
    ]);
    let rolls = 0;
    world = sealReadyChests(world, () => {
      rolls += 1;
      return 0;
    });
    world = sealReadyChests(world, () => {
      rolls += 1;
      return 99;
    });
    assert.equal(world.chests.length, 1);
    assert.equal(world.chests[0]?.rarity, "common");
    assert.equal(rolls, 1);
    const view = leafView(world, "2026-11-20");
    assert.equal(view.ready, true);
    assert.equal(view.filled, 3);
    assert.equal(view.line, "Три дня есть. Можно открывать.");
  });

  test("вещь той же редкости выбирается из каталога", () => {
    const key = pickCosmeticForChest([], "common", 1);
    assert.ok(key.startsWith("sticker_") || key.startsWith("cheer_") || key.startsWith("frame_"));
  });
});

describe("зачёт еды и зала", () => {
  test("тарелка от 80 ккал и пауза 15 минут", () => {
    assert.equal(mealCountsAsPlate(79), false);
    assert.equal(mealCountsAsPlate(80), true);
    const now = new Date("2026-11-22T12:00:00Z");
    assert.equal(creditReady(new Date("2026-11-22T11:46:00Z"), now), false);
    assert.equal(creditReady(new Date("2026-11-22T11:45:00Z"), now), true);
  });

  test("разминка и короткая тренировка не считаются", () => {
    assert.equal(setCountsAsWorkout({ setType: "warmup", reps: 20, completed: true }), false);
    assert.equal(setCountsAsWorkout({ setType: "working", reps: 4, completed: true }), false);
    assert.equal(setCountsAsWorkout({ setType: "working", reps: 5, completed: true }), true);
    assert.equal(setCountsAsWorkout({ setType: "working", durationSec: 300, completed: true }), true);
    assert.equal(setCountsAsWorkout({ setType: "working", distanceKm: 0.5, completed: true }), true);
    const now = new Date("2026-11-22T12:00:00Z");
    assert.equal(
      sessionCountsAsGym(
        {
          startedAt: new Date("2026-11-22T11:30:00Z"),
          endedAt: new Date("2026-11-22T11:32:00Z"),
          sets: [{ setType: "working", reps: 8, completed: true }],
        },
        now,
      ),
      false,
    );
    assert.equal(
      sessionCountsAsGym(
        {
          startedAt: new Date("2026-11-22T11:20:00Z"),
          endedAt: new Date("2026-11-22T11:30:00Z"),
          sets: [{ setType: "working", reps: 8, completed: true }],
        },
        now,
      ),
      true,
    );
  });
});
