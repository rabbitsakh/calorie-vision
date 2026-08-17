"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import type { ReactNode } from "react";

export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useSession();

  if (status === "loading") {
    return <p className="text-sm text-slate-500">Загрузка…</p>;
  }

  if (status !== "authenticated") {
    return (
      <section className="card p-8 text-center">
        <h2 className="text-xl font-semibold">Войдите, чтобы начать</h2>
        <p className="mt-2 text-slate-600">
          Дневник питания привязан к вашему аккаунту — войдите по телефону или email.
        </p>
        <Link href="/login" className="btn btn-primary mt-6 inline-flex">
          Войти
        </Link>
      </section>
    );
  }

  return <>{children}</>;
}
