"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AvatarFrame } from "@/components/AvatarFrame";
import { formatPhoneDisplay } from "@/lib/phone";
import { getImageUrl, withBasePath } from "@/lib/paths";

export function AuthPanel({ compactTrigger = false }: { compactTrigger?: boolean } = {}) {
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
      <div className={`flex items-center text-sm text-slate-500 ${compactTrigger ? "h-full" : "gap-3"}`}>
        <span
          className={`inline-block animate-pulse rounded-full bg-slate-200 ${
            compactTrigger ? "h-9 w-9 md:h-10 md:w-10" : "h-9 w-9"
          }`}
        />
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
    <div ref={menuRef} className="relative flex h-full items-center">
      <button
        type="button"
        className={
          compactTrigger
            ? "flex h-9 max-w-[12rem] items-center gap-2 overflow-hidden rounded-full border border-slate-200 bg-white py-0 pl-0 pr-2 text-left hover:border-teal-300 md:h-10 md:max-w-none md:gap-2.5 md:pr-2.5"
            : "flex max-w-[12rem] items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-left hover:border-teal-300 md:max-w-none md:gap-3 md:px-3"
        }
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <AvatarFrame className={compactTrigger ? "h-9 w-9 shrink-0 md:h-10 md:w-10" : undefined}>
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={getImageUrl(session.user.image)}
              alt=""
              className={
                compactTrigger
                  ? "h-full w-full rounded-full object-cover"
                  : "h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover"
              }
            />
          ) : (
            <div
              className={
                compactTrigger
                  ? "flex h-full w-full items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800"
                  : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800"
              }
            >
              {(session.user.name ?? session.user.email ?? session.user.phone ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
        </AvatarFrame>
        <div className="min-w-0 hidden sm:block">
          <p className="truncate text-sm font-medium leading-tight text-slate-900">{label}</p>
          {!compactTrigger && subtitle ? (
            <p className="truncate text-xs text-slate-500">{subtitle}</p>
          ) : null}
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
              <Link
                href="/admin/changelog"
                role="menuitem"
                className="block px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                Журнал изменений
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
