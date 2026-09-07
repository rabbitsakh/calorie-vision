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

/** Persist equipped sticker to account (best-effort). */
export async function persistEquippedStickerKey(key: string | null): Promise<void> {
  setEquippedStickerKey(key);
  try {
    const { withBasePath } = await import("@/lib/paths");
    await fetch(withBasePath("/api/account"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ equippedStickerKey: key }),
    });
  } catch {
    // offline — local cache kept
  }
}

/** Hydrate local cache from account when empty or always prefer server. */
export async function hydrateEquippedStickerFromAccount(): Promise<string | null> {
  try {
    const { withBasePath } = await import("@/lib/paths");
    const resp = await fetch(withBasePath("/api/account"), { cache: "no-store" });
    if (!resp.ok) return getEquippedStickerKey();
    const data = (await resp.json()) as { equippedStickerKey?: string | null };
    const server = data.equippedStickerKey?.trim() || null;
    const local = getEquippedStickerKey();
    if (server && !local) {
      setEquippedStickerKey(server);
      return server;
    }
    if (server && local && server !== local) {
      // Prefer local until next equip; keep local as source of truth for now.
      return local;
    }
    return local ?? server;
  } catch {
    return getEquippedStickerKey();
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
