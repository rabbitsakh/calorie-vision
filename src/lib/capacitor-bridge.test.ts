import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectCapacitorShell,
  isCapacitorNative,
  takeNativeFoodPhoto,
  waitForCapacitorNative,
} from "./capacitor-bridge.ts";

describe("capacitor-bridge", () => {
  it("isCapacitorNative is false without window Capacitor", () => {
    assert.equal(isCapacitorNative(), false);
  });

  it("waitForCapacitorNative resolves false on web quickly", async () => {
    assert.equal(await waitForCapacitorNative(80), false);
  });

  it("detectCapacitorShell resolves false on web quickly", async () => {
    assert.equal(await detectCapacitorShell(80), false);
  });

  it("takeNativeFoodPhoto returns null on web", async () => {
    assert.equal(await takeNativeFoodPhoto(), null);
  });
});
