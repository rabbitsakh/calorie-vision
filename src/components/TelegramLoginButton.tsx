"use client";

import { useEffect, useRef } from "react";
import type { TelegramAuthPayload } from "@/lib/telegram-verify";

type TelegramLoginButtonProps = {
  botUsername: string;
  onAuth: (user: TelegramAuthPayload) => void;
  disabled?: boolean;
};

declare global {
  interface Window {
    __calorieVisionTelegramAuth?: (user: TelegramAuthPayload) => void;
  }
}

/**
 * Official Telegram Login Widget.
 * @see https://core.telegram.org/widgets/login
 */
export function TelegramLoginButton({ botUsername, onAuth, disabled }: TelegramLoginButtonProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onAuthRef = useRef(onAuth);
  onAuthRef.current = onAuth;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !botUsername) {
      return;
    }

    window.__calorieVisionTelegramAuth = (user) => {
      onAuthRef.current(user);
    };

    host.replaceChildren();
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername.replace(/^@/, ""));
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-lang", "ru");
    script.setAttribute("data-onauth", "__calorieVisionTelegramAuth(user)");
    host.appendChild(script);

    return () => {
      delete window.__calorieVisionTelegramAuth;
      host.replaceChildren();
    };
  }, [botUsername]);

  return (
    <div
      ref={hostRef}
      className={`flex min-h-12 w-full justify-center ${disabled ? "pointer-events-none opacity-60" : ""}`}
    />
  );
}
