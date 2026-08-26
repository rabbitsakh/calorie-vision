import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SHOPPING_LIST_KEY,
  addItemsFromDishNames,
  clearAll,
  clearChecked,
  loadList,
  normalizeShoppingName,
  removeItem,
  saveList,
  shoppingListStorageKey,
  toggleItem,
} from "./shopping-list.ts";

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    _map: store,
  };
}

test("shoppingListStorageKey scopes by user or stays global", () => {
  assert.equal(shoppingListStorageKey(), SHOPPING_LIST_KEY);
  assert.equal(shoppingListStorageKey(null), SHOPPING_LIST_KEY);
  assert.equal(shoppingListStorageKey("  "), SHOPPING_LIST_KEY);
  assert.equal(shoppingListStorageKey("u1"), `${SHOPPING_LIST_KEY}:u1`);
});

test("normalizeShoppingName trims and lowercases", () => {
  assert.equal(normalizeShoppingName("  Овсянка  "), "овсянка");
  assert.equal(normalizeShoppingName("Суп\tгороховый"), "суп гороховый");
});

test("addItemsFromDishNames dedupes by normalized name and sets sourceDate", () => {
  const storage = memoryStorage();
  const opts = { storage };

  let list = addItemsFromDishNames(
    ["Овсянка", "  овсянка  ", "Суп", "", "  "],
    "2026-08-25",
    opts,
  );
  assert.equal(list.length, 2);
  assert.equal(list[0]?.name, "Овсянка");
  assert.equal(list[0]?.checked, false);
  assert.equal(list[0]?.sourceDate, "2026-08-25");
  assert.equal(list[1]?.name, "Суп");

  list = addItemsFromDishNames(["ОВСЯНКА", "Хлеб"], "2026-08-26", opts);
  assert.equal(list.length, 3);
  assert.equal(list[2]?.name, "Хлеб");
  assert.equal(list[2]?.sourceDate, "2026-08-26");
  assert.equal(list.find((i) => i.name === "Овсянка")?.sourceDate, "2026-08-25");
});

test("toggleItem, removeItem, clearChecked, clearAll", () => {
  const storage = memoryStorage();
  const opts = { storage };

  let list = addItemsFromDishNames(["Молоко", "Яйца", "Сыр"], undefined, opts);
  assert.equal(list.length, 3);

  const milkId = list[0]!.id;
  list = toggleItem(milkId, opts);
  assert.equal(list.find((i) => i.id === milkId)?.checked, true);

  list = clearChecked(opts);
  assert.equal(list.length, 2);
  assert.ok(!list.some((i) => i.id === milkId));

  const eggsId = list[0]!.id;
  list = removeItem(eggsId, opts);
  assert.equal(list.length, 1);

  list = clearAll(opts);
  assert.deepEqual(list, []);
  assert.equal(storage.getItem(SHOPPING_LIST_KEY), null);
});

test("loadList ignores corrupt payloads; saveList round-trips", () => {
  const storage = memoryStorage();
  const opts = { storage };

  storage.setItem(SHOPPING_LIST_KEY, "{not-json");
  assert.deepEqual(loadList(opts), []);

  storage.setItem(
    SHOPPING_LIST_KEY,
    JSON.stringify([
      { id: "ok", name: "Хлеб", checked: false },
      { id: 1, name: "bad" },
      { id: "x", name: "y", checked: "nope" },
    ]),
  );
  assert.equal(loadList(opts).length, 1);

  saveList([{ id: "a", name: "Чай", checked: true, sourceDate: "2026-01-01" }], opts);
  assert.deepEqual(loadList(opts), [
    { id: "a", name: "Чай", checked: true, sourceDate: "2026-01-01" },
  ]);
});

test("per-user key keeps lists separate", () => {
  const storage = memoryStorage();
  addItemsFromDishNames(["Глобальный"], undefined, { storage });
  addItemsFromDishNames(["Личный"], undefined, { storage, userId: "user-a" });

  assert.equal(loadList({ storage }).length, 1);
  assert.equal(loadList({ storage })[0]?.name, "Глобальный");
  assert.equal(loadList({ storage, userId: "user-a" }).length, 1);
  assert.equal(loadList({ storage, userId: "user-a" })[0]?.name, "Личный");
  assert.ok(storage.getItem(`${SHOPPING_LIST_KEY}:user-a`));
});
