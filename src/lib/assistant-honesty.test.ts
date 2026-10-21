import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasPhotoPreviewPending,
  replyClaimsSaved,
  sanitizePendingWriteReply,
  sanitizePhotoPreviewReply,
} from "./assistant-honesty.ts";

test("hasPhotoPreviewPending detects ok preview tool", () => {
  assert.equal(hasPhotoPreviewPending([]), false);
  assert.equal(
    hasPhotoPreviewPending([{ ok: true, tool: "recognize_meal_preview", message: "x" }]),
    true,
  );
  assert.equal(
    hasPhotoPreviewPending([{ ok: false, tool: "recognize_meal_preview", message: "x" }]),
    false,
  );
});

test("sanitizePhotoPreviewReply replaces false saved claim", () => {
  const out = sanitizePhotoPreviewReply("Добавил омлет в рацион, приятного!");
  assert.match(out, /не записал|Добавить в рацион/i);
  assert.ok(!/^добавил/i.test(out));
});

test("sanitizePhotoPreviewReply keeps honest preview copy", () => {
  const honest = "На фото омлет ~320 ккал. Подтверди карточку ниже.";
  assert.equal(sanitizePhotoPreviewReply(honest), honest);
});

test("replyClaimsSaved", () => {
  assert.equal(replyClaimsSaved("Добавил в рацион"), true);
  assert.equal(replyClaimsSaved("На фото вижу суп"), false);
});

test("sanitizePendingWriteReply strips ActionCard false claim", () => {
  const out = sanitizePendingWriteReply("Добавил протеин в рацион, приятного!");
  assert.match(out, /не записал|подтвержден/i);
  assert.ok(!/^добавил/i.test(out));
});

test("sanitizePendingWriteReply keeps honest confirm CTA", () => {
  const honest = "Протеин ~260 ккал. Подтверди «В дневник» ниже.";
  assert.equal(sanitizePendingWriteReply(honest), honest);
});
