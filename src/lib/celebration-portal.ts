/** Dedicated fullscreen host outside body overflow — fixes iOS fixed/clip bugs. */

const HOST_ID = "cv-fs-celeb-host";

export function getCelebrationPortalHost(): HTMLElement | null {
  if (typeof document === "undefined") return null;

  const existing = document.getElementById(HOST_ID);
  if (existing) return existing;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-cv-celeb-host", "1");
  // Attach to <html>, not <body>: body has overflow-x:hidden which breaks
  // position:fixed on iOS and can clip overlays to a fragment of the viewport.
  host.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "right:0",
    "bottom:0",
    "width:100vw",
    "max-width:none",
    "height:100vh",
    "height:100dvh",
    "margin:0",
    "padding:0",
    "border:none",
    "z-index:9999",
    "pointer-events:none",
  ].join(";");

  document.documentElement.appendChild(host);
  return host;
}
