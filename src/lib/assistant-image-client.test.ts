import assert from "node:assert/strict";
import { test } from "node:test";
import { assistantImageScale, ASSISTANT_IMAGE_MAX_EDGE } from "./assistant-image-client.ts";

test("assistantImageScale keeps small images at 1", () => {
  assert.equal(assistantImageScale(800, 600), 1);
  assert.equal(assistantImageScale(ASSISTANT_IMAGE_MAX_EDGE, 900), 1);
});

test("assistantImageScale shrinks long edge to max", () => {
  const scale = assistantImageScale(4000, 3000);
  assert.ok(scale < 1);
  assert.equal(Math.round(4000 * scale), ASSISTANT_IMAGE_MAX_EDGE);
  assert.equal(Math.round(3000 * scale), Math.round((3000 * ASSISTANT_IMAGE_MAX_EDGE) / 4000));
});
