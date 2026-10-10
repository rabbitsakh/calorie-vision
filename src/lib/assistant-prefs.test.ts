import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatAssistantPrefsBlock,
  mergeAssistantPrefs,
  parseAssistantPrefs,
} from "./assistant-prefs.ts";

test("parseAssistantPrefs clips and dedupes", () => {
  const prefs = parseAssistantPrefs({
    dislikes: [" Творог ", "творог", ""],
    likes: ["Курица"],
    notes: ["без сахара вечером"],
  });
  assert.deepEqual(prefs.dislikes, ["Творог"]);
  assert.deepEqual(prefs.likes, ["Курица"]);
});

test("merge + format", () => {
  const merged = mergeAssistantPrefs(parseAssistantPrefs({ dislikes: ["A"] }), {
    dislikes: ["B"],
    likes: ["C"],
  });
  assert.deepEqual(merged.dislikes, ["B"]);
  assert.match(formatAssistantPrefsBlock(merged), /Не предлагает: B/);
});
