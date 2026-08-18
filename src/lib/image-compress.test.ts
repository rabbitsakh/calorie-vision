import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { compressFoodImage, FOOD_IMAGE_MAX_BYTES, FOOD_IMAGE_MAX_EDGE } from "./image-compress.ts";
import { mealNeedsImage, normalizeDishName } from "./meal-image.ts";

test("compresses a large png into a smaller webp within the display size", async () => {
  const png = await sharp({
    create: {
      width: 1600,
      height: 1200,
      channels: 3,
      noise: { type: "gaussian", mean: 128, sigma: 40 },
    },
  })
    .png()
    .toBuffer();

  const result = await compressFoodImage(png);
  assert.equal(result.mimeType, "image/webp");
  assert.ok(result.buffer.length < png.length);
  assert.ok(result.buffer.length <= FOOD_IMAGE_MAX_BYTES);

  const meta = await sharp(result.buffer).metadata();
  assert.equal(meta.format, "webp");
  assert.ok((meta.width ?? 0) <= FOOD_IMAGE_MAX_EDGE);
  assert.ok((meta.height ?? 0) <= FOOD_IMAGE_MAX_EDGE);
});

test("normalizes dish names so the same meal reuses one photo", () => {
  assert.equal(normalizeDishName("Борщ  с мясом"), normalizeDishName("борщ с мясом"));
  assert.equal(normalizeDishName("Ёжик"), "ежик");
});

test("treats missing and remote hotlinked photos as needing a cached image", () => {
  assert.equal(mealNeedsImage(null), true);
  assert.equal(mealNeedsImage(""), true);
  assert.equal(mealNeedsImage("https://upload.wikimedia.org/wikipedia/commons/a.jpg"), true);
  assert.equal(mealNeedsImage("/api/uploads/abc"), false);
});
