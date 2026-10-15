import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { maybeAutoEquipReward } from "./auto-equip-reward.ts";
import { getEquippedStickerKey, resetEquippedStickerForTests, setEquippedStickerKey } from "./equipped-sticker.ts";
import { getEquippedFrameKey, resetEquippedFrameForTests, setEquippedFrameKey } from "./equipped-frame.ts";
import { getEquippedCheerKey, resetEquippedCheerForTests, setEquippedCheerKey } from "./equipped-cheer.ts";

function installStorage() {
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(k) {
      return map.has(k) ? map.get(k)! : null;
    },
    key(i) {
      return [...map.keys()][i] ?? null;
    },
    removeItem(k) {
      map.delete(k);
    },
    setItem(k, v) {
      map.set(k, v);
    },
  };
  (globalThis as { window?: { localStorage: Storage }; localStorage?: Storage }).window = {
    localStorage: storage,
    dispatchEvent: () => true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  } as unknown as { localStorage: Storage };
  (globalThis as { localStorage?: Storage }).localStorage = storage;
}

afterEach(() => {
  resetEquippedStickerForTests();
  resetEquippedFrameForTests();
  resetEquippedCheerForTests();
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("maybeAutoEquipReward", () => {
  test("auto-equips first sticker", async () => {
    installStorage();
    const kind = await maybeAutoEquipReward("sticker_sprout");
    assert.equal(kind, "sticker");
    assert.equal(getEquippedStickerKey(), "sticker_sprout");
  });

  test("skips when sticker already equipped", async () => {
    installStorage();
    setEquippedStickerKey("sticker_cup");
    const kind = await maybeAutoEquipReward("sticker_sprout");
    assert.equal(kind, null);
    assert.equal(getEquippedStickerKey(), "sticker_cup");
  });

  test("auto-equips frame and cheer when empty", async () => {
    installStorage();
    assert.equal(await maybeAutoEquipReward("frame_teal"), "frame");
    assert.equal(getEquippedFrameKey(), "frame_teal");
    assert.equal(await maybeAutoEquipReward("cheer_steady"), "cheer");
    assert.equal(getEquippedCheerKey(), "cheer_steady");
    setEquippedFrameKey("frame_amber");
    assert.equal(await maybeAutoEquipReward("frame_mint"), null);
  });
});
