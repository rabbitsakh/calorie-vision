/** Quiet-mode inbox toasts for chest grants (R1a) — not blocked by gamification quiet. */

export type ChestInboxPayload = {
  title: string;
  subtitle?: string;
};

export const CHEST_INBOX_EVENT = "cv-chest-inbox";

export function notifyChestInbox(payload: ChestInboxPayload): void {
  if (typeof window === "undefined") return;
  if (!payload.title.trim()) return;
  window.dispatchEvent(new CustomEvent(CHEST_INBOX_EVENT, { detail: payload }));
}
