import assert from "node:assert/strict";
import test from "node:test";
import {
  matchAllergensInText,
  normalizeAllergenIds,
  parseAllergensJson,
} from "./allergens.ts";
import { photoKindToContextChip } from "./photo-kind-context.ts";
import { LIVE_RECOGNITION_EVAL_CASES } from "./ai/recognition-live-eval.ts";

test("parseAllergensJson filters unknown ids", () => {
  assert.deepEqual(parseAllergensJson(["milk", "nope", "eggs", "milk"]), ["milk", "eggs"]);
  assert.deepEqual(normalizeAllergenIds(null), []);
});

test("matchAllergensInText soft-matches Russian dish names", () => {
  const hits = matchAllergensInText("Овсянка на молоке с орехами", ["milk", "nuts", "fish"]);
  assert.ok(hits.includes("milk"));
  assert.ok(hits.includes("nuts"));
  assert.ok(!hits.includes("fish"));
});

test("photoKindToContextChip maps model kinds to chips", () => {
  assert.equal(photoKindToContextChip("meal"), "plate");
  assert.equal(photoKindToContextChip("label"), "label");
  assert.equal(photoKindToContextChip("barcode"), "label");
  assert.equal(photoKindToContextChip("unknown"), null);
});

test("live eval catalog has 30–50 fixture slots", () => {
  assert.ok(LIVE_RECOGNITION_EVAL_CASES.length >= 30);
  assert.ok(LIVE_RECOGNITION_EVAL_CASES.length <= 50);
});
