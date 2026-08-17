import assert from "node:assert/strict";
import { test } from "node:test";
import { formatAppVersion } from "./app-version.ts";

test("formats a visible app version and build sha", () => {
  assert.equal(formatAppVersion("0.2.0", "f54c747"), "v0.2.0 · f54c747");
});
