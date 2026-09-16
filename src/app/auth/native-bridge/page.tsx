"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { withBasePath } from "@/lib/paths";

/**
 * Runs inside Chrome Custom Tabs after Google/VK OAuth.
 * Creates a one-time token and opens calorievision:// so the APK WebView can adopt the session.
 */
export default function NativeBridgePage() {
  const { status } = useSession();
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") {
      setError("Вход не завершён. Закройте вкладку и попробуйте снова в приложении.");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(withBasePath("/api/auth/native-bridge/create"), {
          method: "POST",
          credentials: "same-origin",
        });
        if (!res.ok) {
          throw new Error("bridge_create_failed");
        }
        const data = (await res.json()) as { deepLink?: string };
        if (cancelled) return;
        if (!data.deepLink) {
          throw new Error("bridge_missing_link");
        }
        setDeepLink(data.deepLink);
        window.location.href = data.deepLink;
      } catch {
        if (!cancelled) {
          setError("Не удалось вернуться в приложение. Нажмите кнопку ниже или закройте вкладку.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4 py-12 text-center">
      <BrandMark size={64} />
      <h1 className="font-display mt-4 text-xl font-bold tracking-tight text-slate-900">
        Calorie Vision
      </h1>
      {error ? (
        <p className="mt-4 text-sm text-rose-700">{error}</p>
      ) : (
        <p className="mt-4 text-sm text-slate-600">Возвращаем в приложение…</p>
      )}
      {deepLink ? (
        <a
          href={deepLink}
          className="btn btn-primary mt-6 inline-flex min-h-12 items-center justify-center px-6"
        >
          Открыть приложение
        </a>
      ) : null}
    </main>
  );
}
