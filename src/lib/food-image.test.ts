import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildFoodImageWikiQueries,
  findFoodImage,
  isAmbiguousBareImageQuery,
  isAllowedImageUrl,
  isRejectedWikiTitle,
  listCommonsImages,
  listWikipediaThumbnails,
} from "./food-image.ts";

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
          "4": {
            index: 3,
            title: "Portrait of a scientist",
            thumbnail: { source: "https://upload.wikimedia.org/wikipedia/commons/man.jpg" },
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

test("rejects non-food wiki titles like masks and biographies", () => {
  assert.equal(isRejectedWikiTitle("Маска (значения)"), true);
  assert.equal(isRejectedWikiTitle("Portrait of Einstein"), true);
  assert.equal(isRejectedWikiTitle("Carnival costume"), true);
  assert.equal(isRejectedWikiTitle("Борщ"), false);
});

test("ambiguous bare brands must not be wiki-searched as-is", () => {
  assert.equal(isAmbiguousBareImageQuery("Маска"), true);
  assert.equal(isAmbiguousBareImageQuery("Bombbar"), true);
  assert.equal(isAmbiguousBareImageQuery("борщ"), false);
  assert.equal(isAmbiguousBareImageQuery("гречневая каша"), false);
});

test("wiki queries always add food/product context for brands", () => {
  const qs = buildFoodImageWikiQueries("конфеты Маска");
  assert.ok(qs.some((q) => /продукт/i.test(q)));
  assert.ok(qs.every((q) => !/^маска$/i.test(q.trim())));
  assert.ok(!qs.includes("Маска"));
});

test("auto findFoodImage prefers OFF product url when present", async () => {
  const off = await findFoodImage({
    query: "Bombbar",
    productImageUrl: "https://images.openfoodfacts.org/bombbar.jpg",
    mode: "auto",
  });
  assert.equal(off, "https://images.openfoodfacts.org/bombbar.jpg");
});
