import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCustomFoodsCsv } from "./custom-foods-csv.ts";

test("parseCustomFoodsCsv reads headered rows", () => {
  const csv = `name,calories,protein,fat,carbs,portion
Омлет,260,16,20,3,150
"Каша, гречка",180,6,2,36,200`;
  const { rows, errors } = parseCustomFoodsCsv(csv);
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.name, "Омлет");
  assert.equal(rows[0]!.calories, 260);
  assert.equal(rows[0]!.protein, 16);
  assert.equal(rows[1]!.name, "Каша, гречка");
  assert.equal(rows[1]!.portionGrams, 200);
});

test("parseCustomFoodsCsv accepts RU headers and semicolon", () => {
  const csv = `название;ккал;белки;жиры;углеводы;порция
Творог;180;28;8;6;150`;
  const { rows } = parseCustomFoodsCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.name, "Творог");
  assert.equal(rows[0]!.calories, 180);
});

test("parseCustomFoodsCsv works without header", () => {
  const csv = `Борщ,280,12,14,22,300`;
  const { rows } = parseCustomFoodsCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.name, "Борщ");
  assert.equal(rows[0]!.portionGrams, 300);
});
