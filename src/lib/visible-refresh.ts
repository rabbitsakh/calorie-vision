/** pageshow и visibilitychange часто приходят парой на один показ вкладки. */
export const VISIBLE_REFRESH_GAP_MS = 700;

export function shouldRefreshOnShow(
  nowMs: number,
  lastRefreshMs: number,
  gapMs = VISIBLE_REFRESH_GAP_MS,
): boolean {
  return nowMs - lastRefreshMs >= gapMs;
}
