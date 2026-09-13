import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LIVE_RECOGNITION_EVAL_CASES,
  liveEvalEnabled,
  runLiveRecognitionEvalCase,
} from "./recognition-live-eval.ts";

test("live eval skips when image file is missing", async () => {
  const result = await runLiveRecognitionEvalCase(LIVE_RECOGNITION_EVAL_CASES[0]!);
  assert.equal(result.skipped, true);
  assert.match(result.skipReason ?? "", /missing image/i);
});

test("liveEvalEnabled requires env flag and credentials", () => {
  const prevLive = process.env.RECOGNITION_LIVE_EVAL;
  const prevCreds = process.env.GIGACHAT_CREDENTIALS;
  delete process.env.RECOGNITION_LIVE_EVAL;
  delete process.env.GIGACHAT_CREDENTIALS;
  assert.equal(liveEvalEnabled(), false);
  process.env.RECOGNITION_LIVE_EVAL = prevLive;
  process.env.GIGACHAT_CREDENTIALS = prevCreds;
});

test("canteen-tray and multi-plate live cases require minItems", () => {
  const tray = LIVE_RECOGNITION_EVAL_CASES.find((c) => c.id === "live-canteen-tray");
  const multi2 = LIVE_RECOGNITION_EVAL_CASES.find((c) => c.id === "live-multi-plate-2");
  const multi3 = LIVE_RECOGNITION_EVAL_CASES.find((c) => c.id === "live-multi-plate-3");
  assert.ok(tray?.expect.minItems && tray.expect.minItems >= 2);
  assert.equal(multi2?.expect.minItems, 2);
  assert.equal(multi3?.expect.minItems, 3);
});
