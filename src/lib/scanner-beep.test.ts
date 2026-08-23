import assert from "node:assert/strict";
import { test } from "node:test";
import { playScannerBeep } from "./scanner-beep.ts";

test("playScannerBeep is a safe no-op without AudioContext", () => {
  assert.doesNotThrow(() => playScannerBeep());
});
