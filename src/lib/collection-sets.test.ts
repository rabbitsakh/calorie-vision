import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  COLLECTION_ITEMS,
  DUST_BY_RARITY,
  DUST_EXCHANGE_COST,
  baseItems,
  completionReady,
  exchangeDust,
  isWinterSeason,
  pickCollectionDrop,
  publicRarity,
  setFilled,
  wardrobeKeys,
} from "./collection-sets.ts";

describe("пыль и обмен", () => {
  test("пыль по редкости", () => {
    assert.deepEqual(DUST_BY_RARITY, { common: 1, rare: 3, epic: 8, legendary: 20 });
    assert.equal(DUST_EXCHANGE_COST, 10);
  });

  test("пустая ячейка за 10 пыли, повтор и нехватка не проходят", () => {
    const opened = exchangeDust({
      setKey: "fruits",
      rewardKey: "fruit_apple",
      dust: 10,
      ownedKeys: [],
    });
    assert.equal(opened.ok, true);
    if (opened.ok) assert.equal(opened.dustLeft, 0);

    const short = exchangeDust({
      setKey: "fruits",
      rewardKey: "fruit_apple",
      dust: 9,
      ownedKeys: [],
    });
    assert.equal(short.ok, false);

    const owned = exchangeDust({
      setKey: "fruits",
      rewardKey: "fruit_apple",
      dust: 40,
      ownedKeys: ["fruit_apple"],
    });
    assert.equal(owned.ok, false);
    if (!owned.ok) assert.equal(owned.reason, "owned");
  });

  test("сезон и награда набора пылью не покупаются", () => {
    const season = exchangeDust({
      setKey: "fruits",
      rewardKey: "winter_snow",
      dust: 10,
      ownedKeys: [],
    });
    assert.equal(season.ok, false);
    const prize = exchangeDust({
      setKey: "fruits",
      rewardKey: "cheer_fruit_set",
      dust: 10,
      ownedKeys: [],
    });
    assert.equal(prize.ok, false);
  });

  test("когда редкость собрана, повтор даёт пыль своего набора", () => {
    const commons = COLLECTION_ITEMS.filter(
      (entry) => entry.rarity === "common" && !entry.seasonal && !entry.completion,
    ).map((entry) => entry.key);
    const drop = pickCollectionDrop({
      tier: "common",
      ownedKeys: commons,
      salt: 0,
      today: "2026-11-28",
    });
    assert.equal(drop.kind, "dust");
    if (drop.kind === "dust") {
      assert.equal(drop.amount, 1);
      assert.ok(commons.includes(drop.duplicateKey));
    }
  });

  test("несобранная вещь выдаётся, а не пыль", () => {
    const drop = pickCollectionDrop({
      tier: "gold",
      ownedKeys: [],
      salt: 0,
      today: "2026-11-28",
    });
    assert.equal(drop.kind, "item");
    if (drop.kind === "item") assert.equal(drop.key, "sakh_star");
  });
});

describe("сохранность старых наград", () => {
  test("festive и gold читаются как легендарные, неизвестное как редкое", () => {
    assert.equal(publicRarity("festive"), "legendary");
    assert.equal(publicRarity("gold"), "legendary");
    assert.equal(publicRarity("legendary"), "legendary");
    assert.equal(publicRarity("common"), "common");
    assert.equal(publicRarity("epic"), "epic");
    assert.equal(publicRarity("что-то"), "rare");
  });

  test("старые ключи остаются в гардеробе и не стираются из списка", () => {
    const owned = ["sticker_sprout", "cheer_festive", "fruit_apple"];
    const wardrobe = wardrobeKeys(owned);
    assert.deepEqual(wardrobe.sort(), ["cheer_festive", "sticker_sprout"]);
    assert.equal(owned.includes("sticker_sprout"), true);
    assert.equal(setFilled("fruits", owned).filled, 1);
  });
});

describe("набор и зима", () => {
  test("в каждом наборе 8 базовых вещей и награда за полный набор", () => {
    assert.equal(baseItems("fruits").length, 8);
    assert.equal(baseItems("sport").length, 8);
    assert.equal(baseItems("sakhalin").length, 8);
    const owned = baseItems("fruits").map((entry) => entry.key);
    assert.equal(completionReady("fruits", owned), "cheer_fruit_set");
    assert.equal(completionReady("fruits", [...owned, "cheer_fruit_set"]), null);
  });

  test("зима с 1 декабря 2026 по 28 февраля 2027", () => {
    assert.equal(isWinterSeason("2026-11-30"), false);
    assert.equal(isWinterSeason("2026-12-01"), true);
    assert.equal(isWinterSeason("2027-02-28"), true);
    assert.equal(isWinterSeason("2027-03-01"), false);
  });

  test("зимняя вещь падает только в сезон и не обязательна для набора", () => {
    const before = pickCollectionDrop({
      tier: "epic",
      ownedKeys: baseItems("fruits")
        .concat(baseItems("sport"))
        .concat(baseItems("sakhalin"))
        .filter((entry) => entry.rarity === "epic")
        .map((entry) => entry.key),
      salt: 0,
      today: "2026-11-28",
    });
    assert.equal(before.kind, "dust");
    const during = pickCollectionDrop({
      tier: "epic",
      ownedKeys: ["fruit_orchard", "sport_podium", "sakh_volcano"],
      salt: 0,
      today: "2026-12-15",
    });
    assert.equal(during.kind, "item");
    if (during.kind === "item") assert.equal(during.key, "winter_aurora");
    const progress = setFilled("sakhalin", ["winter_aurora"]);
    assert.equal(progress.filled, 0);
  });
});
