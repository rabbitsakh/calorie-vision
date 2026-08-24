/** Minimal Web Speech API helpers — browser-only, graceful when unsupported. */

export type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getSpeechRecognitionCtor(
  globalObj: typeof globalThis = globalThis,
): SpeechRecognitionCtor | null {
  const w = globalObj as typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(
  globalObj: typeof globalThis = globalThis,
): boolean {
  return getSpeechRecognitionCtor(globalObj) !== null;
}

export function createRuSpeechRecognition(
  globalObj: typeof globalThis = globalThis,
): SpeechRecognitionLike | null {
  const Ctor = getSpeechRecognitionCtor(globalObj);
  if (!Ctor) {
    return null;
  }
  const recognition = new Ctor();
  recognition.lang = "ru-RU";
  recognition.interimResults = false;
  recognition.continuous = false;
  return recognition;
}
