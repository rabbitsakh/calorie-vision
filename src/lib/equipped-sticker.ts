/** Equipped diary sticker preference (Wave 9) — client-only. */

const EQUIPPED_STICKER_KEY = "cv-equipped-sticker";

function store(): Storage | null {
  try {
    const win = (globalThis as { window?: Window }).window;
    return win?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getEquippedStickerKey(): string | null {
  const raw = store()?.getItem(EQUIPPED_STICKER_KEY)?.trim();
  return raw || null;
}

export function setEquippedStickerKey(key: string | null): void {
  const s = store();
  if (!s) return;
  if (!key) {
    s.removeItem(EQUIPPED_STICKER_KEY);
  } else {
    s.setItem(EQUIPPED_STICKER_KEY, key);
  }
  try {
    winDispatch(key);
  } catch {
    // ignore
  }
}

function winDispatch(key: string | null): void {
  const win = (globalThis as { window?: Window }).window;
  win?.dispatchEvent(new CustomEvent("cv-equipped-sticker", { detail: key }));
}

export function subscribeEquippedSticker(listener: (key: string | null) => void): () => void {
  const win = (globalThis as { window?: Window }).window;
  if (!win) return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<string | null>).detail;
    listener(detail ?? getEquippedStickerKey());
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === EQUIPPED_STICKER_KEY) {
      listener(event.newValue);
    }
  };
  win.addEventListener("cv-equipped-sticker", handler);
  win.addEventListener("storage", onStorage);
  return () => {
    win.removeEventListener("cv-equipped-sticker", handler);
    win.removeEventListener("storage", onStorage);
  };
}

export function resetEquippedStickerForTests(): void {
  store()?.removeItem(EQUIPPED_STICKER_KEY);
}
