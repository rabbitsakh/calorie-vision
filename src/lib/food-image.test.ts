import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isAllowedImageUrl,
  pickCommonsImage,
  pickWikipediaThumbnail,
} from "./food-image.ts";

test("allows Wikimedia and Open Food Facts image hosts", () => {
  assert.equal(
    isAllowedImageUrl("https://upload.wikimedia.org/wikipedia/commons/a/a0/Borscht.jpg"),
    true,
  );
  assert.equal(
    isAllowedImageUrl("https://images.openfoodfacts.org/images/products/460/front.jpg"),
    true,
  );
  assert.equal(isAllowedImageUrl("http://upload.wikimedia.org/wikipedia/commons/a.jpg"), false);
  assert.equal(isAllowedImageUrl("https://evil.example/food.jpg"), false);
});

test("picks the most relevant Wikipedia thumbnail and skips disambiguation pages", () => {
  const source = pickWikipediaThumbnail({
    query: {
      pages: {
        "1": {
          index: 2,
          title: "Борщ (значения)",
          thumbnail: { source: "https://upload.wikimedia.org/wikipedia/commons/d/d1/Disambig.jpg" },
        },
        "2": {
          index: 1,
          title: "Борщ",
          thumbnail: { source: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Borscht.jpg" },
        },
      },
    },
  });

  assert.equal(source, "https://upload.wikimedia.org/wikipedia/commons/a/a0/Borscht.jpg");
});

test("skips commons files that look like flags or diagrams", () => {
  const source = pickCommonsImage({
    query: {
      pages: {
        "1": {
          title: "File:Flag of Ukraine.svg",
          imageinfo: [
            {
              mime: "image/svg+xml",
              url: "https://upload.wikimedia.org/wikipedia/commons/4/49/Flag_of_Ukraine.svg",
            },
          ],
        },
        "2": {
          title: "File:Borscht with sour cream.jpg",
          imageinfo: [
            {
              mime: "image/jpeg",
              thumburl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Borscht.jpg/640px-Borscht.jpg",
            },
          ],
        },
      },
    },
  });

  assert.equal(
    source,
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Borscht.jpg/640px-Borscht.jpg",
  );
});
