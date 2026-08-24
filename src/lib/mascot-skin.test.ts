import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  mascotRivUrl,
  parseMascotSkinId,
  resolveMascotSkin,
  seasonalSkinForMonth,
  shouldUseMascotRive,
} from "./mascot-skin";

describe("mascot-skin", () => {
  test("seasonalSkinForMonth maps calendar months", () => {
    assert.equal(seasonalSkinForMonth(0), "winter");
    assert.equal(seasonalSkinForMonth(11), "winter");
    assert.equal(seasonalSkinForMonth(2), "spring");
    assert.equal(seasonalSkinForMonth(5), "summer");
    assert.equal(seasonalSkinForMonth(9), "autumn");
  });

  test("resolveMascotSkin prefers explicit override", () => {
    assert.equal(resolveMascotSkin(new Date("2026-07-15"), "winter"), "winter");
  });

  test("parseMascotSkinId accepts known ids", () => {
    assert.equal(parseMascotSkinId("summer"), "summer");
    assert.equal(parseMascotSkinId("bogus"), null);
  });

  test("mascotRivUrl points at public mascot assets", () => {
    assert.equal(mascotRivUrl("winter"), "/mascot/winter.riv");
  });

  test("shouldUseMascotRive respects size and reduced motion", () => {
    assert.equal(
      shouldUseMascotRive({ mode: "rive", size: "sm", reducedMotion: false, riveAvailable: true }),
      false,
    );
    assert.equal(
      shouldUseMascotRive({ mode: "rive", size: "lg", reducedMotion: true, riveAvailable: true }),
      false,
    );
    assert.equal(
      shouldUseMascotRive({ mode: "rive", size: "lg", reducedMotion: false, riveAvailable: true }),
      true,
    );
    assert.equal(
      shouldUseMascotRive({ mode: "svg", size: "xl", reducedMotion: false, riveAvailable: true }),
      false,
    );
  });
});
