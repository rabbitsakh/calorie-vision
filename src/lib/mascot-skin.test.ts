import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  eventSkinForDate,
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

  test("eventSkinForDate picks halloween, newyear, feb23, and march8 windows", () => {
    assert.equal(eventSkinForDate(new Date(2026, 9, 28)), "halloween");
    assert.equal(eventSkinForDate(new Date(2026, 10, 1)), "halloween");
    assert.equal(eventSkinForDate(new Date(2026, 11, 25)), "newyear");
    assert.equal(eventSkinForDate(new Date(2027, 0, 5)), "newyear");
    assert.equal(eventSkinForDate(new Date(2026, 1, 20)), "feb23");
    assert.equal(eventSkinForDate(new Date(2026, 1, 23)), "feb23");
    assert.equal(eventSkinForDate(new Date(2026, 1, 24)), "feb23");
    assert.equal(eventSkinForDate(new Date(2026, 1, 19)), null);
    assert.equal(eventSkinForDate(new Date(2026, 2, 1)), "march8");
    assert.equal(eventSkinForDate(new Date(2026, 2, 8)), "march8");
    assert.equal(eventSkinForDate(new Date(2026, 2, 10)), "march8");
    assert.equal(eventSkinForDate(new Date(2026, 2, 11)), null);
    assert.equal(eventSkinForDate(new Date(2026, 6, 15)), null);
  });

  test("resolveMascotSkin prefers events over seasons", () => {
    assert.equal(resolveMascotSkin(new Date(2026, 11, 31)), "newyear");
    assert.equal(resolveMascotSkin(new Date(2026, 9, 30)), "halloween");
    assert.equal(resolveMascotSkin(new Date(2026, 1, 23)), "feb23");
    assert.equal(resolveMascotSkin(new Date(2026, 2, 8)), "march8");
  });

  test("resolveMascotSkin prefers explicit override", () => {
    assert.equal(resolveMascotSkin(new Date("2026-07-15"), "winter"), "winter");
  });

  test("parseMascotSkinId accepts known ids", () => {
    assert.equal(parseMascotSkinId("summer"), "summer");
    assert.equal(parseMascotSkinId("halloween"), "halloween");
    assert.equal(parseMascotSkinId("feb23"), "feb23");
    assert.equal(parseMascotSkinId("march8"), "march8");
    assert.equal(parseMascotSkinId("bogus"), null);
  });

  test("mascotRivUrl points at public mascot assets", () => {
    assert.equal(mascotRivUrl("winter"), "/mascot/winter.riv");
    assert.equal(mascotRivUrl("newyear"), "/mascot/newyear.riv");
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
    assert.equal(
      shouldUseMascotRive({ mode: "art", size: "xl", reducedMotion: false, riveAvailable: true }),
      false,
    );
  });
});
