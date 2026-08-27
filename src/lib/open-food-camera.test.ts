import assert from "node:assert/strict";
import { test } from "node:test";
import { OPEN_FOOD_CAMERA_EVENT } from "./open-food-camera.ts";

test("open food camera event name is stable", () => {
  assert.equal(OPEN_FOOD_CAMERA_EVENT, "cv-open-food-camera");
});
