"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import {
  nativeBridgeDeepLink,
  nativeBridgeIntentUrl,
} from "@/lib/native-auth-bridge";

/**
 * Chrome fallback when intent:// did not open the APK.
 * Retries the deep link only — never consumes the session in the browser.
 */
function NativeBridgeReturnInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [autoTried, setAutoTried] = useState(false);

  const links = useMemo(() => {
    if (!token) return null;
    return {
      intentUrl: nativeBridgeIntentUrl(token),
      deepLink: nativeBridgeDeepLink(token),
    };
  }, [token]);

  const openApp = useCallback(() => {
    if (!links) return;
    window.location.href = links.intentUrl;
    window.setTimeout(() => {
      try {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = links.deepLink;
        document.body.appendChild(iframe);
        window.setTimeout(() => iframe.remove(), 1500);
      } catch {
        // ignore
      }
    }, 250);
  }, [links]);

  useEffect(() => {
    if (!links || autoTried) return;
    setAutoTried(true);
    openApp();
  }, [links, autoTried, openApp]);

  if (!token) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4 py-12 text-center">
        <BrandMark size={64} />
        <p className="mt-4 text-sm text-rose-700">Ссылка устарела. Вернитесь в приложение и войдите снова.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4 py-12 text-center">
      <BrandMark size={64} />
      <h1 className="font-display mt-4 text-xl font-bold tracking-tight text-slate-900">
        Calorie Vision
      </h1>
      <p className="mt-4 text-sm text-slate-600">
        Вход готов. Откройте приложение — сессия будет только там, не в браузере.
      </p>
      <button
        type="button"
        className="btn btn-primary mt-6 inline-flex min-h-12 w-full items-center justify-center px-6"
        onClick={openApp}
      >
        Открыть приложение
      </button>
      <p className="mt-4 text-xs leading-snug text-slate-500">
        Если ничего не произошло: вернитесь к иконке Calorie Vision на телефоне и закройте эту вкладку
        Chrome.
      </p>
    </main>
  );
}

export default function NativeBridgeReturnPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[70vh] items-center justify-center px-4 text-sm text-slate-600">
          Возвращаем в приложение…
        </main>
      }
    >
      <NativeBridgeReturnInner />
    </Suspense>
  );
}
