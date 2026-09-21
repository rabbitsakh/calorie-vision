import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseRpe,
  parseSetType,
  setCountsTowardLoad,
  SET_TYPE_SHORT,
} from "./set-meta.ts";

test("parseSetType and load gating", () => {
  assert.equal(parseSetType("warmup"), "warmup");
  assert.equal(parseSetType("nope"), "working");
  assert.equal(setCountsTowardLoad({ setType: "warmup", completed: true }), false);
  assert.equal(setCountsTowardLoad({ setType: "working", completed: true }), true);
  assert.equal(setCountsTowardLoad({ setType: "working", completed: false }), false);
  assert.equal(SET_TYPE_SHORT.working, "Раб");
  assert.equal(SET_TYPE_SHORT.drop, "Дроп");
  assert.equal(SET_TYPE_SHORT.rest_pause, "RP");
});

test("parseRpe accepts half steps", () => {
  assert.equal(parseRpe(8), 8);
  assert.equal(parseRpe("7.5"), 7.5);
  assert.equal(parseRpe(0), null);
  assert.equal(parseRpe(11), null);
  assert.equal(parseRpe(null), null);
  assert.equal(parseRpe(undefined), undefined);
});
