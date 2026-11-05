import assert from "node:assert/strict";
import test from "node:test";
import { matchExerciseName } from "./catalog-link.ts";
import { EXERCISE_CATALOG, planCatalogUpsert, toCatalogSeedData } from "./exercise-catalog.ts";

/** 35 названий с прода: как люди записали упражнение → id справочника. */
const USER_NAMES: ReadonlyArray<readonly [string, string]> = [
  ["Жим лежа", "bench-press"],
  ["Сведение на грудь в тренажере", "pec-deck"],
  ["Беговая дорожка", "treadmill"],
  ["Тяга в блоке на трицепс", "pushdown"],
  ["Гребковая тяга", "seated-row"],
  ["Тяга блока на спину", "lat-pulldown"],
  ["Подъем на плечи в тренажере смита", "smith-ohp"],
  ["Тяга в блоке на трицепс из за спины", "cable-oh-behind"],
  ["Велотренажер", "bike"],
  ["Тяга штанги на спину в наклоне", "bb-row"],
  ["Сгибание в тренажере", "leg-curl"],
  ["Разгибание в тренажере", "leg-ext"],
  ["Подъем штанги на бицепс стоя обратным хватом узко", "reverse-curl"],
  ["Эллипсоид", "ellipse"],
  ["Подъем на плечи в тренажере (шолдер пресс)", "machine-ohp"],
  ["Гиперэкстензия", "back-ext"],
  ["Разведение гантелей на плечи", "lateral"],
  ["Разведение на заднюю дельту бабочка", "reverse-pec"],
  ["Обратное отжимание от скамьи на трицепс", "bench-dip"],
  ["Скват в тренажере (приседания)", "squat-machine"],
  ["Бабочка на заднюю дельту", "reverse-pec"],
  ["Подъем штанги на бицепс стоя", "bb-curl"],
  ["Выпады вперед", "lunge-forward"],
  ["Тяга на спину в тренажере Лоу роу", "seated-row"],
  ["Тяга на спину", "seated-row"],
  ["Тяга гантели на спину", "db-row"],
  ["Молотки на бийепс", "hammer-curl"],
  ["Ножной пресс тренажер", "leg-press"],
  ["Тяга блока в приседе на бицепс", "cable-curl"],
  ["Тренажер на плечи shoulder press", "machine-ohp"],
  ["Сет на трицепс в блочном тренажере", "pushdown"],
  ["Подъем гантелей на плечи", "db-ohp"],
  ["Пулдаун в тренажере", "lat-pulldown"],
  ["Приседания со штангой", "squat"],
  ["Подъем штанги на бицепс", "bb-curl"],
];

const DISTINCT_MOVEMENTS: ReadonlyArray<readonly [string, string]> = [
  ["Тяга в блоке на трицепс", "Тяга в блоке на трицепс из за спины"],
  ["Подъем на плечи в тренажере смита", "Подъем на плечи в тренажере (шолдер пресс)"],
  ["Подъем на плечи в тренажере (шолдер пресс)", "шолдер пресс"],
  ["Тренажер на плечи shoulder press", "shoulder press"],
  ["Жим в смите", "Подъем на плечи в тренажере смита"],
  ["Разведение гантелей на плечи", "Разведение на заднюю дельту бабочка"],
  ["Разведение гантелей на плечи", "Бабочка"],
  ["Подъем гантелей на плечи", "Разведение гантелей на плечи"],
  ["Подъем гантелей на плечи", "Жим гантелей стоя"],
  ["Сгибание в тренажере", "Разгибание в тренажере"],
  ["Сгибание в тренажере", "Сгибание в тренажере на бицепс"],
  ["Подъем штанги на бицепс стоя", "Подъем штанги на бицепс стоя обратным хватом узко"],
  ["Беговая дорожка", "Ходьба на дорожке"],
  ["Велотренажер", "Велосипед на улице"],
  ["Гребковая тяга", "Гребля"],
  ["Жим лежа", "Жим в тренажере"],
  ["Тяга блока на спину", "Тяга гантели на спину"],
  ["Тяга блока на спину", "Тяга штанги на спину в наклоне"],
  ["Тяга гантели на спину", "Тяга штанги на спину в наклоне"],
  ["Тяга на спину в тренажере Лоу роу", "Тяга блока на спину"],
  ["Выпады вперед", "Выпады со штангой"],
  ["Скват в тренажере (приседания)", "Приседания со штангой"],
  ["Скват в тренажере (приседания)", "Приседания в Смите"],
  ["Скват в тренажере (приседания)", "Гакк-приседания"],
  ["Бабочка на заднюю дельту", "Бабочка"],
];

const NEW_IDS = ["smith-ohp", "cable-oh-behind", "squat-machine", "lunge-forward"] as const;

test("все 35 названий с прода уверенно попадают в ожидаемую позицию", () => {
  assert.equal(USER_NAMES.length, 35);
  for (const [name, id] of USER_NAMES) {
    const match = matchExerciseName(name);
    assert.equal(match.status, "confident", name);
    if (match.status === "confident") {
      assert.equal(match.catalogId, id, `${name} → ${match.catalogId}`);
      assert.ok(EXERCISE_CATALOG.some((row) => row.id === id), id);
    }
  }
});

test("разные движения не сливаются в одну позицию", () => {
  for (const [left, right] of DISTINCT_MOVEMENTS) {
    const a = matchExerciseName(left);
    const b = matchExerciseName(right);
    assert.equal(a.status, "confident", left);
    assert.equal(b.status, "confident", right);
    if (a.status === "confident" && b.status === "confident") {
      assert.notEqual(a.catalogId, b.catalogId, `${left} / ${right}`);
    }
  }
});

test("ё, скобки и смесь русского с английским не мешают жиму в тренажёре", () => {
  const paren = matchExerciseName("Подъём на плечи в тренажёре (shoulder press)");
  assert.equal(paren.status, "confident");
  if (paren.status === "confident") assert.equal(paren.catalogId, "machine-ohp");

  const folded = matchExerciseName("Тренажер на плечи шолдер пресс");
  assert.equal(folded.status, "confident");
  if (folded.status === "confident") assert.equal(folded.catalogId, "machine-ohp");

  const bare = matchExerciseName("шолдер пресс");
  assert.equal(bare.status, "confident");
  if (bare.status === "confident") assert.equal(bare.catalogId, "ohp");
});

test("лишние «стоя» и «в тренажере» не создают новое движение и не склеивают другое", () => {
  const standing = matchExerciseName("Ножной жим стоя");
  assert.equal(standing.status, "confident");
  if (standing.status === "confident") assert.equal(standing.catalogId, "leg-press");

  const machine = matchExerciseName("Разгибание ног в тренажёре");
  assert.equal(machine.status, "confident");
  if (machine.status === "confident") assert.equal(machine.catalogId, "leg-ext");

  const grip = matchExerciseName("Подъем штанги на бицепс стоя обратным хватом");
  assert.notEqual(grip.status === "confident" ? grip.catalogId : null, "bb-curl");
});

test("сид обновляет синонимы и добавляет позиции, не меняя и не удаляя id", () => {
  const rows = EXERCISE_CATALOG.map(toCatalogSeedData);
  const ids = rows.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length);

  const previous = ids.filter((id) => !NEW_IDS.includes(id as (typeof NEW_IDS)[number]));
  const plan = planCatalogUpsert([...previous, "legacy-custom"], rows);
  assert.deepEqual(
    plan.inserts.map((row) => row.id).sort(),
    [...NEW_IDS].sort(),
  );
  assert.equal(plan.updates.length, previous.length);
  assert.deepEqual(plan.kept, ["legacy-custom"]);
  for (const row of plan.updates) {
    assert.equal(row.id, ids.find((id) => id === row.id));
  }
  const pec = plan.updates.find((row) => row.id === "pec-deck");
  assert.ok(pec?.synonyms.includes("сведение на грудь в тренажере"));
  assert.ok(pec?.synonyms.includes("бабочка"));
  assert.equal(plan.updates.find((row) => row.id === "bench-press")?.id, "bench-press");

  const filled = planCatalogUpsert(ids, rows);
  assert.equal(filled.inserts.length, 0);
  assert.equal(filled.updates.length, rows.length);
  assert.deepEqual(filled.kept, []);
  const machine = filled.updates.find((row) => row.id === "machine-ohp");
  assert.ok(machine?.synonyms.some((item) => item.toLowerCase().includes("shoulder press")));
});
