import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decodeImageBase64,
  formatToolResultsForReply,
  resolveAssistantDate,
  shouldAutoApply,
  userWantsWrite,
  weekdayIndexFromLabel,
} from "./assistant-tools.ts";

test("userWantsWrite detects Russian write intents", () => {
  assert.equal(userWantsWrite("Составь план тренировки на завтра"), true);
  assert.equal(userWantsWrite("Добавь омлет в рацион"), true);
  assert.equal(userWantsWrite("Что ещё съесть сегодня?"), false);
});

test("resolveAssistantDate handles relative and weekday labels", () => {
  assert.equal(resolveAssistantDate("сегодня", "2026-10-10"), "2026-10-10");
  assert.equal(resolveAssistantDate("завтра", "2026-10-10"), "2026-10-11");
  assert.equal(resolveAssistantDate("2026-10-12", "2026-10-10"), "2026-10-12");
  // 2026-10-10 is Saturday (5) → next Monday is +2
  assert.equal(resolveAssistantDate("Пн", "2026-10-10"), "2026-10-12");
});

test("weekdayIndexFromLabel maps Russian short labels", () => {
  assert.equal(weekdayIndexFromLabel("Пн"), 0);
  assert.equal(weekdayIndexFromLabel("среда"), 2);
  assert.equal(weekdayIndexFromLabel("Вс"), 6);
  assert.equal(weekdayIndexFromLabel("xyz"), null);
});

test("shouldAutoApply when apply flag or write intent + content", () => {
  assert.equal(
    shouldAutoApply({ apply: true, meals: [{ name: "Суп", kcal: 200 }] }, "идеи?"),
    true,
  );
  assert.equal(
    shouldAutoApply(
      { meals: [{ name: "Суп", kcal: 200 }] },
      "Добавь суп в дневник",
    ),
    true,
  );
  assert.equal(
    shouldAutoApply({ meals: [{ name: "Суп", kcal: 200 }] }, "Что поесть?"),
    false,
  );
  assert.equal(shouldAutoApply(null, "Добавь"), false);
});

test("decodeImageBase64 accepts data URL and raw", () => {
  const raw = Buffer.from("fake-image-bytes-xxxxxxxxYYYYYYYY").toString("base64");
  const a = decodeImageBase64(raw, "image/jpeg");
  assert.ok(a);
  assert.equal(a!.mimeType, "image/jpeg");
  assert.ok(a!.buffer.length >= 32);

  const b = decodeImageBase64(`data:image/png;base64,${raw}`, null);
  assert.ok(b);
  assert.equal(b!.mimeType, "image/png");

  assert.equal(decodeImageBase64("nope", "image/jpeg"), null);
  assert.equal(decodeImageBase64(raw, "text/plain"), null);
});

test("formatToolResultsForReply", () => {
  const text = formatToolResultsForReply([
    { ok: true, tool: "save_meals", message: "ок" },
    { ok: false, tool: "x", message: "fail" },
  ]);
  assert.match(text, /✓ ок/);
  assert.match(text, /✗ fail/);
});
