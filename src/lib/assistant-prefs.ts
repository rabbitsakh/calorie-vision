/**
 * Free-text food/gym preferences for the AI assistant (server-synced).
 */

export type AssistantPrefs = {
  likes: string[];
  dislikes: string[];
  notes: string[];
};

export const ASSISTANT_PREFS_MAX_ITEMS = 24;
export const ASSISTANT_PREFS_MAX_CHARS = 80;

function clipList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim().replace(/\s+/g, " ").slice(0, ASSISTANT_PREFS_MAX_CHARS);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= ASSISTANT_PREFS_MAX_ITEMS) break;
  }
  return out;
}

export function emptyAssistantPrefs(): AssistantPrefs {
  return { likes: [], dislikes: [], notes: [] };
}

export function parseAssistantPrefs(raw: unknown): AssistantPrefs {
  if (!raw || typeof raw !== "object") return emptyAssistantPrefs();
  const obj = raw as Record<string, unknown>;
  return {
    likes: clipList(obj.likes),
    dislikes: clipList(obj.dislikes),
    notes: clipList(obj.notes),
  };
}

export function normalizeAssistantPrefs(raw: unknown): AssistantPrefs | null {
  if (raw === null) return emptyAssistantPrefs();
  if (raw === undefined) return null;
  if (typeof raw !== "object") return null;
  return parseAssistantPrefs(raw);
}

export function mergeAssistantPrefs(
  base: AssistantPrefs,
  patch: Partial<AssistantPrefs>,
): AssistantPrefs {
  return parseAssistantPrefs({
    likes: patch.likes ?? base.likes,
    dislikes: patch.dislikes ?? base.dislikes,
    notes: patch.notes ?? base.notes,
  });
}

export function formatAssistantPrefsBlock(prefs: AssistantPrefs): string {
  const lines: string[] = [];
  if (prefs.likes.length) lines.push(`Любит / ок: ${prefs.likes.join(", ")}`);
  if (prefs.dislikes.length) lines.push(`Не предлагает: ${prefs.dislikes.join(", ")}`);
  if (prefs.notes.length) lines.push(`Заметки: ${prefs.notes.join("; ")}`);
  return lines.join("\n");
}
