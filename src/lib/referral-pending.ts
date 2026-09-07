/** Client-side pending ?ref= capture until logged-in claim. */

const STORAGE_KEY = "cv-pending-ref";

export function capturePendingReferralCode(code: string): void {
  const trimmed = code.trim();
  if (!trimmed || trimmed.length < 6) return;
  try {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    // ignore
  }
}

export function peekPendingReferralCode(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)?.trim() || "";
    return v || null;
  } catch {
    return null;
  }
}

export function clearPendingReferralCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
