import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRecognitionRetryPrompt } from "./recognition-retry-prompt.ts";

test("retry prompt includes reason-specific hint", () => {
  const prompt = buildRecognitionRetryPrompt("plate-list-without-items");
  assert.match(prompt, /items \(2–8\)/i);
  assert.match(prompt, /JSON/i);
});

test("retry prompt falls back when reason is null", () => {
  const prompt = buildRecognitionRetryPrompt(null);
  assert.match(prompt, /валидный JSON/i);
});

test("retry prompt explains packaged soup mismatch", () => {
  const prompt = buildRecognitionRetryPrompt("packaged-soup-mismatch");
  assert.match(prompt, /овсянка/i);
  assert.match(prompt, /не суп/i);
});
