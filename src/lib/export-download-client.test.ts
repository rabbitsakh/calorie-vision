import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { cvFilesBridge } from "./export/download-client.ts";

test("старая сборка без window.CvFiles не считается плагином — остаётся Web Share", () => {
  assert.equal(cvFilesBridge(null), null);
  assert.equal(cvFilesBridge({}), null);
  assert.equal(cvFilesBridge({ CvFiles: {} }), null);
  // На calorievision.ru нет внедрённого Capacitor JS. Плагин в Plugins.* оттуда не виден.
  assert.equal(
    cvFilesBridge({
      Capacitor: { Plugins: { CvFiles: { shareBase64: () => true } } },
    } as never),
    null,
  );
});

test("window.CvFiles.shareBase64 — тот же контракт на локальном shell и на сайте", () => {
  const seen: unknown[] = [];
  const bridge = cvFilesBridge({
    CvFiles: {
      shareBase64(filename: string, mime: string, base64: string) {
        seen.push(filename, mime, base64);
        return true;
      },
    },
  });
  assert.ok(bridge);
  assert.equal(bridge.shareBase64("вес.csv", "text/csv", "QQ=="), true);
  assert.deepEqual(seen, ["вес.csv", "text/csv", "QQ=="]);
});

test("клиент экспорта сначала зовёт CvFiles и только потом Web Share", () => {
  const source = readFileSync(new URL("./export/download-client.ts", import.meta.url), "utf8");
  const save = source.slice(source.indexOf("export async function saveExportFile"));
  const nativeCall = save.indexOf("native.shareBase64");
  const webShare = save.indexOf("tryWebShare(");
  assert.ok(nativeCall > 0);
  assert.ok(webShare > nativeCall);
  assert.match(save, /shareBase64\(filename, mime,/);
});
