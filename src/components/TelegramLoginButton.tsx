"use client";

import { withBasePath } from "@/lib/paths";

type TelegramLoginButtonProps = {
  botId: string;
  botUsername: string;
  disabled?: boolean;
};

/**
 * Styled Telegram login — redirects via oauth.telegram.org.
 * The embedded Login Widget often renders an empty box on mobile Safari.
 * @see https://core.telegram.org/widgets/login
 */
export function TelegramLoginButton({ botId, botUsername, disabled }: TelegramLoginButtonProps) {
  function handleClick() {
    if (disabled || !botId) return;

    const origin = window.location.origin;
    const returnTo = `${origin}${withBasePath("/login/telegram")}`;
    const url = new URL("https://oauth.telegram.org/auth");
    url.searchParams.set("bot_id", botId);
    url.searchParams.set("origin", origin);
    url.searchParams.set("request_access", "write");
    url.searchParams.set("return_to", returnTo);
    url.searchParams.set("lang", "ru");

    window.location.assign(url.toString());
  }

  return (
    <button
      type="button"
      className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#229ED9] px-4 py-3 font-medium text-white transition hover:bg-[#1b8fc7] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled || !botId}
      onClick={handleClick}
      aria-label={`Продолжить с Telegram (@${botUsername.replace(/^@/, "")})`}
    >
      <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.5 3.1 2.9 10.4c-1.27.5-1.26 1.2-.23 1.5l4.78 1.5 1.84 5.72c.23.7.1.97.7.97.45 0 .66-.2 1.03-.55l2.48-2.4 5.15 3.8c.95.53 1.63.25 1.87-.88L22.9 4.4c.32-1.28-.46-1.84-1.4-1.3ZM8.9 14.1l-.3 3.7 1.95-1.97 5.55-5.03c.27-.27.52-.4.3-.03L8.9 14.1Z" />
      </svg>
      Продолжить с Telegram
    </button>
  );
}
