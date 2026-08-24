import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createRuSpeechRecognition,
  getSpeechRecognitionCtor,
  isSpeechRecognitionSupported,
} from "./speech-recognition.ts";

test("isSpeechRecognitionSupported is false without browser APIs", () => {
  assert.equal(isSpeechRecognitionSupported({} as typeof globalThis), false);
  assert.equal(getSpeechRecognitionCtor({} as typeof globalThis), null);
  assert.equal(createRuSpeechRecognition({} as typeof globalThis), null);
});

test("createRuSpeechRecognition configures ru-RU when ctor exists", () => {
  class FakeRecognition {
    lang = "";
    interimResults = true;
    continuous = true;
    onresult = null;
    onerror = null;
    onend = null;
    start() {}
    stop() {}
    abort() {}
  }

  const recognition = createRuSpeechRecognition({
    SpeechRecognition: FakeRecognition,
  } as unknown as typeof globalThis);

  assert.ok(recognition);
  assert.equal(recognition!.lang, "ru-RU");
  assert.equal(recognition!.interimResults, false);
  assert.equal(recognition!.continuous, false);
});
