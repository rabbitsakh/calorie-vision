"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AvatarFrame } from "@/components/AvatarFrame";
import { formatPhoneDisplay } from "@/lib/phone";
import { getImageUrl, withBasePath } from "@/lib/paths";

type MenuCoords = { top: number; right: number };

export function AuthPanel({ compactTrigger = false }: { compactTrigger?: boolean } = {}) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }

    function updatePosition() {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }
      const rect = trigger.getBoundingClientRect();
      setCoords({
        top: Math.round(rect.bottom + 8),
        right: Math.round(window.innerWidth - rect.right),
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (status === "loading") {
    return (
      <div className={`flex items-center text-sm text-slate-500 ${compactTrigger ? "h-full" : "gap-3"}`}>
        <span
          className={`inline-block animate-pulse rounded-full bg-slate-200 ${
            compactTrigger ? "h-11 w-11 md:h-10 md:w-10" : "h-9 w-9"
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

  const menu =
    open && mounted && coords
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[80] w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            style={{ top: coords.top, right: coords.right }}
          >
            <Link
              href="/profile"
              role="menuitem"
              className="block px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Профиль
            </Link>
            <Link
              href="/workouts"
              role="menuitem"
              className="block px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Тренировки
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
                void (async () => {
                  const { clearCapacitorResumeToken } = await import("@/lib/capacitor-resume");
                  await clearCapacitorResumeToken();
                  await signOut({ callbackUrl: withBasePath("/login") });
                })();
              }}
            >
              Выйти
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative flex h-full items-center">
      <button
        ref={triggerRef}
        type="button"
        className={
          compactTrigger
            ? // Mobile: larger avatar-only control; sm+: pill with name.
              "flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white p-0 text-left hover:border-teal-300 sm:h-10 sm:w-auto sm:max-w-none sm:gap-2.5 sm:py-0 sm:pl-0 sm:pr-2.5"
            : "flex max-w-[12rem] items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-left hover:border-teal-300 md:max-w-none md:gap-3 md:px-3"
        }
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={compactTrigger ? `Аккаунт: ${label}` : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <AvatarFrame className={compactTrigger ? "h-11 w-11 shrink-0 sm:h-10 sm:w-10" : undefined}>
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
      {menu}
    </div>
  );
}
