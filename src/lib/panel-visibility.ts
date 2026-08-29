/**
 * Persist panel visibility in localStorage.
 * Day key: `ration-panel-{panelId}-{date}`
 * Week key: `ration-panel-{panelId}-week-{weekStart}`
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

export function isPanelHiddenForWeek(panelId: string, weekStart: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(`ration-panel-${panelId}-week-${weekStart}`) === "hidden";
  } catch {
    return false;
  }
}

export function hidePanelForWeek(panelId: string, weekStart: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`ration-panel-${panelId}-week-${weekStart}`, "hidden");
  } catch {
    // ignore
  }
}

export function showPanelForWeek(panelId: string, weekStart: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`ration-panel-${panelId}-week-${weekStart}`);
  } catch {
    // ignore
  }
}
