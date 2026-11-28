import assert from "node:assert/strict";
import test from "node:test";
import { shouldRefreshOnShow, VISIBLE_REFRESH_GAP_MS } from "./visible-refresh";

test("повторный показ вкладки в одном окне не дублирует запрос", () => {
  const started = 10_000;
  assert.equal(shouldRefreshOnShow(started, 0), true);
  assert.equal(shouldRefreshOnShow(started + 40, started), false);
  assert.equal(shouldRefreshOnShow(started + VISIBLE_REFRESH_GAP_MS - 1, started), false);
  assert.equal(shouldRefreshOnShow(started + VISIBLE_REFRESH_GAP_MS, started), true);
});
