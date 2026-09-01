/**
 * Fullscreen celebration host — plain fixed <div> on <html>.
 *
 * History: <dialog showModal()> clipped on iOS; innerWidth px sizing clipped to
 * the left half on Android TWA when innerWidth under-reports. Pin with inset:0
 * + 100dvw/100dvh (see globals.css) — same pattern as AppSplash.
 */

const HOST_ID = "cv-fs-celeb-host";

/** Pin host to the layout viewport — never set width/height from innerWidth px. */
function applyHostBaseStyles(host: HTMLElement) {
  const s = host.style;
  s.cssText = "";
  s.setProperty("position", "fixed", "important");
  s.setProperty("top", "0", "important");
  s.setProperty("right", "0", "important");
  s.setProperty("bottom", "0", "important");
  s.setProperty("left", "0", "important");
  s.setProperty("width", "100%", "important");
  s.setProperty("height", "100%", "important");
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

/** Show the host and re-pin size (call when celebration opens). */
export function openCelebrationPortal(host?: HTMLElement | null) {
  const el =
    host ?? (typeof document !== "undefined" ? document.getElementById(HOST_ID) : null);
  if (!el) return;

  applyHostBaseStyles(el);
  el.style.pointerEvents = "auto";
  el.setAttribute("data-cv-celeb-open", "1");
}

export function closeCelebrationPortal(host?: HTMLElement | null) {
  const el =
    host ?? (typeof document !== "undefined" ? document.getElementById(HOST_ID) : null);
  if (!el) return;

  el.style.pointerEvents = "none";
  el.removeAttribute("data-cv-celeb-open");
}

/** @deprecated Prefer openCelebrationPortal — kept for tests / callers. */
export function syncCelebrationPortalToVisualViewport(host?: HTMLElement | null) {
  openCelebrationPortal(host);
}

/** Keep host pinned while open (orientation / URL bar). */
export function bindCelebrationPortalViewport(host: HTMLElement): () => void {
  openCelebrationPortal(host);
  const sync = () => {
    if (host.getAttribute("data-cv-celeb-open") === "1") {
      openCelebrationPortal(host);
    }
  };
  window.addEventListener("resize", sync);
  window.visualViewport?.addEventListener("resize", sync);
  window.visualViewport?.addEventListener("scroll", sync);
  return () => {
    window.removeEventListener("resize", sync);
    window.visualViewport?.removeEventListener("resize", sync);
    window.visualViewport?.removeEventListener("scroll", sync);
    closeCelebrationPortal(host);
  };
}

export function getCelebrationPortalHost(): HTMLElement | null {
  if (typeof document === "undefined") return null;

  const existing = document.getElementById(HOST_ID);
  if (existing) {
    // Migrate away from leftover <dialog> hosts from older builds.
    if (existing.tagName === "DIALOG") {
      try {
        const dialog = existing as HTMLDialogElement;
        if (typeof dialog.close === "function" && dialog.open) dialog.close();
      } catch {
        // ignore
      }
      existing.remove();
    } else {
      applyHostBaseStyles(existing);
      return existing;
    }
  }

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-cv-celeb-host", "1");
  host.setAttribute("aria-hidden", "true");
  applyHostBaseStyles(host);
  // Attach to <html>: body keeps overflow-x:hidden for page chrome.
  document.documentElement.appendChild(host);
  return host;
}
