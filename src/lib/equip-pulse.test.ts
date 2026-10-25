import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  EQUIP_PULSE_EVENT,
  emitEquipPulse,
  subscribeEquipPulse,
} from "./equip-pulse.ts";

describe("equip-pulse", () => {
  test("emit delivers kind + key to subscribers", () => {
    const seen: { kind: string; rewardKey: string }[] = [];
    const unsub = subscribeEquipPulse((d) => seen.push(d));
    emitEquipPulse("sticker", "sticker_sprout");
    unsub();
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.kind, "sticker");
    assert.equal(seen[0]?.rewardKey, "sticker_sprout");
  });

  test("kind filter skips other slots", () => {
    const seen: string[] = [];
    const unsub = subscribeEquipPulse((d) => seen.push(d.kind), "frame");
    emitEquipPulse("sticker", "sticker_cup");
    emitEquipPulse("frame", "frame_teal");
    unsub();
    assert.deepEqual(seen, ["frame"]);
  });

  test("empty key is a no-op", () => {
    let n = 0;
    const unsub = subscribeEquipPulse(() => {
      n += 1;
    });
    emitEquipPulse("cheer", "   ");
    unsub();
    assert.equal(n, 0);
  });

  test("event name is stable", () => {
    assert.equal(EQUIP_PULSE_EVENT, "cv-equip-pulse");
  });
});
