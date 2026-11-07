import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  attributionFromSearch,
  hrefWithAttribution,
  mergeFirstTouch,
  parseSignupAttribution,
  signupSourceLabel,
} from "./signup-attribution.ts";

test("из адреса берутся только utm и без управляющих символов", () => {
  const parsed = attributionFromSearch(
    "?utm_source=vk&utm_medium=cpc&utm_campaign=nov&utm_content=hero&foo=1&utm_term=еда",
  );
  assert.deepEqual(parsed, {
    utm_source: "vk",
    utm_medium: "cpc",
    utm_campaign: "nov",
    utm_content: "hero",
    utm_term: "еда",
  });
  assert.equal(parseSignupAttribution(new URLSearchParams("utm_source=%0Aevil")), null);
  assert.equal(parseSignupAttribution(new URLSearchParams("q=1")), null);
});

test("первое касание не затирается, ссылки уносят метки на try и login", () => {
  const first = { utm_source: "vk", utm_campaign: "nov" };
  assert.deepEqual(mergeFirstTouch(first, { utm_source: "google" }), first);
  assert.deepEqual(mergeFirstTouch(null, { utm_source: "google" }), { utm_source: "google" });
  assert.equal(
    hrefWithAttribution("/try", first),
    "/try?utm_source=vk&utm_campaign=nov",
  );
  assert.equal(
    hrefWithAttribution("/login?ref=abc", first),
    "/login?ref=abc&utm_source=vk&utm_campaign=nov",
  );
  assert.equal(signupSourceLabel(first), "vk · nov");
});

test("рекламная страница не вызывает гостевое распознавание", () => {
  const page = readFileSync(join(process.cwd(), "src/app/go/page.tsx"), "utf8");
  const landing = readFileSync(join(process.cwd(), "src/components/GoLanding.tsx"), "utf8");
  const joined = `${page}\n${landing}`;
  assert.doesNotMatch(joined, /recognize\/guest|GuestTryClient|appendRecognizePhoto/);
  assert.match(page, /Попробовать бесплатно|openGraph/);
  assert.match(landing, /Попробовать бесплатно/);
  assert.match(landing, /rustore|RuStore|getRustoreUrl/i);
});
