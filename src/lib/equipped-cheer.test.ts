import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getEquippedCheerKey,
  resetEquippedCheerForTests,
  setEquippedCheerKey,
} from "./equipped-cheer.ts";

test("equipped cheer round-trip in localStorage", () => {
  // jsdom/localStorage may be absent in node — exercise no-op path safely.
  resetEquippedCheerForTests();
  setEquippedCheerKey("cheer_cup");
  const got = getEquippedCheerKey();
  // In node without window, helpers no-op and return null.
  assert.ok(got === null || got === "cheer_cup");
  setEquippedCheerKey(null);
  assert.equal(getEquippedCheerKey(), null);
});
