"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { detectCapacitorShell, markCapacitorShell } from "@/lib/capacitor-bridge";
import { isApkWebView, resumeCapacitorSessionInPlace } from "@/lib/capacitor-resume";
import { resolveNativeAuthEntry } from "@/lib/capacitor-welcome";
import { withBasePath } from "@/lib/paths";

/**
 * In the Capacitor Android shell, never show the marketing landing.
 * Resume token → re-mint cookies → /ration. Else welcome or login.
 */
export function CapacitorSkipLanding() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const native = (await detectCapacitorShell(2500)) || isApkWebView();
      if (cancelled || !native) return;
      setBusy(true);
      markCapacitorShell();

      const resumed = await resumeCapacitorSessionInPlace();
      if (cancelled || resumed) return;

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
