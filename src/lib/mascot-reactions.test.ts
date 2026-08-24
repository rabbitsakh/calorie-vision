import assert from "node:assert/strict";
import { test } from "node:test";
import { emitMascotReaction, subscribeMascotReaction } from "./mascot-reactions.ts";

test("mascot reaction bus notifies subscribers", () => {
  const seen: string[] = [];
  const unsub = subscribeMascotReaction((kind) => {
    seen.push(kind);
  });
  emitMascotReaction("save");
  emitMascotReaction("pet");
  unsub();
  emitMascotReaction("tip");
  assert.deepEqual(seen, ["save", "pet"]);
});
