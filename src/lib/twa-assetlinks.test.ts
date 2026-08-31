import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAssetLinksDocument, parseTwaSha256Fingerprints } from "./twa-assetlinks.ts";

test("parseTwaSha256Fingerprints accepts colon hex from keytool", () => {
  const list = parseTwaSha256Fingerprints(
    "AB:CD:EF:00, 11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:01",
  );
  assert.equal(list.length, 2);
  assert.equal(list[0], "AB:CD:EF:00");
});

test("parseTwaSha256Fingerprints ignores empty", () => {
  assert.deepEqual(parseTwaSha256Fingerprints(""), []);
  assert.deepEqual(parseTwaSha256Fingerprints(undefined), []);
});

test("buildAssetLinksDocument wraps package and fingerprints", () => {
  const doc = buildAssetLinksDocument("ru.calorievision.app", ["AA:BB"]);
  assert.equal(doc[0]?.target.package_name, "ru.calorievision.app");
  assert.deepEqual(doc[0]?.target.sha256_cert_fingerprints, ["AA:BB"]);
});
