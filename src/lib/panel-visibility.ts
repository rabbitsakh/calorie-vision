/**
 * Persist per-day panel visibility in localStorage.
 * Key: `ration-panel-{panelId}-{date}`, value: "hidden"
 */
export function isPanelHiddenToday(panelId: string, date: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(`ration-panel-${panelId}-${date}`) === "hidden";
  } catch {
    return false;
  }
}

export function hidePanelToday(panelId: string, date: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`ration-panel-${panelId}-${date}`, "hidden");
  } catch {
    // localStorage may be unavailable
  }
}

export function showPanelToday(panelId: string, date: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`ration-panel-${panelId}-${date}`);
  } catch {
    // ignore
  }
}
