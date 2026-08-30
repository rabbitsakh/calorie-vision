import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMetrikaInitScript,
  METRIKA_GOALS,
  parseMetrikaId,
  resolveMetrikaId,
  shouldTrackMetrikaPath,
} from "./yandex-metrika.ts";

test("accepts numeric Metrika counter ids", () => {
  assert.equal(parseMetrikaId("12345678"), "12345678");
  assert.equal(parseMetrikaId(" 98765432 "), "98765432");
});

test("rejects empty and non-numeric ids", () => {
  assert.equal(parseMetrikaId(""), null);
  assert.equal(parseMetrikaId(undefined), null);
  assert.equal(parseMetrikaId("ym_123"), null);
  assert.equal(parseMetrikaId("<script>"), null);
});

test("falls through empty primary env to fallback id", () => {
  assert.equal(resolveMetrikaId("", "111847071"), "111847071");
  assert.equal(resolveMetrikaId("111847071", "999"), "111847071");
  assert.equal(resolveMetrikaId("", ""), null);
});

test("skips admin paths for Metrika hits", () => {
  assert.equal(shouldTrackMetrikaPath("/"), true);
  assert.equal(shouldTrackMetrikaPath("/ration"), true);
  assert.equal(shouldTrackMetrikaPath("/login"), true);
  assert.equal(shouldTrackMetrikaPath("/admin"), false);
  assert.equal(shouldTrackMetrikaPath("/admin/users"), false);
});

test("init snippet interpolates only a numeric id and sends the first hit", () => {
  const script = buildMetrikaInitScript("111847071");
  assert.match(script, /ym\(111847071,"init"/);
  assert.match(script, /ym\(111847071,"hit",location\.href\)/);
  assert.match(script, /mc\.yandex\.ru\/metrika\/tag\.js/);
  assert.equal(buildMetrikaInitScript("<script>"), "");
});

test("metrika funnel goal names are stable", () => {
  assert.equal(METRIKA_GOALS.login, "login");
  assert.equal(METRIKA_GOALS.firstMealSave, "first_meal_save");
  assert.equal(METRIKA_GOALS.photoRecognize, "photo_recognize");
  assert.equal(METRIKA_GOALS.mealSaved, "meal_saved");
  assert.equal(METRIKA_GOALS.waterLogged, "water_logged");
  assert.equal(METRIKA_GOALS.weightLogged, "weight_logged");
  assert.equal(METRIKA_GOALS.pushEnabled, "push_enabled");
  assert.equal(METRIKA_GOALS.d7Return, "d7_return");
  assert.equal(METRIKA_GOALS.chestOpened, "chest_opened");
  assert.equal(METRIKA_GOALS.frameEquipped, "frame_equipped");
  assert.equal(METRIKA_GOALS.metaChest, "meta_chest");
});
