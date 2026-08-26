/** Fullscreen celebration host via <dialog showModal()> (top layer — immune to iOS overflow clips). */

const HOST_ID = "cv-fs-celeb-host";

function applyHostBaseStyles(host: HTMLElement) {
  // Never use 100vw: with overflow-x clipping it shifts the stage to the left half.
  // Prefer % + inset so the top-layer dialog fills the viewport.
  host.style.cssText = [
    "position:fixed",
    "inset:0",
    "width:100%",
    "height:100%",
    "max-width:none",
    "max-height:none",
    "margin:0",
    "padding:0",
    "border:none",
    "background:transparent",
    "overflow:hidden",
    "z-index:2147483000",
    "pointer-events:none",
    "box-sizing:border-box",
  ].join(";");
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
    applyHostBaseStyles(el);
    el.style.pointerEvents = "auto";
    return;
  }

  // Legacy fallback: pin to layout viewport without visualViewport width math
  // (that previously produced a left-half stage on some iOS PWAs).
  el.style.top = "0px";
  el.style.left = "0px";
  el.style.right = "0px";
  el.style.bottom = "0px";
  el.style.width = "100%";
  el.style.height = "100%";
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
