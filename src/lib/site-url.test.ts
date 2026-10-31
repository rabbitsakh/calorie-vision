import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { absoluteSiteUrl, getSiteOrigin } from "./site-url.ts";

describe("getSiteOrigin", () => {
  it("prefers NEXT_PUBLIC_SITE_URL over NEXTAUTH_URL", () => {
    assert.equal(
      getSiteOrigin("https://auth.example/path", "https://calorievision.ru"),
      "https://calorievision.ru",
    );
  });

  it("falls back to NEXTAUTH_URL origin", () => {
    assert.equal(
      getSiteOrigin("https://calorievision.ru/calorie-vision", undefined),
      "https://calorievision.ru",
    );
  });

  it("defaults to production origin", () => {
    assert.equal(getSiteOrigin(undefined, undefined), "https://calorievision.ru");
  });
});

describe("absoluteSiteUrl", () => {
  it("joins origin and path", () => {
    assert.equal(
      absoluteSiteUrl("/privacy/", "https://calorievision.ru"),
      "https://calorievision.ru/privacy/",
    );
  });

  it("treats empty path as root", () => {
    assert.equal(absoluteSiteUrl("/", "https://calorievision.ru"), "https://calorievision.ru/");
  });
});
