import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildVisionPrompt,
  resolvePromptVariant,
  visionPromptCharLength,
} from "./prompt-variants.ts";

test("buildVisionPrompt includes barcode hint", () => {
  const prompt = buildVisionPrompt("slim", { barcodeHint: "4601234567890" });
  assert.match(prompt, /4601234567890/);
  assert.match(prompt, /штрихкод/i);
});

test("buildVisionPrompt adds aspect ratio hints", () => {
  const portrait = buildVisionPrompt("slim", { aspectRatio: 0.6 });
  const landscape = buildVisionPrompt("slim", { aspectRatio: 1.5 });
  assert.match(portrait, /вертикальное/i);
  assert.match(landscape, /горизонтальное/i);
});

test("buildVisionPrompt includes restaurant context hint", () => {
  const prompt = buildVisionPrompt("slim", { context: "restaurant" });
  assert.match(prompt, /столовая|ресторан/i);
  assert.match(prompt, /подносе|items/i);
});

test("slim prompt omits fiber/sugar from JSON shape", () => {
  const prompt = buildVisionPrompt("slim");
  assert.doesNotMatch(prompt, /"fiber"/);
  assert.doesNotMatch(prompt, /"sugar"/);
});

test("category-first prompt is longer than slim", () => {
  assert.ok(visionPromptCharLength("category-first") > visionPromptCharLength("slim"));
});

test("resolvePromptVariant reads env", () => {
  const prev = process.env.GIGACHAT_PROMPT_VARIANT;
  process.env.GIGACHAT_PROMPT_VARIANT = "category-first";
  assert.equal(resolvePromptVariant(), "category-first");
  process.env.GIGACHAT_PROMPT_VARIANT = prev;
});
