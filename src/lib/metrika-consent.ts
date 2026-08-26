/**
 * Yandex Metrika cookie/analytics consent (localStorage).
 * Choice is device-local; no schema migration required.
 */

export const METRIKA_CONSENT_KEY = "cv_metrika_consent";

export type MetrikaConsent = "accepted" | "declined";

function localStore(): Storage | null {
  try {
    const win = (globalThis as { window?: Window }).window;
    return win?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function parseMetrikaConsent(raw: string | null | undefined): MetrikaConsent | null {
  if (raw === "accepted" || raw === "declined") {
    return raw;
  }
  return null;
}

/** Current consent, or null if the user has not chosen yet. */
export function getMetrikaConsent(): MetrikaConsent | null {
  return parseMetrikaConsent(localStore()?.getItem(METRIKA_CONSENT_KEY));
}

export function setMetrikaConsent(value: MetrikaConsent): void {
  localStore()?.setItem(METRIKA_CONSENT_KEY, value);
  try {
    const win = (globalThis as { window?: Window }).window;
    win?.dispatchEvent(new CustomEvent("cv-metrika-consent", { detail: value }));
  } catch {
    // ignore
  }
}

export function hasAcceptedMetrikaConsent(): boolean {
  return getMetrikaConsent() === "accepted";
}

/** Test helper */
export function resetMetrikaConsentForTests(): void {
  localStore()?.removeItem(METRIKA_CONSENT_KEY);
}
