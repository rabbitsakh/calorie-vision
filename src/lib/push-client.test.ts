import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getPushPromptDismissed,
  isLikelyIos,
  PUSH_PROMPT_DISMISS_COOLDOWN_MS,
  PUSH_PROMPT_DISMISS_KEY,
  setPushPromptDismissed,
} from "./push-client.ts";

test("detects classic iPhone user agents", () => {
  assert.equal(
    isLikelyIos(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    ),
    true,
  );
});

test("detects iPad user agents", () => {
  assert.equal(
    isLikelyIos(
      "Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1",
    ),
    true,
  );
});

test("does not treat desktop Chrome as iOS", () => {
  assert.equal(
    isLikelyIos(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ),
    false,
  );
});

test("push prompt dismiss cools down after 10 days", () => {
  const store = new Map<string, string>();
  const memoryStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  (globalThis as { localStorage?: unknown }).localStorage = memoryStorage;

  assert.equal(getPushPromptDismissed(), false);
  setPushPromptDismissed(true);
  assert.equal(getPushPromptDismissed(), true);

  const old = String(Date.now() - PUSH_PROMPT_DISMISS_COOLDOWN_MS - 1000);
  store.set(PUSH_PROMPT_DISMISS_KEY, old);
  assert.equal(getPushPromptDismissed(), false);

  store.set(PUSH_PROMPT_DISMISS_KEY, "1");
  assert.equal(getPushPromptDismissed(), true);
  assert.notEqual(store.get(PUSH_PROMPT_DISMISS_KEY), "1");

  delete (globalThis as { localStorage?: unknown }).localStorage;
});
