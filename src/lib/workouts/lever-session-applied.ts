/**
 * Once-per-session guard for applyLeverGoalsOnOpen.
 * Survives WorkoutsView remounts (tab switch / leave gym / APK resume)
 * so volume +1 does not recreate deleted sets on reopen.
 */

export const LEVER_SESSION_APPLIED_KEY = "cv-lever-session-applied-v1";

/** Cap stored session ids — oldest dropped when over limit. */
const MAX_IDS = 40;

type Store = { ids: string[] };

function readStore(): Store {
  try {
    if (typeof localStorage === "undefined") return { ids: [] };
    const raw = localStorage.getItem(LEVER_SESSION_APPLIED_KEY);
    if (!raw) return { ids: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { ids: [] };
    const ids = (parsed as { ids?: unknown }).ids;
    if (!Array.isArray(ids)) return { ids: [] };
    return {
      ids: ids.filter((id): id is string => typeof id === "string" && id.length > 0),
    };
  } catch {
    return { ids: [] };
  }
}

function writeStore(store: Store): void {
  try {
    if (typeof localStorage === "undefined") return;
    let ids = store.ids;
    if (ids.length > MAX_IDS) {
      ids = ids.slice(ids.length - MAX_IDS);
    }
    localStorage.setItem(LEVER_SESSION_APPLIED_KEY, JSON.stringify({ ids }));
  } catch {
    // private mode / quota
  }
}

/** True when lever mutations (PATCH planned / POST volume) already ran for this session. */
export function hasLeverAppliedForSession(sessionId: string): boolean {
  if (!sessionId) return false;
  return readStore().ids.includes(sessionId);
}

/** Claim the session so a remount / reopen will not re-POST volume extras. */
export function markLeverAppliedForSession(sessionId: string): void {
  if (!sessionId) return;
  const store = readStore();
  if (store.ids.includes(sessionId)) return;
  store.ids.push(sessionId);
  writeStore(store);
}

/** Test helper — clear persisted claims. */
export function resetLeverSessionAppliedForTests(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(LEVER_SESSION_APPLIED_KEY);
  } catch {
    // ignore
  }
}
