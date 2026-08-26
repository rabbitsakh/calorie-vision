import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getMetrikaConsent,
  hasAcceptedMetrikaConsent,
  METRIKA_CONSENT_KEY,
  parseMetrikaConsent,
  resetMetrikaConsentForTests,
  setMetrikaConsent,
} from "./metrika-consent.ts";

test("parseMetrikaConsent accepts only known values", () => {
  assert.equal(parseMetrikaConsent("accepted"), "accepted");
  assert.equal(parseMetrikaConsent("declined"), "declined");
  assert.equal(parseMetrikaConsent(""), null);
  assert.equal(parseMetrikaConsent("yes"), null);
  assert.equal(parseMetrikaConsent(undefined), null);
});

test("consent helpers round-trip via localStorage when available", () => {
  resetMetrikaConsentForTests();
  assert.equal(getMetrikaConsent(), null);
  assert.equal(hasAcceptedMetrikaConsent(), false);

  // jsdom/node may not have window — skip storage assertions in that case
  const store = (globalThis as { localStorage?: Storage }).localStorage;
  if (!store) {
    return;
  }

  setMetrikaConsent("accepted");
  assert.equal(store.getItem(METRIKA_CONSENT_KEY), "accepted");
  assert.equal(getMetrikaConsent(), "accepted");
  assert.equal(hasAcceptedMetrikaConsent(), true);

  setMetrikaConsent("declined");
  assert.equal(hasAcceptedMetrikaConsent(), false);
  assert.equal(getMetrikaConsent(), "declined");
  resetMetrikaConsentForTests();
});
