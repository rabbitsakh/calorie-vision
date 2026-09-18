"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { publicBrowserOrigin } from "@/lib/auth-url";
import type { CapacitorOAuthProvider } from "@/lib/capacitor-oauth";
import { withBasePath } from "@/lib/paths";

const PROVIDER_LABEL: Record<CapacitorOAuthProvider, string> = {
  google: "Открываем Google…",
  vk: "Открываем VK…",
  yandex: "Открываем Яндекс…",
};

function resolveProvider(raw: string | null): CapacitorOAuthProvider {
  if (raw === "vk" || raw === "yandex" || raw === "google") {
    return raw;
  }
  return "google";
}

/**
 * Bootstrap OAuth entirely inside Custom Tabs (CSRF cookies stay in Chrome).
 * WebView must not start Google OAuth — Google blocks WebView user-agents, and
 * App Link callbacks cannot see WebView CSRF cookies when Chrome handles the return.
 */
function NativeOauthStartInner() {
  const searchParams = useSearchParams();
  const provider = resolveProvider(searchParams.get("provider"));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const csrfRes = await fetch(withBasePath("/api/auth/csrf"), {
          credentials: "same-origin",
        });
        if (!csrfRes.ok) throw new Error("csrf");
        const csrfJson = (await csrfRes.json()) as { csrfToken?: string };
        const csrfToken = csrfJson.csrfToken;
        if (!csrfToken) throw new Error("csrf_token");

        const origin = publicBrowserOrigin(window.location.origin);
        const callbackUrl = `${origin}${withBasePath("/auth/native-bridge")}`;
        const form = document.createElement("form");
        form.method = "POST";
        form.action = `${origin}${withBasePath(`/api/auth/signin/${provider}`)}`;
        form.style.display = "none";

        const add = (name: string, value: string) => {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.appendChild(input);
        };
        add("csrfToken", csrfToken);
        add("callbackUrl", callbackUrl);
        document.body.appendChild(form);
        if (cancelled) return;
        form.submit();
      } catch {
        if (!cancelled) {
          setError("Не удалось начать вход. Закройте вкладку и попробуйте снова.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [provider]);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4 py-12 text-center">
      <BrandMark size={64} />
      <p className="mt-4 text-sm text-slate-600">{error ?? PROVIDER_LABEL[provider]}</p>
    </main>
  );
}

export default function NativeOauthStartPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[70vh] items-center justify-center px-4 text-sm text-slate-600">
          Открываем вход…
        </main>
      }
    >
      <NativeOauthStartInner />
    </Suspense>
  );
}
