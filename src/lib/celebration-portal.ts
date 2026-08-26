/** Dedicated fullscreen host — avoids body/html overflow clipping on iOS. */

const HOST_ID = "cv-fs-celeb-host";

function applyHostBaseStyles(host: HTMLElement) {
  // Use inset + auto size (not 100vw): 100vw + overflow-x clipping on iOS
  // shifts the overlay left so only ~half the screen shows the stage.
  host.style.cssText = [
    "position:fixed",
    "inset:0",
    "width:auto",
    "height:auto",
    "max-width:none",
    "max-height:none",
    "margin:0",
    "padding:0",
    "border:none",
    "z-index:2147483000",
    "pointer-events:none",
    "overflow:visible",
  ].join(";");
}

/** Pin host to the visual viewport (iOS Safari / PWA address-bar & rubber-band). */
export function syncCelebrationPortalToVisualViewport(host?: HTMLElement | null) {
  const el =
    host ?? (typeof document !== "undefined" ? document.getElementById(HOST_ID) : null);
  if (!el || typeof window === "undefined") return;

  const vv = window.visualViewport;
  if (!vv) {
    el.style.top = "0px";
    el.style.left = "0px";
    el.style.right = "0px";
    el.style.bottom = "0px";
    el.style.width = "auto";
    el.style.height = "auto";
    return;
  }

  el.style.top = `${vv.offsetTop}px`;
  el.style.left = `${vv.offsetLeft}px`;
  el.style.right = "auto";
  el.style.bottom = "auto";
  el.style.width = `${Math.round(vv.width)}px`;
  el.style.height = `${Math.round(vv.height)}px`;
}

export function bindCelebrationPortalViewport(host: HTMLElement): () => void {
  syncCelebrationPortalToVisualViewport(host);
  const vv = window.visualViewport;
  const sync = () => syncCelebrationPortalToVisualViewport(host);
  window.addEventListener("resize", sync);
  vv?.addEventListener("resize", sync);
  vv?.addEventListener("scroll", sync);
  return () => {
    window.removeEventListener("resize", sync);
    vv?.removeEventListener("resize", sync);
    vv?.removeEventListener("scroll", sync);
  };
}

export function getCelebrationPortalHost(): HTMLElement | null {
  if (typeof document === "undefined") return null;

  const existing = document.getElementById(HOST_ID);
  if (existing) {
    applyHostBaseStyles(existing);
    syncCelebrationPortalToVisualViewport(existing);
    return existing;
  }

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-cv-celeb-host", "1");
  // Prefer <html> over <body>: body keeps overflow-x:hidden for page chrome.
  applyHostBaseStyles(host);
  document.documentElement.appendChild(host);
  syncCelebrationPortalToVisualViewport(host);
  return host;
}
