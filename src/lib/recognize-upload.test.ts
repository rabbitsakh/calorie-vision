import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRecognitionContext } from "./recognize-upload.ts";

test("parseRecognitionContext accepts restaurant", () => {
  assert.equal(parseRecognitionContext("restaurant"), "restaurant");
  assert.equal(parseRecognitionContext(" Restaurant "), "restaurant");
});

test("parseRecognitionContext rejects unknown values", () => {
  assert.equal(parseRecognitionContext("home"), undefined);
  assert.equal(parseRecognitionContext(""), undefined);
  assert.equal(parseRecognitionContext(null), undefined);
});
