"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AppWelcomeSlider } from "@/components/AppWelcomeSlider";
import { isCapacitorNative } from "@/lib/capacitor-bridge";
import { hasSeenAppWelcome } from "@/lib/capacitor-welcome";
import { withBasePath } from "@/lib/paths";

/**
 * Capacitor-only welcome. Web users are sent to /login (or home).
 */
export default function WelcomePage() {
  const { status } = useSession();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [showSlider, setShowSlider] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function gate() {
      if (status === "loading") return;

      if (status === "authenticated") {
        router.replace(withBasePath("/ration/"));
        return;
      }

      if (!isCapacitorNative()) {
        router.replace(withBasePath("/login"));
        return;
      }

      document.documentElement.classList.add("capacitor-native");
      const seen = await hasSeenAppWelcome();
      if (cancelled) return;
      if (seen) {
        router.replace(withBasePath("/login"));
        return;
      }
      setShowSlider(true);
      setReady(true);
    }

    void gate();
    return () => {
      cancelled = true;
    };
  }, [status, router]);

  if (!ready || !showSlider) {
    return (
      <main className="app-welcome app-welcome--boot">
        <p className="app-welcome-boot-copy">Открываем Calorie Vision…</p>
      </main>
    );
  }

  return <AppWelcomeSlider />;
}
