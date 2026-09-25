"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppSplash } from "@/components/AppSplash";
import { isApkWebView, resumeCapacitorSessionInPlace } from "@/lib/capacitor-resume";

export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [resuming, setResuming] = useState(false);
  const resumeTried = useRef(false);

  useEffect(() => {
    if (status !== "unauthenticated") return;
    if (resumeTried.current) return;
    resumeTried.current = true;

    let cancelled = false;
    void (async () => {
      if (!isApkWebView()) return;
      setResuming(true);
      const started = await resumeCapacitorSessionInPlace();
      if (cancelled) return;
      if (!started) setResuming(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === "loading" || resuming) {
    return <AppSplash status="Входим…" tipContext={{}} />;
  }

  if (status !== "authenticated") {
    return (
      <section className="card p-8 text-center">
        <h2 className="text-xl font-semibold">Войдите, чтобы начать</h2>
        <p className="mt-2 text-slate-600">
          Дневник питания привязан к вашему аккаунту — войдите через Яндекс, Google, VK, Telegram или email.
        </p>
        <Link href="/login" className="btn btn-primary mt-6 inline-flex">
          Войти
        </Link>
      </section>
    );
  }

  return <>{children}</>;
}
