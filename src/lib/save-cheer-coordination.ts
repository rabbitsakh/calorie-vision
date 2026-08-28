/**
 * Avoid duplicate mascot reactions when a meal save also triggers a fullscreen celebration.
 * Save handlers mark a short pending window; fullscreen celebrations claim it.
 */

const WINDOW_MS = 900;

let pendingSince: number | null = null;
let claimedByFullscreen = false;

export function markSaveCheerPending(): void {
  pendingSince = Date.now();
  claimedByFullscreen = false;
}

export function claimSaveCheerForFullscreen(): void {
  if (pendingSince == null) return;
  if (Date.now() - pendingSince > WINDOW_MS) return;
  claimedByFullscreen = true;
}

export function isSaveCheerClaimedByFullscreen(): boolean {
  return claimedByFullscreen;
}

export function clearSaveCheerPending(): void {
  pendingSince = null;
  claimedByFullscreen = false;
}

/** Delay before showing the mini save toast so celebrations can claim the cheer. */
export const SAVE_TOAST_DELAY_MS = 520;
