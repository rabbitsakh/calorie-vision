"use client";

import { useSession } from "next-auth/react";
import type { ReactNode } from "react";

export function AdminGate({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <p className="text-sm text-slate-500">Загрузка…</p>;
  }

  if (!session?.user?.isAdmin) {
    return (
      <section className="card p-8 text-center">
        <h2 className="text-xl font-semibold">Нет доступа</h2>
        <p className="mt-2 text-slate-600">Этот раздел доступен только администратору.</p>
      </section>
    );
  }

  return <>{children}</>;
}
