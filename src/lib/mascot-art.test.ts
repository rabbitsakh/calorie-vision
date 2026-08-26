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

  test("mascotArtUrl uses seasonal folders for all poses", () => {
    assert.equal(mascotArtUrl("idle", "winter"), "/mascot/art/winter/idle.webp");
    assert.equal(mascotArtUrl("cheer", "winter"), "/mascot/art/winter/cheer.webp");
    assert.equal(mascotArtUrl("pet", "autumn"), "/mascot/art/autumn/pet.webp");
    assert.equal(mascotArtUrl("streak", "winter"), "/mascot/art/winter/streak.webp");
    assert.equal(mascotArtUrl("goal", "halloween"), "/mascot/art/halloween/goal.webp");
    assert.equal(mascotArtUrl("empty", "spring"), "/mascot/art/spring/empty.webp");
    assert.equal(mascotArtUrl("tip", "summer"), "/mascot/art/summer/tip.webp");
  });

  test("mascotArtUrl uses holiday event packs", () => {
    assert.equal(mascotArtUrl("idle", "feb23"), "/mascot/art/feb23/idle.webp");
    assert.equal(mascotArtUrl("cheer", "march8"), "/mascot/art/march8/cheer.webp");
    assert.equal(mascotArtUrl("pet", "valentine"), "/mascot/art/valentine/pet.webp");
    assert.equal(mascotArtUrl("tip", "cosmonaut"), "/mascot/art/cosmonaut/tip.webp");
    assert.equal(mascotArtUrl("streak", "victory"), "/mascot/art/victory/streak.webp");
    assert.equal(mascotArtUrl("goal", "knowledge"), "/mascot/art/knowledge/goal.webp");
    assert.equal(mascotArtUrl("empty", "feb23"), "/mascot/art/feb23/empty.webp");
  });

  test("mascotArtUrl falls back to default for default skin", () => {
    assert.equal(mascotArtUrl("streak", "default"), "/mascot/art/streak.webp");
    assert.equal(mascotArtUrl("goal", "default"), "/mascot/art/goal.webp");
  });

  test("resolveMascotArtPose maps pet/react gestures", () => {
    assert.equal(resolveMascotArtPose("idle", "none"), "idle");
    assert.equal(resolveMascotArtPose("idle", "pet"), "pet");
    assert.equal(resolveMascotArtPose("tip", "react"), "cheer");
    assert.equal(resolveMascotArtPose("goal", "look"), "goal");
  });

  test("shouldUseMascotArt prefers art in auto for all sizes", () => {
    assert.equal(shouldUseMascotArt({ mode: "auto", size: "sm", reducedMotion: false }), true);
    assert.equal(shouldUseMascotArt({ mode: "auto", size: "md", reducedMotion: false }), true);
    assert.equal(shouldUseMascotArt({ mode: "art", size: "sm", reducedMotion: false }), true);
    assert.equal(shouldUseMascotArt({ mode: "rive", size: "xl", reducedMotion: false }), false);
  });
});
