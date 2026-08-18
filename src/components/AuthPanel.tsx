"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatPhoneDisplay } from "@/lib/phone";
import { getImageUrl, withBasePath } from "@/lib/paths";

export function AuthPanel() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="inline-block h-9 w-9 animate-pulse rounded-full bg-slate-200" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <Link href="/login" className="btn btn-secondary whitespace-nowrap px-4 py-2 text-sm">
        Войти
      </Link>
    );
  }

  const label = session.user.name ?? "Пользователь";
  const subtitle = session.user.phone
    ? formatPhoneDisplay(session.user.phone)
    : session.user.email ?? null;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        className="flex max-w-[12rem] items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-left hover:border-teal-300 md:max-w-none md:gap-3 md:px-3"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getImageUrl(session.user.image)}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800">
            {(session.user.name ?? session.user.email ?? session.user.phone ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 hidden sm:block">
          <p className="truncate text-sm font-medium text-slate-900">{label}</p>
          {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
        </div>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <Link
            href="/profile"
            role="menuitem"
            className="block px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            Профиль
          </Link>
          {session.user.isAdmin ? (
            <>
              <Link
                href="/admin/users"
                role="menuitem"
                className="block px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                Пользователи
              </Link>
              <Link
                href="/admin/stats"
                role="menuitem"
                className="block px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                Статистика
              </Link>
            </>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: withBasePath("/login") });
            }}
          >
            Выйти
          </button>
        </div>
      ) : null}
    </div>
  );
}
