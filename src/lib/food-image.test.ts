import assert from "node:assert/strict";
import { test } from "node:test";
import { listCommonsImages, listWikipediaThumbnails, isAllowedImageUrl } from "./food-image.ts";

test("isAllowedImageUrl accepts OFF and Wikimedia hosts", () => {
  assert.equal(isAllowedImageUrl("https://images.openfoodfacts.org/a.jpg"), true);
  assert.equal(isAllowedImageUrl("https://upload.wikimedia.org/wikipedia/commons/a.jpg"), true);
  assert.equal(isAllowedImageUrl("https://evil.example/a.jpg"), false);
  assert.equal(isAllowedImageUrl("http://upload.wikimedia.org/a.jpg"), false);
});

test("listWikipediaThumbnails returns multiple safe thumbs", () => {
  const urls = listWikipediaThumbnails(
    {
      query: {
        pages: {
          "1": {
            index: 1,
            title: "Борщ",
            thumbnail: { source: "https://upload.wikimedia.org/wikipedia/commons/borsch.jpg" },
          },
          "2": {
            index: 2,
            title: "List of soups",
            thumbnail: { source: "https://upload.wikimedia.org/wikipedia/commons/list.jpg" },
          },
          "3": {
            index: 0,
            title: "Soup",
            thumbnail: { source: "https://upload.wikimedia.org/wikipedia/commons/soup.jpg" },
          },
        },
      },
    },
    5,
  );
  assert.deepEqual(urls, [
    "https://upload.wikimedia.org/wikipedia/commons/soup.jpg",
    "https://upload.wikimedia.org/wikipedia/commons/borsch.jpg",
  ]);
});

test("listCommonsImages skips svg and non-images", () => {
  const urls = listCommonsImages(
    {
      query: {
        pages: {
          a: {
            title: "File:Flag.svg",
            imageinfo: [{ mime: "image/svg+xml", url: "https://upload.wikimedia.org/flag.svg" }],
          },
          b: {
            title: "File:Pasta.jpg",
            imageinfo: [
              {
                mime: "image/jpeg",
                thumburl: "https://upload.wikimedia.org/pasta-thumb.jpg",
              },
            ],
          },
        },
      },
    },
    3,
  );
  assert.deepEqual(urls, ["https://upload.wikimedia.org/pasta-thumb.jpg"]);
});
