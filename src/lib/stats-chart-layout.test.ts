import assert from "node:assert/strict";
import { test } from "node:test";
import {
  axisLabelIndices,
  placeCalorieValueLabel,
  planCalorieBarChart,
  sparseValueLabelIndices,
} from "./stats-chart-layout.ts";

test("axisLabelIndices caps month to 5 including ends", () => {
  const labels = axisLabelIndices(30, "month");
  assert.equal(labels.size, 5);
  assert.ok(labels.has(0));
  assert.ok(labels.has(29));
});

test("axisLabelIndices caps quarter to 4", () => {
  const labels = axisLabelIndices(90, "quarter");
  assert.equal(labels.size, 4);
  assert.ok(labels.has(0));
  assert.ok(labels.has(89));
});

test("axisLabelIndices shows all week days", () => {
  assert.equal(axisLabelIndices(7, "week").size, 7);
});

test("sparseValueLabelIndices keeps ends and extrema", () => {
  const points = [
    { index: 0, value: 140 },
    { index: 1, value: 139 },
    { index: 2, value: 138 },
    { index: 3, value: 137 },
    { index: 4, value: 136 },
    { index: 5, value: 135 },
    { index: 6, value: 141 },
  ];
  const labels = sparseValueLabelIndices(points, 4);
  assert.ok(labels.size <= 4);
  assert.ok(labels.has(0));
  assert.ok(labels.has(6));
  assert.ok(labels.has(5)); // min
  assert.ok(labels.has(6)); // max (also end)
});

test("sparseValueLabelIndices returns empty when max is 0", () => {
  assert.equal(sparseValueLabelIndices([{ index: 0, value: 1 }], 0).size, 0);
});

/**
 * Синтетическая неделя той же формы, что и баг на графике:
 * высокий день выше цели и средний день не попадают в разреженный набор из 5 подписей.
 * Числа вымышленные, не дневник пользователя.
 */
const WEEK_VALUES = [1480, 2520, 910, 2380, 690, 1120, 1290];
const WEEK_TARGET = 2000;

function assertLabelInsideChart(model: ReturnType<typeof planCalorieBarChart>) {
  for (const bar of model.bars) {
    if (!bar.label) continue;
    assert.ok(bar.label.bottomPx >= 0, bar.label.text);
    assert.ok(
      bar.label.bottomPx + bar.label.heightPx <= model.totalHeightPx,
      `${bar.label.text} вылезает сверху`,
    );
    if (bar.label.inside) {
      assert.ok(bar.label.bottomPx + bar.label.heightPx <= bar.heightPx, `${bar.label.text} не внутри столбца`);
    } else {
      assert.ok(bar.label.bottomPx >= bar.heightPx + 4, `${bar.label.text} пересекает столбец`);
    }
  }
}

test("неделя: ккал видны у каждого дня, включая высокий выше цели и средний", () => {
  const points = WEEK_VALUES.map((value, index) => ({ index, value }));
  const sparse = sparseValueLabelIndices(points, 5);
  assert.equal(sparse.has(3), false);
  assert.equal(sparse.has(5), false);

  const model = planCalorieBarChart({ values: WEEK_VALUES, target: WEEK_TARGET });
  assert.deepEqual(
    model.bars.map((bar) => bar.label?.text ?? null),
    WEEK_VALUES.map(String),
  );
  assert.equal(model.bars[1]?.overTarget, true);
  assert.equal(model.bars[3]?.overTarget, true);
  assert.equal(model.bars[5]?.overTarget, false);
  assertLabelInsideChart(model);
  for (const bar of model.bars) {
    assert.equal(bar.label?.inside, false);
  }
});

test("короткий и максимальный столбцы не обрезают подпись", () => {
  const model = planCalorieBarChart({ values: [400, 3200], target: 2000 });
  assert.equal(model.bars[0]?.label?.text, "400");
  assert.equal(model.bars[1]?.label?.text, "3200");
  assert.ok((model.bars[0]?.heightPx ?? 0) < (model.bars[1]?.heightPx ?? 0));
  assertLabelInsideChart(model);

  const fiveDigits = planCalorieBarChart({ values: [800, 12500], target: 2000 });
  assert.equal(fiveDigits.bars[1]?.label?.text, "12500");
  assertLabelInsideChart(fiveDigits);
});

test("день без калорий не получает число, остальные дни получают", () => {
  const values = [0, 1500, 0, 2200];
  const model = planCalorieBarChart({ values, target: 1800 });
  assert.equal(model.bars[0]?.label, null);
  assert.equal(model.bars[2]?.label, null);
  assert.equal(model.bars[1]?.label?.text, "1500");
  assert.equal(model.bars[3]?.label?.text, "2200");
  assert.equal(model.bars[3]?.overTarget, true);
  assertLabelInsideChart(model);
});

test("30 и 90 дней: подпись у каждого дня с едой, колонка не уже глифа", () => {
  for (const count of [30, 90]) {
    const values = Array.from({ length: count }, (_, index) => {
      if (index % 6 === 0) return 0;
      if (index % 5 === 0) return 2600;
      if (index % 4 === 0) return 640;
      return 1100 + (index % 7) * 90;
    });
    const model = planCalorieBarChart({ values, target: 2000 });
    const logged = values.filter((value) => value > 0).length;
    assert.equal(model.bars.filter((bar) => bar.label).length, logged);
    assert.ok(model.columnMinPx >= 12);
    assert.equal(
      model.contentMinWidthPx,
      count * model.columnMinPx + (count - 1) * model.columnGapPx,
    );
    assertLabelInsideChart(model);
  }
  const week = planCalorieBarChart({ values: WEEK_VALUES, target: WEEK_TARGET });
  const quarter = planCalorieBarChart({
    values: Array.from({ length: 90 }, (_, index) => 1000 + (index % 9) * 120),
    target: WEEK_TARGET,
  });
  assert.ok(week.contentMinWidthPx < 320);
  assert.ok(quarter.contentMinWidthPx > 1280);
});

test("высокая колонка прячет подпись внутрь столбца, а не за край холста", () => {
  const inside = placeCalorieValueLabel({
    barHeightPx: 144,
    totalHeightPx: 150,
    labelHeightPx: 36,
    gapPx: 4,
  });
  assert.equal(inside.inside, true);
  assert.ok(inside.bottomPx >= 0);
  assert.ok(inside.bottomPx + 36 <= 144);

  const pinned = placeCalorieValueLabel({
    barHeightPx: 8,
    totalHeightPx: 20,
    labelHeightPx: 36,
    gapPx: 4,
  });
  assert.equal(pinned.inside, false);
  assert.equal(pinned.bottomPx, 0);
});
