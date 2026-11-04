import { isCapacitorNative } from "@/lib/capacitor-bridge";
import { isApkWebView } from "@/lib/capacitor-resume";

export type ExportSaveResult = "shared" | "downloaded" | "cancelled";

type CvFilesBridge = {
  shareBase64: (filename: string, mime: string, base64: string) => boolean;
};

function cvFiles(): CvFilesBridge | null {
  if (typeof window === "undefined") return null;
  try {
    const bridge = (window as Window & { CvFiles?: CvFilesBridge }).CvFiles;
    if (bridge && typeof bridge.shareBase64 === "function") return bridge;
  } catch {
    // ignore
  }
  return null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(blob);
  });
}

function triggerAnchorDownload(href: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  triggerAnchorDownload(objectUrl, filename);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2500);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function tryWebShare(file: File, filename: string): Promise<ExportSaveResult | "unavailable"> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return "unavailable";
  try {
    if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [file] })) {
      return "unavailable";
    }
  } catch {
    return "unavailable";
  }
  try {
    await navigator.share({ files: [file], title: "Calorie Vision", text: filename });
    return "shared";
  } catch (error) {
    if (isAbortError(error)) return "cancelled";
    return "unavailable";
  }
}

/**
 * Save an authenticated export.
 * Desktop and PWA get a file download (UTF-8 CSV opens in Excel).
 * The RuStore WebView has no Capacitor JS after login, so the APK uses the
 * native share bridge when the build has it, then the Web Share sheet, then
 * the same attachment link the diary export already used.
 */
export async function saveExportFile(href: string, filename: string): Promise<ExportSaveResult> {
  const response = await fetch(href, { credentials: "include" });
  if (!response.ok) {
    let message = "Не удалось выгрузить файл";
    const type = response.headers.get("content-type") ?? "";
    if (type.includes("json")) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (payload?.error) message = payload.error;
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const headerType = response.headers.get("content-type")?.split(";")[0]?.trim();
  const mime = headerType || blob.type || "application/octet-stream";
  const file = new File([blob], filename, { type: mime });
  const nativeShell = isApkWebView() || isCapacitorNative();

  if (nativeShell) {
    const native = cvFiles();
    if (native) {
      try {
        const shared = native.shareBase64(filename, mime, await blobToBase64(blob));
        if (shared) return "shared";
      } catch {
        // Fall through to the Web Share sheet or the attachment link.
      }
    }
    const webShare = await tryWebShare(file, filename);
    if (webShare === "shared" || webShare === "cancelled") return webShare;
    triggerAnchorDownload(href, filename);
    return "downloaded";
  }

  triggerBlobDownload(blob, filename);
  return "downloaded";
}
