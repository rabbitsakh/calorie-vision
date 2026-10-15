import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import {
  flushPendingMetaChests,
  hydratePendingMetaChests,
  presentChestGrant,
  resetPendingMetaChestsForTests,
  type ChestRewardPayload,
} from "./chest-client.ts";

const PENDING_META_KEY = "cv-pending-meta-chests";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

function installWindow(opts?: { quiet?: boolean }) {
  const session = memoryStorage();
  const local = memoryStorage();
  if (opts?.quiet === false) {
    local.setItem("gamificationQuiet", "0");
  } else {
    local.setItem("gamificationQuiet", "1");
  }
  const listeners = new Map<string, Set<EventListener>>();
  const win = {
    sessionStorage: session,
    localStorage: local,
    dispatchEvent(event: Event) {
      const set = listeners.get(event.type);
      if (!set) return true;
      for (const fn of set) fn(event);
      return true;
    },
    addEventListener(type: string, fn: EventListener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: EventListener) {
      listeners.get(type)?.delete(fn);
    },
  };
  (globalThis as { window?: typeof win; sessionStorage?: Storage; localStorage?: Storage }).window =
    win;
  (globalThis as { sessionStorage?: Storage }).sessionStorage = session;
  (globalThis as { localStorage?: Storage }).localStorage = local;
  return { session, local, listeners, win };
}

afterEach(() => {
  resetPendingMetaChestsForTests();
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("chest-client R1", () => {
  test("persists pending meta in sessionStorage and hydrates after reset", () => {
    const { session } = installWindow({ quiet: true });
    resetPendingMetaChestsForTests();
    const reward: ChestRewardPayload = {
      key: "meta_test",
      title: "Мета",
      description: "Тест",
    };
    session.setItem(PENDING_META_KEY, JSON.stringify([reward]));

    const inbox: Array<{ title: string }> = [];
    window.addEventListener("cv-chest-inbox", ((event: Event) => {
      inbox.push((event as CustomEvent<{ title: string }>).detail);
    }) as EventListener);

    hydratePendingMetaChests();
    flushPendingMetaChests();
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0]?.title, "Мета");
    assert.equal(session.getItem(PENDING_META_KEY), null);
  });

  test("presentChestGrant quiet path notifies inbox and flushes meta", () => {
    installWindow({ quiet: true });
    const inbox: Array<{ title: string; rewardKey?: string }> = [];
    window.addEventListener("cv-chest-inbox", ((event: Event) => {
      inbox.push((event as CustomEvent<{ title: string; rewardKey?: string }>).detail);
    }) as EventListener);

    let fullscreen = false;
    presentChestGrant(
      { key: "sticker_sprout", title: "Росток", description: "Мягкая наклейка" },
      {
        quiet: true,
        fallbackTitle: "Сундук",
        onFullscreen: () => {
          fullscreen = true;
        },
      },
    );

    assert.equal(fullscreen, false);
    assert.equal(inbox[0]?.title, "Росток");
    assert.equal(inbox[0]?.rewardKey, "sticker_sprout");
  });

  test("presentChestGrant loud path calls onFullscreen", () => {
    installWindow({ quiet: false });
    let seen = "";
    presentChestGrant(
      { key: "sticker_cup", title: "Чашка", description: "Вода" },
      {
        quiet: false,
        fallbackTitle: "Сундук",
        onFullscreen: (reward) => {
          seen = reward.title;
        },
      },
    );
    assert.equal(seen, "Чашка");
  });
});
