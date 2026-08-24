import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  mascotArtUrl,
  resolveMascotArtPose,
  shouldUseMascotArt,
} from "./mascot-art";

describe("mascot-art", () => {
  test("mascotArtUrl points at public webp stills", () => {
    assert.equal(mascotArtUrl("idle"), "/mascot/art/idle.webp");
    assert.equal(mascotArtUrl("pet"), "/mascot/art/pet.webp");
  });

  test("resolveMascotArtPose maps pet/react gestures", () => {
    assert.equal(resolveMascotArtPose("idle", "none"), "idle");
    assert.equal(resolveMascotArtPose("idle", "pet"), "pet");
    assert.equal(resolveMascotArtPose("tip", "react"), "cheer");
    assert.equal(resolveMascotArtPose("goal", "look"), "goal");
  });

  test("shouldUseMascotArt prefers art in auto for md+", () => {
    assert.equal(shouldUseMascotArt({ mode: "auto", size: "sm", reducedMotion: false }), false);
    assert.equal(shouldUseMascotArt({ mode: "auto", size: "md", reducedMotion: false }), true);
    assert.equal(shouldUseMascotArt({ mode: "art", size: "sm", reducedMotion: false }), true);
    assert.equal(shouldUseMascotArt({ mode: "svg", size: "xl", reducedMotion: false }), false);
    assert.equal(shouldUseMascotArt({ mode: "rive", size: "xl", reducedMotion: false }), false);
  });
});
