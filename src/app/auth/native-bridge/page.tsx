"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { withBasePath } from "@/lib/paths";

type BridgeLinks = {
  deepLink: string;
  intentUrl: string;
  consumeUrl: string;
};

/**
 * Runs inside Chrome Custom Tabs after Google/VK/Yandex/Telegram OAuth.
 * Opens the APK via Android intent:// — never finishes login in the browser.
 */
export default function NativeBridgePage() {
  const { status } = useSession();
  const [links, setLinks] = useState<BridgeLinks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const openApp = useCallback((next: BridgeLinks) => {
    window.location.href = next.intentUrl;

    window.setTimeout(() => {
      try {
        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = next.deepLink;
        document.body.appendChild(iframe);
        window.setTimeout(() => iframe.remove(), 1500);
      } catch {
        // ignore
      }
    }, 300);
  }, []);

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
        const data = (await res.json()) as Partial<BridgeLinks>;
        if (cancelled) return;
        if (!data.deepLink || !data.intentUrl || !data.consumeUrl) {
          throw new Error("bridge_missing_link");
        }
        const next = {
          deepLink: data.deepLink,
          intentUrl: data.intentUrl,
          consumeUrl: data.consumeUrl,
        };
        setLinks(next);
        openApp(next);
        window.setTimeout(() => {
          if (!cancelled) {
            setHint(
              "Если приложение не открылось — нажмите кнопку ниже, затем закройте вкладку Chrome.",
            );
          }
        }, 2000);
      } catch {
        if (!cancelled) {
          setError("Не удалось вернуться в приложение. Нажмите кнопку ниже или закройте вкладку.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, openApp]);

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
      {hint ? <p className="mt-3 text-xs leading-snug text-slate-500">{hint}</p> : null}
      {links ? (
        <div className="mt-6 flex w-full flex-col gap-3">
          <a
            href={links.intentUrl}
            className="btn btn-primary inline-flex min-h-12 items-center justify-center px-6"
            onClick={(e) => {
              e.preventDefault();
              openApp(links);
            }}
          >
            Открыть приложение
          </a>
          <p className="text-xs text-slate-500">
            Не открывайте сайт в браузере — дневник должен быть в приложении.
          </p>
        </div>
      ) : null}
    </main>
  );
}
