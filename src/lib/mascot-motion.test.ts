import assert from "node:assert/strict";
import { test } from "node:test";
import { mascotMotionClass } from "@/components/Mascot";

test("mascotMotionClass maps poses to motion classes", () => {
  assert.equal(mascotMotionClass("idle"), "mascot-motion mascot-idle");
  assert.equal(mascotMotionClass("cheer"), "mascot-motion mascot-cheer");
  assert.equal(mascotMotionClass("streak"), "mascot-motion mascot-streak");
  assert.equal(mascotMotionClass("goal"), "mascot-motion mascot-goal");
  assert.equal(mascotMotionClass("tip"), "mascot-motion mascot-tip");
  assert.equal(mascotMotionClass("empty"), "mascot-motion mascot-empty");
});
