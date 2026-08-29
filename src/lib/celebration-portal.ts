/** Fullscreen celebration host via <dialog showModal()> (top layer — immune to iOS overflow clips). */

const HOST_ID = "cv-fs-celeb-host";

/**
 * Size the host with inset + auto — never 100vw / percentage width alone.
 * On iOS PWA, 100vw + body overflow-x (or UA dialog fit-content) shifts the
 * stage so only the left ~half of the profile screen shows the celebration.
 */
function applyHostBaseStyles(host: HTMLElement) {
  const s = host.style;
  s.cssText = "";
  s.setProperty("position", "fixed", "important");
  s.setProperty("inset", "0", "important");
  s.setProperty("top", "0", "important");
  s.setProperty("right", "0", "important");
  s.setProperty("bottom", "0", "important");
  s.setProperty("left", "0", "important");
  s.setProperty("width", "auto", "important");
  s.setProperty("height", "auto", "important");
  s.setProperty("max-width", "none", "important");
  s.setProperty("max-height", "none", "important");
  s.setProperty("min-width", "0", "important");
  s.setProperty("min-height", "0", "important");
  s.setProperty("margin", "0", "important");
  s.setProperty("padding", "0", "important");
  s.setProperty("border", "none", "important");
  s.setProperty("background", "transparent", "important");
  s.setProperty("overflow", "visible", "important");
  s.setProperty("z-index", "2147483000", "important");
  s.setProperty("pointer-events", "none");
  s.setProperty("box-sizing", "border-box", "important");
  s.setProperty("transform", "none", "important");
  s.setProperty("translate", "none", "important");
}

/**
 * Open the celebration host in the browser top layer when possible.
 * Falls back to a plain fixed fullscreen element.
 */
export function openCelebrationPortal(host?: HTMLElement | null) {
  const el =
    host ?? (typeof document !== "undefined" ? document.getElementById(HOST_ID) : null);
  if (!el) return;

  applyHostBaseStyles(el);
  el.style.pointerEvents = "auto";

  const dialog = el as HTMLDialogElement;
  if (typeof dialog.showModal === "function") {
    if (!dialog.open) {
      try {
        dialog.showModal();
      } catch {
        // Already open or not allowed — keep fixed fallback styles.
      }
    }
    // Re-apply after showModal: UA :modal rules can reset width/margin.
    applyHostBaseStyles(el);
    el.style.pointerEvents = "auto";
    return;
  }

  // Legacy fallback: pin with inset only (no visualViewport / 100vw math).
  applyHostBaseStyles(el);
  el.style.pointerEvents = "auto";
}

export function closeCelebrationPortal(host?: HTMLElement | null) {
  const el =
    host ?? (typeof document !== "undefined" ? document.getElementById(HOST_ID) : null);
  if (!el) return;

  const dialog = el as HTMLDialogElement;
  if (typeof dialog.close === "function" && dialog.open) {
    try {
      dialog.close();
    } catch {
      // ignore
    }
  }
  el.style.pointerEvents = "none";
}

/** @deprecated Prefer openCelebrationPortal — kept for tests / callers. */
export function syncCelebrationPortalToVisualViewport(host?: HTMLElement | null) {
  openCelebrationPortal(host);
}

/** @deprecated Prefer open/closeCelebrationPortal. */
export function bindCelebrationPortalViewport(host: HTMLElement): () => void {
  openCelebrationPortal(host);
  return () => closeCelebrationPortal(host);
}

export function getCelebrationPortalHost(): HTMLElement | null {
  if (typeof document === "undefined") return null;

  const existing = document.getElementById(HOST_ID);
  if (existing) {
    applyHostBaseStyles(existing);
    return existing;
  }

  const host = document.createElement("dialog");
  host.id = HOST_ID;
  host.setAttribute("data-cv-celeb-host", "1");
  host.setAttribute("aria-modal", "true");
  applyHostBaseStyles(host);
  // Attach to <html>: body keeps overflow-x:hidden for page chrome.
  document.documentElement.appendChild(host);
  return host;
}
