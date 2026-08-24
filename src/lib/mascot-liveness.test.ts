import assert from "node:assert/strict";
import { test } from "node:test";
import {
  gestureDurationMs,
  mascotGestureClass,
  pickIdleGesture,
  IDLE_GESTURES,
} from "./mascot-liveness.ts";
import { mascotMotionClass } from "@/components/Mascot";

test("mascotMotionClass maps poses", () => {
  assert.equal(mascotMotionClass("cheer"), "mascot-motion mascot-cheer");
  assert.equal(mascotMotionClass("idle"), "mascot-motion mascot-idle");
});

test("mascotGestureClass empty for none", () => {
  assert.equal(mascotGestureClass("none"), "");
  assert.equal(mascotGestureClass("pet"), "mascot-gesture mascot-gesture-pet");
  assert.equal(mascotGestureClass("look"), "mascot-gesture mascot-gesture-look");
});

test("pickIdleGesture returns known idle gestures", () => {
  for (let i = 0; i < 20; i++) {
    const g = pickIdleGesture();
    assert.ok(IDLE_GESTURES.includes(g));
  }
});

test("gestureDurationMs positive for one-shots", () => {
  assert.ok(gestureDurationMs("pet") > 0);
  assert.ok(gestureDurationMs("react") > 0);
  assert.equal(gestureDurationMs("none"), 0);
});
