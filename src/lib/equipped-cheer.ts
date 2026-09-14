/** Equipped mascot cheer preference (chests/mascot wave 1) — client-only. */

const EQUIPPED_CHEER_KEY = "cv-equipped-cheer";

function store(): Storage | null {
  try {
    const win = (globalThis as { window?: Window }).window;
    return win?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getEquippedCheerKey(): string | null {
  const raw = store()?.getItem(EQUIPPED_CHEER_KEY)?.trim();
  return raw || null;
}

export function setEquippedCheerKey(key: string | null): void {
  const s = store();
  if (!s) return;
  if (!key) {
    s.removeItem(EQUIPPED_CHEER_KEY);
  } else {
    s.setItem(EQUIPPED_CHEER_KEY, key);
  }
  try {
    winDispatch(key);
  } catch {
    // ignore
  }
}

/** Persist equipped cheer to account (best-effort). */
export async function persistEquippedCheerKey(key: string | null): Promise<void> {
  setEquippedCheerKey(key);
  try {
    const { withBasePath } = await import("@/lib/paths");
    await fetch(withBasePath("/api/account"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ equippedCheerKey: key }),
    });
  } catch {
    // offline — local cache kept
  }
}

/** Hydrate local cache from account when empty or always prefer server. */
export async function hydrateEquippedCheerFromAccount(): Promise<string | null> {
  try {
    const { withBasePath } = await import("@/lib/paths");
    const resp = await fetch(withBasePath("/api/account"), { cache: "no-store" });
    if (!resp.ok) return getEquippedCheerKey();
    const data = (await resp.json()) as { equippedCheerKey?: string | null };
    const server = data.equippedCheerKey?.trim() || null;
    const local = getEquippedCheerKey();
    if (server && !local) {
      setEquippedCheerKey(server);
      return server;
    }
    if (server && local && server !== local) {
      // Prefer local until next equip; keep local as source of truth for now.
      return local;
    }
    return local ?? server;
  } catch {
    return getEquippedCheerKey();
  }
}

function winDispatch(key: string | null): void {
  const win = (globalThis as { window?: Window }).window;
  win?.dispatchEvent(new CustomEvent("cv-equipped-cheer", { detail: key }));
}

export function subscribeEquippedCheer(listener: (key: string | null) => void): () => void {
  const win = (globalThis as { window?: Window }).window;
  if (!win) return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<string | null>).detail;
    listener(detail ?? getEquippedCheerKey());
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === EQUIPPED_CHEER_KEY) {
      listener(event.newValue);
    }
  };
  win.addEventListener("cv-equipped-cheer", handler);
  win.addEventListener("storage", onStorage);
  return () => {
    win.removeEventListener("cv-equipped-cheer", handler);
    win.removeEventListener("storage", onStorage);
  };
}

export function resetEquippedCheerForTests(): void {
  store()?.removeItem(EQUIPPED_CHEER_KEY);
}
