"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppSplash } from "@/components/AppSplash";
import { isApkWebView, resumeCapacitorSessionInPlace } from "@/lib/capacitor-resume";
import { probeOnline } from "@/lib/connectivity";
import {
  hasOfflineSessionCache,
  writeOfflineSessionCache,
} from "@/lib/offline-session";

export function AuthGate({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [resuming, setResuming] = useState(false);
  /** Soft-pass when offline with a cached prior login. */
  const [offlinePass, setOfflinePass] = useState(false);
  const [checkingOffline, setCheckingOffline] = useState(false);
  const resumeTried = useRef(false);

  useEffect(() => {
    if (status === "authenticated" && session) {
      writeOfflineSessionCache(session);
      setOfflinePass(false);
      setCheckingOffline(false);
      resumeTried.current = false;
      return;
    }

    if (status !== "unauthenticated") return;

    let cancelled = false;
    setCheckingOffline(true);

    void (async () => {
      const cached = hasOfflineSessionCache();
      const online = await probeOnline(2500);

      if (cancelled) return;

      if (!online && cached) {
        // Stay in the app shell with last-known identity — no resume navigation.
        setOfflinePass(true);
        setResuming(false);
        setCheckingOffline(false);
        return;
      }

      setOfflinePass(false);
      setCheckingOffline(false);

      if (!online) {
        // No cache and no network — show login (do not hit capacitor-resume).
        return;
      }

      if (!isApkWebView() || resumeTried.current) return;
      resumeTried.current = true;
      setResuming(true);
      const started = await resumeCapacitorSessionInPlace();
      if (cancelled) return;
      if (!started) setResuming(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session]);

  if (status === "loading" || resuming || checkingOffline) {
    return <AppSplash status="Входим…" tipContext={{}} />;
  }

  if (status === "authenticated" || offlinePass) {
    return <>{children}</>;
  }

  return (
    <section className="card p-8 text-center">
      <h2 className="text-xl font-semibold">Войдите, чтобы начать</h2>
      <p className="mt-2 text-[var(--muted-strong)]">
        Дневник питания привязан к вашему аккаунту — войдите через Яндекс, Google, VK, Telegram или
        email.
      </p>
      <Link href="/login" className="btn btn-primary mt-6 inline-flex">
        Войти
      </Link>
    </section>
  );
}
