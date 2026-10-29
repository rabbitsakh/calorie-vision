import assert from "node:assert/strict";
import { test } from "node:test";
import { assistantHandoffHref } from "./assistant-handoff.ts";

test("assistantHandoffHref: text, send flag and date", () => {
  const href = assistantHandoffHref("  2 яйца и кофе ", "2026-10-29");
  const url = new URL(href, "https://x.test");
  assert.equal(url.pathname, "/assistant");
  assert.equal(url.searchParams.get("q"), "2 яйца и кофе");
  assert.equal(url.searchParams.get("send"), "1");
  assert.equal(url.searchParams.get("date"), "2026-10-29");
});

test("assistantHandoffHref: no date param when omitted", () => {
  assert.equal(new URL(assistantHandoffHref("суп"), "https://x.test").searchParams.has("date"), false);
});
