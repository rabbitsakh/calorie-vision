import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isBlockMode,
  parseBlockMode,
  parseCircuitRounds,
  REST_PAUSE_SEC,
} from "./block-mode.ts";

test("parseBlockMode falls back to normal", () => {
  assert.equal(parseBlockMode("circuit"), "circuit");
  assert.equal(parseBlockMode("rest_pause"), "rest_pause");
  assert.equal(parseBlockMode("nope"), "normal");
  assert.equal(isBlockMode("normal"), true);
  assert.equal(isBlockMode("x"), false);
});

test("parseCircuitRounds clamps 1–20", () => {
  assert.equal(parseCircuitRounds(3), 3);
  assert.equal(parseCircuitRounds(0), 1);
  assert.equal(parseCircuitRounds(99), 20);
  assert.equal(parseCircuitRounds("abc"), 3);
});

test("REST_PAUSE_SEC is short", () => {
  assert.ok(REST_PAUSE_SEC >= 15 && REST_PAUSE_SEC <= 30);
});
