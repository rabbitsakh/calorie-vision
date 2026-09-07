/** Equipped avatar frame preference (wave 8) — client-only. */

const EQUIPPED_FRAME_KEY = "cv-equipped-frame";

function store(): Storage | null {
  try {
    const win = (globalThis as { window?: Window }).window;
    return win?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getEquippedFrameKey(): string | null {
  const raw = store()?.getItem(EQUIPPED_FRAME_KEY)?.trim();
  return raw || null;
}

export function setEquippedFrameKey(key: string | null): void {
  const s = store();
  if (!s) return;
  if (!key) {
    s.removeItem(EQUIPPED_FRAME_KEY);
  } else {
    s.setItem(EQUIPPED_FRAME_KEY, key);
  }
  try {
    winDispatch(key);
  } catch {
    // ignore
  }
}

/** Persist equipped frame to account (best-effort). */
export async function persistEquippedFrameKey(key: string | null): Promise<void> {
  setEquippedFrameKey(key);
  try {
    const { withBasePath } = await import("@/lib/paths");
    await fetch(withBasePath("/api/account"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ equippedFrameKey: key }),
    });
  } catch {
    // offline — local cache kept
  }
}

/** Hydrate local cache from account when local empty. */
export async function hydrateEquippedFrameFromAccount(): Promise<string | null> {
  try {
    const { withBasePath } = await import("@/lib/paths");
    const resp = await fetch(withBasePath("/api/account"), { cache: "no-store" });
    if (!resp.ok) return getEquippedFrameKey();
    const data = (await resp.json()) as { equippedFrameKey?: string | null };
    const server = data.equippedFrameKey?.trim() || null;
    const local = getEquippedFrameKey();
    if (server && !local) {
      setEquippedFrameKey(server);
      return server;
    }
    return local ?? server;
  } catch {
    return getEquippedFrameKey();
  }
}

function winDispatch(key: string | null): void {
  const win = (globalThis as { window?: Window }).window;
  win?.dispatchEvent(new CustomEvent("cv-equipped-frame", { detail: key }));
}

export function subscribeEquippedFrame(listener: (key: string | null) => void): () => void {
  const win = (globalThis as { window?: Window }).window;
  if (!win) return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<string | null>).detail;
    listener(detail ?? getEquippedFrameKey());
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === EQUIPPED_FRAME_KEY) {
      listener(event.newValue);
    }
  };
  win.addEventListener("cv-equipped-frame", handler);
  win.addEventListener("storage", onStorage);
  return () => {
    win.removeEventListener("cv-equipped-frame", handler);
    win.removeEventListener("storage", onStorage);
  };
}

/** Test helper */
export function resetEquippedFrameForTests(): void {
  store()?.removeItem(EQUIPPED_FRAME_KEY);
}
