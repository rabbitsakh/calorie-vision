"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, type ReactNode } from "react";
import { AppSplash } from "@/components/AppSplash";
import { clearCapacitorLoggedIn } from "@/lib/capacitor-login-flag";

export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useSession();

  useEffect(() => {
    // Session gone (logout elsewhere / expired cookies) — don't keep restoring to /ration.
    if (status === "unauthenticated") {
      void clearCapacitorLoggedIn();
    }
  }, [status]);

  if (status === "loading") {
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
