/**
 * Контракт формы /try и гостевого API. Без живого GigaChat и без чужих фото:
 * синтетический PNG и проверка квоты в памяти процесса.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import sharp from "sharp";
import {
  appendRecognizePhoto,
  guestMacroLine,
  RECOGNIZE_PHOTO_FIELD,
} from "./guest-recognize.ts";
import { gateGuestRecognize } from "./guest-recognize-gate.ts";
import { resetRateLimitsForTests } from "./rate-limit.ts";
import { prepareRecognizeUpload } from "./recognize-upload.ts";

const IP = "203.0.113.44";

async function syntheticLabelFile(): Promise<File> {
  const png = await sharp({
    create: {
      width: 12,
      height: 12,
      channels: 3,
      background: { r: 240, g: 240, b: 240 },
    },
  })
    .png()
    .toBuffer();
  return new File([png], "synthetic-label.png", { type: "image/png" });
}

function guestRequest(body?: BodyInit, contentType?: string, ip = IP): NextRequest {
  const headers = new Headers({ "x-forwarded-for": ip });
  if (contentType) headers.set("content-type", contentType);
  return new NextRequest("http://localhost/api/recognize/guest", {
    method: "POST",
    headers,
    body,
  });
}

test("форма /try кладёт файл в photo, и API его принимает", async () => {
  const file = await syntheticLabelFile();
  const form = new FormData();
  appendRecognizePhoto(form, file);
  assert.equal(form.has(RECOGNIZE_PHOTO_FIELD), true);
  assert.equal(form.has("image"), false);
  const prepared = await prepareRecognizeUpload(form);
  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;
  assert.ok(prepared.data.compressed.buffer.length > 0);
});

test("устаревшее поле image тоже не отвечает «Фото не найдено»", async () => {
  const file = await syntheticLabelFile();
  const form = new FormData();
  form.append("image", file, "synthetic-label.png");
  const prepared = await prepareRecognizeUpload(form);
  assert.equal(prepared.ok, true);
});

test("нет файла и не-multipart — 400, квота гостя не тратится", async () => {
  resetRateLimitsForTests();
  const cases: Array<{ name: string; request: NextRequest; status: number; error: RegExp }> = [
    {
      name: "json",
      request: guestRequest("{}", "application/json"),
      status: 400,
      error: /multipart/i,
    },
    {
      name: "пустой multipart",
      request: guestRequest(new FormData()),
      status: 400,
      error: /Фото не найдено/,
    },
    {
      name: "пустой файл",
      request: guestRequest(
        (() => {
          const form = new FormData();
          form.append("photo", new File([], "empty.jpg", { type: "image/jpeg" }));
          return form;
        })(),
      ),
      status: 400,
      error: /Фото не найдено/,
    },
    {
      name: "не изображение",
      request: guestRequest(
        (() => {
          const form = new FormData();
          form.append("photo", new File(["hello"], "note.txt", { type: "text/plain" }));
          return form;
        })(),
      ),
      status: 400,
      error: /изображен/i,
    },
  ];

  for (const row of cases) {
    const gate = await gateGuestRecognize(row.request, IP);
    assert.equal(gate.ok, false, row.name);
    if (gate.ok) return;
    assert.equal(gate.status, row.status, row.name);
    assert.match(gate.error, row.error, row.name);
    assert.notEqual(gate.status, 500, row.name);
  }

  const file = await syntheticLabelFile();
  const good = () => {
    const form = new FormData();
    appendRecognizePhoto(form, file);
    return guestRequest(form);
  };
  assert.equal((await gateGuestRecognize(good(), IP)).ok, true);
  assert.equal((await gateGuestRecognize(good(), IP)).ok, true);
  const blocked = await gateGuestRecognize(good(), IP);
  assert.equal(blocked.ok, false);
  if (blocked.ok) return;
  assert.equal(blocked.status, 429);
  assert.match(blocked.error, /2 фото/);
  assert.ok((blocked.retryAfterSec ?? 0) > 0);
});

test("строка БЖУ показывает настоящий ноль и не выдумывает пустые поля", () => {
  assert.equal(guestMacroLine({ protein: 10, fat: 12, carbs: 25 }), "Б 10 · Ж 12 · У 25");
  assert.equal(guestMacroLine({ protein: 0, fat: 0, carbs: 0 }), "Б 0 · Ж 0 · У 0");
  assert.equal(guestMacroLine({}), null);
});
