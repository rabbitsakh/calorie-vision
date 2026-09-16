"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AppWelcomeSlider } from "@/components/AppWelcomeSlider";
import { isCapacitorNative, waitForCapacitorNative } from "@/lib/capacitor-bridge";
import { hasSeenAppWelcome } from "@/lib/capacitor-welcome";
import { withBasePath } from "@/lib/paths";

/**
 * Capacitor-only welcome. Web users are sent to /login (or home).
 * Must never hang on SessionProvider "loading" — APK cold start used to
 * stick on «Открываем Calorie Vision…» forever when /api/auth/session was slow.
 */
export default function WelcomePage() {
  const { status } = useSession();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [showSlider, setShowSlider] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function gate() {
      if (status === "authenticated") {
        router.replace(withBasePath("/ration/"));
        return;
      }

      // Give the Capacitor bridge a moment to inject into the remote WebView.
      const native =
        status === "loading"
          ? await waitForCapacitorNative(1200)
          : isCapacitorNative() || (await waitForCapacitorNative(400));

      if (cancelled) return;

      // Still waiting for session on plain web — keep boot copy briefly.
      if (!native && status === "loading") return;

      if (!native) {
        router.replace(withBasePath("/login"));
        return;
      }

      document.documentElement.classList.add("capacitor-native");

      // Authenticated may flip after bridge wait.
      if (status === "authenticated") {
        router.replace(withBasePath("/ration/"));
        return;
      }

      // Do not block the slider on a hung session fetch.
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

    // Hard failsafe: never leave the user on the boot line.
    const failsafe = window.setTimeout(() => {
      if (cancelled) return;
      if (isCapacitorNative()) {
        document.documentElement.classList.add("capacitor-native");
        setShowSlider(true);
        setReady(true);
        return;
      }
      router.replace(withBasePath("/login"));
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(failsafe);
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
