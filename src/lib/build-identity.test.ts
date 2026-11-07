import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildHealthBody,
  displayedBuildCommit,
  displayedBuildVersion,
  formatBuildVersionLabel,
  stampBuildVersion,
} from "./build-identity.ts";

test("штамп сборки берёт счётчик PR, а не застывший package.json 3.1.7", () => {
  const stamped = stampBuildVersion(659, "3.1.7");
  assert.equal(stamped, "3.5.18");
  assert.notEqual(stamped, "3.1.7");
});

test("без git остаётся semver из package.json, а не 0.4.0", () => {
  assert.equal(stampBuildVersion(null, "3.1.7"), "3.1.7");
  assert.equal(stampBuildVersion(0, "3.1.7"), "3.1.7");
});

test("health предпочитает версию, зашитую в сборку, даже если package.json откатили", () => {
  const version = displayedBuildVersion("3.5.11", 659, "3.1.7");
  assert.equal(version, "3.5.11");
  const body = buildHealthBody({ version, commit: "361e572" });
  assert.equal(body.ok, true);
  assert.equal(body.service, "calorie-vision");
  assert.equal(body.version, "3.5.11");
  assert.equal(body.commit, "361e572");
  assert.match(body.version, /^\d+\.\d+\.\d+$/);
});

test("если штампа нет, версия считается по git, а не по откатанному package.json", () => {
  assert.equal(displayedBuildVersion(undefined, 659, "3.1.7"), "3.5.18");
  assert.equal(displayedBuildVersion("не-версия", 659, "3.1.7"), "3.5.18");
});

test("короткий sha и подпись UI", () => {
  assert.equal(displayedBuildCommit("361e572", "aaaaaaaa"), "361e572");
  assert.equal(displayedBuildCommit("", "abc1234"), "abc1234");
  assert.equal(displayedBuildCommit("нет", "too-short"), null);
  assert.equal(formatBuildVersionLabel("3.5.18", "361e572"), "v3.5.18 · 361e572");
  assert.equal(formatBuildVersionLabel("3.5.18", null), "v3.5.18");
});
