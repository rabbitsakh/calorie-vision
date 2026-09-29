/** Once-per-day dismiss for mid-week NextStepBar nudge. */

const KEY_PREFIX = "cv-week-nudge-dismissed-";

export function isWeekNudgeDismissed(today: string): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(`${KEY_PREFIX}${today}`) === "1";
  } catch {
    return false;
  }
}

export function dismissWeekNudge(today: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(`${KEY_PREFIX}${today}`, "1");
  } catch {
    // ignore
  }
}
