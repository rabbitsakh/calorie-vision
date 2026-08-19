import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APP_VERSION_BASE,
  APP_VERSION_EPOCH_MERGES,
  formatAppVersion,
  incrementAppVersion,
  versionFromPullRequestCount,
  versionFromSequence,
} from "./app-version.ts";
import { readPackageVersion } from "./read-package-version.ts";

test("formats a visible app version without a build hash", () => {
  assert.equal(formatAppVersion("0.4.0"), "v0.4.0");
  assert.match(readPackageVersion(), /^\d+\.\d+\.\d+$/);
});

test("increments Z every PR, Y every 20 Z, X every 10 Y", () => {
  assert.equal(incrementAppVersion("0.4.0"), "0.4.1");
  assert.equal(incrementAppVersion("0.4.18"), "0.4.19");
  assert.equal(incrementAppVersion("0.4.19"), "0.5.0");
  assert.equal(incrementAppVersion("0.5.9"), "0.5.10");
  assert.equal(incrementAppVersion("0.9.19"), "1.0.0");
});

test("maps 1-based sequence to versions starting at 0.4.0", () => {
  assert.equal(APP_VERSION_BASE, "0.4.0");
  assert.equal(versionFromSequence(1), "0.4.0");
  assert.equal(versionFromSequence(2), "0.4.1");
  assert.equal(versionFromSequence(20), "0.4.19");
  assert.equal(versionFromSequence(21), "0.5.0");
  assert.equal(versionFromSequence(30), "0.5.9");
  assert.equal(versionFromSequence(31), "0.5.10");
});

test("maps merged PR count onto the shifted version sequence", () => {
  assert.equal(versionFromPullRequestCount(APP_VERSION_EPOCH_MERGES), "0.4.0");
  assert.equal(versionFromPullRequestCount(APP_VERSION_EPOCH_MERGES + 29), "0.5.9");
  assert.equal(versionFromPullRequestCount(APP_VERSION_EPOCH_MERGES + 30), "0.5.10");
});
