import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FOOD_RECOGNITION_PROMPT,
  FOOD_RECOGNITION_RETRY_PROMPT,
} from "./ai/prompt.ts";

describe("vision prompt budget", () => {
  it("keeps the main vision prompt under 3500 chars", () => {
    assert.ok(
      FOOD_RECOGNITION_PROMPT.length < 3500,
      `prompt too long: ${FOOD_RECOGNITION_PROMPT.length}`,
    );
  });

  it("uses a much shorter retry prompt than the main one", () => {
    assert.ok(FOOD_RECOGNITION_RETRY_PROMPT.length < 900);
    assert.ok(FOOD_RECOGNITION_RETRY_PROMPT.length < FOOD_RECOGNITION_PROMPT.length / 2);
  });
});
