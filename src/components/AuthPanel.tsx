"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { withBasePath } from "@/lib/paths";

export function AuthPanel() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="inline-block h-9 w-9 animate-pulse rounded-full bg-slate-200" />
        <span>Загрузка…</span>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <Link href="/login" className="btn btn-secondary whitespace-nowrap">
        Войти
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {session.user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={session.user.image}
          alt=""
          className="h-9 w-9 rounded-full border border-slate-200 object-cover"
        />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800">
          {(session.user.name ?? session.user.email ?? "?").charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 text-right">
        <p className="truncate text-sm font-medium text-slate-900">
          {session.user.name ?? "Пользователь"}
        </p>
        {session.user.email ? (
          <p className="truncate text-xs text-slate-500">{session.user.email}</p>
        ) : null}
      </div>
      <button
        type="button"
        className="btn btn-secondary whitespace-nowrap"
        onClick={() => signOut({ callbackUrl: withBasePath("/login") })}
      >
        Выйти
      </button>
    </div>
  );
}
