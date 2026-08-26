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

  test("eventSkinForDate picks holiday windows", () => {
    assert.equal(eventSkinForDate(new Date(2026, 1, 14)), "valentine");
    assert.equal(eventSkinForDate(new Date(2026, 1, 13)), "valentine");
    assert.equal(eventSkinForDate(new Date(2026, 1, 15)), "valentine");
    assert.equal(eventSkinForDate(new Date(2026, 1, 16)), null);
    assert.equal(eventSkinForDate(new Date(2026, 1, 20)), "feb23");
    assert.equal(eventSkinForDate(new Date(2026, 1, 23)), "feb23");
    assert.equal(eventSkinForDate(new Date(2026, 1, 24)), "feb23");
    assert.equal(eventSkinForDate(new Date(2026, 1, 19)), null);
    assert.equal(eventSkinForDate(new Date(2026, 2, 1)), "march8");
    assert.equal(eventSkinForDate(new Date(2026, 2, 8)), "march8");
    assert.equal(eventSkinForDate(new Date(2026, 2, 10)), "march8");
    assert.equal(eventSkinForDate(new Date(2026, 2, 11)), null);
    assert.equal(eventSkinForDate(new Date(2026, 3, 12)), "cosmonaut");
    assert.equal(eventSkinForDate(new Date(2026, 3, 11)), "cosmonaut");
    assert.equal(eventSkinForDate(new Date(2026, 3, 13)), "cosmonaut");
    assert.equal(eventSkinForDate(new Date(2026, 3, 10)), null);
    assert.equal(eventSkinForDate(new Date(2026, 4, 9)), "victory");
    assert.equal(eventSkinForDate(new Date(2026, 4, 7)), "victory");
    assert.equal(eventSkinForDate(new Date(2026, 4, 10)), "victory");
    assert.equal(eventSkinForDate(new Date(2026, 4, 6)), null);
    assert.equal(eventSkinForDate(new Date(2026, 7, 31)), "knowledge");
    assert.equal(eventSkinForDate(new Date(2026, 8, 1)), "knowledge");
    assert.equal(eventSkinForDate(new Date(2026, 8, 2)), "knowledge");
    assert.equal(eventSkinForDate(new Date(2026, 8, 3)), null);
    assert.equal(eventSkinForDate(new Date(2026, 9, 28)), "halloween");
    assert.equal(eventSkinForDate(new Date(2026, 10, 1)), "halloween");
    assert.equal(eventSkinForDate(new Date(2026, 11, 25)), "newyear");
    assert.equal(eventSkinForDate(new Date(2027, 0, 5)), "newyear");
    assert.equal(eventSkinForDate(new Date(2026, 6, 15)), null);
  });

  test("resolveMascotSkin prefers events over seasons", () => {
    assert.equal(resolveMascotSkin(new Date(2026, 11, 31)), "newyear");
    assert.equal(resolveMascotSkin(new Date(2026, 9, 30)), "halloween");
    assert.equal(resolveMascotSkin(new Date(2026, 1, 14)), "valentine");
    assert.equal(resolveMascotSkin(new Date(2026, 1, 23)), "feb23");
    assert.equal(resolveMascotSkin(new Date(2026, 2, 8)), "march8");
    assert.equal(resolveMascotSkin(new Date(2026, 3, 12)), "cosmonaut");
    assert.equal(resolveMascotSkin(new Date(2026, 4, 9)), "victory");
    assert.equal(resolveMascotSkin(new Date(2026, 8, 1)), "knowledge");
  });

  test("resolveMascotSkin prefers explicit override", () => {
    assert.equal(resolveMascotSkin(new Date("2026-07-15"), "winter"), "winter");
  });

  test("parseMascotSkinId accepts known ids", () => {
    assert.equal(parseMascotSkinId("summer"), "summer");
    assert.equal(parseMascotSkinId("halloween"), "halloween");
    assert.equal(parseMascotSkinId("feb23"), "feb23");
    assert.equal(parseMascotSkinId("march8"), "march8");
    assert.equal(parseMascotSkinId("valentine"), "valentine");
    assert.equal(parseMascotSkinId("cosmonaut"), "cosmonaut");
    assert.equal(parseMascotSkinId("victory"), "victory");
    assert.equal(parseMascotSkinId("knowledge"), "knowledge");
    assert.equal(parseMascotSkinId("bogus"), null);
  });

  test("mascotRivUrl points at public mascot assets", () => {
    assert.equal(mascotRivUrl("winter"), "/mascot/winter.riv");
    assert.equal(mascotRivUrl("newyear"), "/mascot/newyear.riv");
    assert.equal(mascotRivUrl("victory"), "/mascot/victory.riv");
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
      shouldUseMascotRive({ mode: "art", size: "xl", reducedMotion: false, riveAvailable: true }),
      false,
    );
    assert.equal(
      shouldUseMascotRive({ mode: "auto", size: "xl", reducedMotion: false, riveAvailable: true }),
      true,
    );
  });
});
