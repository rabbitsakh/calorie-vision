import { pickDecodedBarcode } from "@/lib/barcode";
import { detectCapacitorShell, isCapacitorNative } from "@/lib/capacitor-bridge";

export type NativeBarcodeScanResult =
  | { status: "code"; barcode: string }
  | { status: "unavailable" }
  | { status: "denied" }
  | { status: "cancelled" }
  | { status: "error"; message: string };

type RestoredScan = {
  pluginId?: string;
  methodName?: string;
  success?: boolean;
  data?: { barcodes?: Array<{ rawValue?: string; displayValue?: string }> };
};

let restoreHandler: ((result: NativeBarcodeScanResult) => void) | null = null;
let restoreListening = false;

function codeFromBarcodes(
  barcodes: Array<{ rawValue?: string; displayValue?: string }>,
): string | null {
  return pickDecodedBarcode(barcodes.flatMap((item) => [item.rawValue, item.displayValue]));
}

async function listenForRestoredScan(): Promise<void> {
  if (restoreListening) return;
  restoreListening = true;
  try {
    const { App } = await import("@capacitor/app");
    await App.addListener("appRestoredResult", (event) => {
      const payload = event as RestoredScan;
      if (payload.pluginId !== "BarcodeScanner" || payload.methodName !== "scan") return;
      const handler = restoreHandler;
      restoreHandler = null;
      if (!handler) return;
      if (!payload.success) {
        handler({
          status: "error",
          message: "Сканер закрылся. Попробуйте ещё раз или введите код.",
        });
        return;
      }
      const code = codeFromBarcodes(payload.data?.barcodes ?? []);
      handler(code ? { status: "code", barcode: code } : { status: "cancelled" });
    });
  } catch {
    restoreListening = false;
  }
}

async function ensureGoogleModule(
  scanner: {
    isGoogleBarcodeScannerModuleAvailable: () => Promise<{ available: boolean }>;
    installGoogleBarcodeScannerModule: () => Promise<void>;
    addListener: (
      event: "googleBarcodeScannerModuleInstallProgress",
      listener: (event: { state: number }) => void,
    ) => Promise<{ remove: () => Promise<void> }>;
  },
  completed: number,
  failed: number,
  canceled: number,
): Promise<boolean> {
  try {
    const { available } = await scanner.isGoogleBarcodeScannerModuleAvailable();
    if (available) return true;
  } catch {
    return true;
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let handle: { remove: () => Promise<void> } | undefined;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      void handle?.remove();
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false), 20_000);
    void scanner
      .addListener("googleBarcodeScannerModuleInstallProgress", (event) => {
        if (event.state === completed) finish(true);
        if (event.state === failed || event.state === canceled) finish(false);
      })
      .then((listener) => {
        handle = listener;
        return scanner.installGoogleBarcodeScannerModule();
      })
      .catch(() => finish(false));
  });
}

/** Capacitor ML Kit scanner. `unavailable` means the caller should use the web camera. */
export async function scanNativeBarcode(): Promise<NativeBarcodeScanResult> {
  if (typeof window === "undefined") return { status: "unavailable" };
  const native = isCapacitorNative() || (await detectCapacitorShell(800));
  if (!native) return { status: "unavailable" };

  let plugin: typeof import("@capacitor-mlkit/barcode-scanning");
  try {
    plugin = await import("@capacitor-mlkit/barcode-scanning");
  } catch {
    return { status: "unavailable" };
  }

  const { BarcodeScanner, BarcodeFormat, GoogleBarcodeScannerModuleInstallState } = plugin;
  try {
    const supported = await BarcodeScanner.isSupported();
    if (!supported.supported) {
      return { status: "error", message: "Сканер штрихкодов не поддерживается на этом устройстве." };
    }
  } catch {
    return { status: "unavailable" };
  }

  let permission = "prompt";
  try {
    permission = (await BarcodeScanner.checkPermissions()).camera;
    if (permission !== "granted" && permission !== "limited") {
      permission = (await BarcodeScanner.requestPermissions()).camera;
    }
  } catch {
    permission = "prompt";
  }

  const moduleReady = await ensureGoogleModule(
    BarcodeScanner,
    GoogleBarcodeScannerModuleInstallState.COMPLETED,
    GoogleBarcodeScannerModuleInstallState.FAILED,
    GoogleBarcodeScannerModuleInstallState.CANCELED,
  );

  await listenForRestoredScan();
  const formats = [
    BarcodeFormat.Ean13,
    BarcodeFormat.Ean8,
    BarcodeFormat.UpcA,
    BarcodeFormat.UpcE,
  ];

  const fromRestore = new Promise<NativeBarcodeScanResult>((resolve) => {
    restoreHandler = resolve;
  });

  try {
    const fromScan = BarcodeScanner.scan({ formats }).then((result) => {
      const code = codeFromBarcodes(result.barcodes ?? []);
      if (!code) return { status: "cancelled" } as const;
      return { status: "code", barcode: code } as const;
    });
    return await Promise.race([fromScan, fromRestore]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/cancel/i.test(message)) return { status: "cancelled" };
    if (/permission|denied|camera/i.test(message) || permission === "denied") {
      return { status: "denied" };
    }
    if (!moduleReady) {
      return { status: "error", message: "Не удалось открыть нативный сканер." };
    }
    return { status: "error", message: "Не удалось считать штрихкод." };
  } finally {
    restoreHandler = null;
  }
}

export async function openNativeBarcodeSettings(): Promise<void> {
  try {
    const { BarcodeScanner } = await import("@capacitor-mlkit/barcode-scanning");
    await BarcodeScanner.openSettings();
  } catch {
    // Settings screen is optional; manual entry stays available.
  }
}
