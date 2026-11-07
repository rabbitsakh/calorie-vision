import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APP_VERSION_BASE,
  APP_VERSION_EPOCH_MERGES,
  formatAppVersion,
  getAppVersionLabel,
  incrementAppVersion,
  versionFromPullRequestCount,
  versionFromSequence,
} from "./app-version.ts";
import { readPackageVersion } from "./read-package-version.ts";

test("formats a visible app version and appends the build sha when it is stamped", () => {
  assert.equal(formatAppVersion("0.4.0"), "v0.4.0");
  assert.match(readPackageVersion(), /^\d+\.\d+\.\d+$/);
  const prevVersion = process.env.NEXT_PUBLIC_APP_VERSION;
  const prevCommit = process.env.NEXT_PUBLIC_APP_COMMIT;
  process.env.NEXT_PUBLIC_APP_VERSION = "3.5.18";
  process.env.NEXT_PUBLIC_APP_COMMIT = "361e572";
  try {
    assert.equal(getAppVersionLabel(), "v3.5.18 · 361e572");
  } finally {
    if (prevVersion === undefined) delete process.env.NEXT_PUBLIC_APP_VERSION;
    else process.env.NEXT_PUBLIC_APP_VERSION = prevVersion;
    if (prevCommit === undefined) delete process.env.NEXT_PUBLIC_APP_COMMIT;
    else process.env.NEXT_PUBLIC_APP_COMMIT = prevCommit;
  }
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
