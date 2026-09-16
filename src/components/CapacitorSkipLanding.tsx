"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { waitForCapacitorNative } from "@/lib/capacitor-bridge";
import { resolveNativeAuthEntry } from "@/lib/capacitor-welcome";
import { withBasePath } from "@/lib/paths";

/**
 * In the Capacitor Android shell, never show the marketing landing.
 * Unauthenticated → /welcome (first run) or /login.
 */
export function CapacitorSkipLanding() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const native = await waitForCapacitorNative(1200);
      if (cancelled || !native) return;
      setBusy(true);
      document.documentElement.classList.add("capacitor-native");
      const path = await resolveNativeAuthEntry();
      if (cancelled) return;
      router.replace(withBasePath(path));
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!busy) return null;

  return (
    <main className="mx-auto flex min-h-[40vh] max-w-md items-center justify-center px-4 py-16 text-center text-sm text-slate-600">
      Открываем приложение…
    </main>
  );
}
