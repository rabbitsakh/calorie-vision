import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { pickSaveReactionLine, SAVE_REACTION_LINES } from "./save-reaction-copy.ts";

describe("save-reaction-copy", () => {
  test("first meal today gets a dedicated line", () => {
    assert.match(pickSaveReactionLine({ firstMealToday: true }), /Первый приём/);
  });

  test("pickSaveReactionLine rotates deterministically", () => {
    assert.equal(pickSaveReactionLine({ seed: 0 }), SAVE_REACTION_LINES[0]);
    assert.equal(
      pickSaveReactionLine({ seed: 2 }),
      SAVE_REACTION_LINES[2 % SAVE_REACTION_LINES.length],
    );
  });
});
