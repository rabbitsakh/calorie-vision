/**
 * R4 — rotate quiet-save cheer phrases among owned cheers so the toast stays fresh.
 */

const LAST_CHEER_KEY = "cv-cheer-rotate-last";

function store(): Storage | null {
  try {
    const win = (globalThis as { window?: Window }).window;
    return win?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getLastRotatedCheerKey(): string | null {
  return store()?.getItem(LAST_CHEER_KEY)?.trim() || null;
}

export function resetCheerRotateForTests(): void {
  store()?.removeItem(LAST_CHEER_KEY);
}

/**
 * Pick the next owned cheer key after the last shown one.
 * Prefers cycling through `ownedKeys`; if empty, falls back to `preferredKey`.
 */
export function pickRotatedCheerKey(
  ownedKeys: readonly string[],
  preferredKey?: string | null,
): string | null {
  const unique = Array.from(new Set(ownedKeys.filter(Boolean)));
  if (unique.length === 0) {
    return preferredKey?.trim() || null;
  }

  // Keep preferred first in the cycle so equip still “leads”.
  const preferred = preferredKey?.trim() || null;
  const ordered =
    preferred && unique.includes(preferred)
      ? [preferred, ...unique.filter((k) => k !== preferred)]
      : unique;

  const last = getLastRotatedCheerKey();
  const idx = last ? ordered.indexOf(last) : -1;
  const next = ordered[(idx + 1) % ordered.length]!;
  store()?.setItem(LAST_CHEER_KEY, next);
  return next;
}
