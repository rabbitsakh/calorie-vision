/**
 * DEP0169 (`url.parse`) в логах Node 24 идёт из Next.js, не из нашего кода.
 * Этот тест не даёт вернуть импорт `url` в клиент GigaChat: WHATWG URL глобальный.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

test("gigachat не импортирует устаревший модуль url и не вызывает url.parse", () => {
  const source = readFileSync(join(process.cwd(), "src/lib/ai/gigachat.ts"), "utf8");
  assert.doesNotMatch(source, /from ["']url["']/);
  assert.doesNotMatch(source, /from ["']node:url["']/);
  assert.doesNotMatch(source, /url\.parse\s*\(/);
  assert.match(source, /new URL\(/);
});
