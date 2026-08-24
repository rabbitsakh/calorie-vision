import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { MASCOT_COPY } from "./mascot-copy";

describe("mascot-copy", () => {
  test("empty diary and push prompt strings are non-empty", () => {
    assert.ok(MASCOT_COPY.emptyDiary.title.length > 0);
    assert.ok(MASCOT_COPY.emptyDiary.headline.includes("Дневник"));
    assert.ok(MASCOT_COPY.emptyDiary.body.length > 10);
    assert.ok(MASCOT_COPY.pushPrompt.title.includes("талисмана"));
    assert.ok(MASCOT_COPY.pushPrompt.body.length > 10);
    assert.ok(MASCOT_COPY.pushIosHint.title.includes("iPhone"));
  });
});
