import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APP_VERSION_BASE,
  formatAppVersion,
  incrementAppVersion,
  versionFromCommitCount,
  versionFromSequence,
} from "./app-version.ts";

test("formats a visible app version without a build hash", () => {
  assert.equal(formatAppVersion("0.4.0"), "v0.4.0");
});

test("increments patch until 9, then bumps minor", () => {
  assert.equal(incrementAppVersion("0.4.0"), "0.4.1");
  assert.equal(incrementAppVersion("0.4.8"), "0.4.9");
  assert.equal(incrementAppVersion("0.4.9"), "0.5.0");
  assert.equal(incrementAppVersion("0.5.0"), "0.5.1");
  assert.equal(incrementAppVersion("0.9.9"), "1.0.0");
  assert.equal(incrementAppVersion("1.0.9"), "1.1.0");
});

test("maps 1-based sequence to versions starting at 0.4.0", () => {
  assert.equal(APP_VERSION_BASE, "0.4.0");
  assert.equal(versionFromSequence(1), "0.4.0");
  assert.equal(versionFromSequence(2), "0.4.1");
  assert.equal(versionFromSequence(9), "0.4.8");
  assert.equal(versionFromSequence(10), "0.4.9");
  assert.equal(versionFromSequence(11), "0.5.0");
  assert.equal(versionFromSequence(12), "0.5.1");
});

test("maps git commit count onto the shifted version sequence", () => {
  assert.equal(versionFromCommitCount(69), "0.4.0");
  assert.equal(versionFromCommitCount(70), "0.4.0");
  assert.equal(versionFromCommitCount(71), "0.4.1");
  assert.equal(versionFromCommitCount(79), "0.4.9");
  assert.equal(versionFromCommitCount(80), "0.5.0");
  assert.equal(versionFromCommitCount(89), "0.5.9");
});
