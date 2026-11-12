import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const table = readFileSync(join(root, "components/workouts/SetTable.tsx"), "utf8");

test("меню подхода: Выше и Ниже, на краях кнопки выключены", () => {
  assert.match(table, />\s*Выше\s*</);
  assert.match(table, />\s*Ниже\s*</);
  assert.match(table, /disabled=\{!actions\.canMoveUp \|\| busy\}/);
  assert.match(table, /disabled=\{!actions\.canMoveDown \|\| busy\}/);
  assert.match(table, /canMoveUp: persisted\[0\]\?\.setId !== menuRow\.setId/);
  assert.match(table, /canMoveDown: persisted\.at\(-1\)\?\.setId !== menuRow\.setId/);
});

test("тап по числу открывает клавиатуру, записанный подход тоже", () => {
  assert.match(table, /inputMode=\{inputModeForColumn\(item\.key\)\}/);
  assert.match(table, /normalizeTypedField\(key, typed\)/);
  assert.match(table, /scrollIntoView\(\{ block: "center"/);
  assert.match(table, /window\.visualViewport/);
  assert.doesNotMatch(table, /disabled=\{busy \|\| row\.completed\}/);
  assert.match(table, /Готово/);
});
