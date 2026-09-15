"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isCapacitorNative } from "@/lib/capacitor-bridge";

/**
 * In the Capacitor Android shell, never show the marketing landing.
 * Logged-out → /login; session is handled by login → /ration.
 */
export function CapacitorSkipLanding() {
  const router = useRouter();

  useEffect(() => {
    if (!isCapacitorNative()) return;
    document.documentElement.classList.add("capacitor-native");
    router.replace("/login");
  }, [router]);

  if (!isCapacitorNative()) return null;

  return (
    <main className="mx-auto flex min-h-[40vh] max-w-md items-center justify-center px-4 py-16 text-center text-sm text-slate-600">
      Открываем вход…
    </main>
  );
}
