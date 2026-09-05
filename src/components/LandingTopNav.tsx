"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BrandMark } from "@/components/BrandMark";

const LINKS = [
  { href: "#how", label: "Как работает" },
  { href: "#recognition", label: "Распознавание" },
  { href: "#trust", label: "Доверие" },
  { href: "#inside", label: "Внутри" },
  { href: "#free", label: "Бесплатно" },
  { href: "#install", label: "Установка" },
  { href: "#faq", label: "Вопросы" },
] as const;

export function LandingTopNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const close = () => setOpen(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    window.addEventListener("resize", close);
    window.addEventListener("orientationchange", close);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("resize", close);
      window.removeEventListener("orientationchange", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const drawer =
    open && mounted
      ? createPortal(
          <div
            id="landing-mobile-drawer"
            className="landing-mobile-drawer landing-mobile-drawer-open"
            role="dialog"
            aria-modal="true"
            aria-label="Меню"
          >
            <button
              type="button"
              className="landing-mobile-drawer-backdrop"
              aria-label="Закрыть меню"
              tabIndex={-1}
              onClick={() => setOpen(false)}
            />
            <div className="landing-mobile-drawer-panel">
              <div className="landing-mobile-drawer-toolbar">
                <span className="landing-mobile-drawer-title">Меню</span>
                <button
                  type="button"
                  className="landing-mobile-drawer-close"
                  onClick={() => setOpen(false)}
                >
                  Закрыть
                </button>
              </div>
              <nav className="landing-mobile-drawer-nav" aria-label="Мобильное меню">
                {LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="landing-mobile-drawer-link"
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
                <Link
                  href="/login"
                  className="btn btn-primary landing-mobile-drawer-cta"
                  onClick={() => setOpen(false)}
                >
                  Войти
                </Link>
              </nav>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <header className="landing-top">
        <Link href="/" className="landing-top-brand" aria-label="Calorie Vision — на главную">
          <BrandMark size={34} decorative={false} />
          <span>Calorie Vision</span>
        </Link>

        <nav className="landing-top-nav" aria-label="Разделы">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="landing-top-link">
              {link.label}
            </a>
          ))}
          <Link href="/login" className="landing-top-cta landing-cta-sheen">
            Войти
          </Link>
        </nav>

        <button
          type="button"
          className="landing-top-menu-btn"
          aria-expanded={open}
          aria-controls="landing-mobile-drawer"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Закрыть" : "Меню"}
        </button>
      </header>
      {drawer}
    </>
  );
}
