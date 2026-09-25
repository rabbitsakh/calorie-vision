"use client";

import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { TelegramLoginButton } from "@/components/TelegramLoginButton";
import { detectCapacitorShell, isCapacitorNative, markCapacitorShell } from "@/lib/capacitor-bridge";
import { ensureCapacitorOAuthDeepLink, startCapacitorOAuth } from "@/lib/capacitor-oauth";
import { isApkWebView, resumeCapacitorSessionInPlace } from "@/lib/capacitor-resume";
import { hasSeenAppWelcomeSync } from "@/lib/capacitor-welcome";
import { withBasePath } from "@/lib/paths";

type LoginOptions = {
  email: boolean;
  telegram: boolean;
  telegramBotUsername: string | null;
  telegramBotId: string | null;
  telegramOrigin?: string | null;
  telegramOidc?: boolean;
  google: boolean;
  vk: boolean;
  yandex: boolean;
};

const PROVIDER_ERROR_LABEL: Record<string, string> = {
  yandex: "Яндекс",
  google: "Google",
  vk: "VK",
  telegram: "Telegram",
  email: "email",
};

const AUTH_ERRORS: Record<string, string> = {
  OAuthSignin: "Не удалось начать вход через соцсеть.",
  OAuthCallback: "Не удалось войти через соцсеть. Попробуйте ещё раз или используйте другой способ входа.",
  OAuthCreateAccount: "Не удалось создать аккаунт.",
  OAuthAccountNotLinked:
    "Не удалось связать аккаунт. Войдите тем способом, которым регистрировались, или напишите в поддержку.",
  /** Generic adapter/callback failure — never blame a specific network. */
  Callback: "Не удалось завершить вход. Попробуйте ещё раз.",
  CredentialsSignin: "Не удалось войти. Проверьте данные и попробуйте ещё раз.",
  Configuration: "Вход через соцсеть не настроен на сервере.",
  AccessDenied: "Доступ через соцсеть запрещён.",
  yandex: "Не удалось войти через Яндекс. Проверьте права приложения в oauth.yandex.ru (в т.ч. доступ к телефону).",
  google: "Не удалось войти через Google. Попробуйте ещё раз.",
  vk: "Не удалось войти через VK. Попробуйте ещё раз.",
  Default: "Не удалось войти. Попробуйте ещё раз.",
};

const LAST_OAUTH_PROVIDER_KEY = "cv-last-oauth-provider";

function rememberOauthProvider(provider: string): void {
  try {
    sessionStorage.setItem(LAST_OAUTH_PROVIDER_KEY, provider);
  } catch {
    // ignore
  }
}

function readLastOauthProvider(): string | null {
  try {
    return sessionStorage.getItem(LAST_OAUTH_PROVIDER_KEY);
  } catch {
    return null;
  }
}

function resolveAuthErrorMessage(errorCode: string | null, providerHint: string | null): string {
  if (!errorCode) {
    return AUTH_ERRORS.Default;
  }

  const known = AUTH_ERRORS[errorCode];
  if (known && errorCode !== "Callback" && errorCode !== "OAuthCallback" && errorCode !== "OAuthSignin") {
    return known;
  }

  const hint = (providerHint ?? readLastOauthProvider() ?? "").toLowerCase();
  const providerLabel = PROVIDER_ERROR_LABEL[hint] ?? PROVIDER_ERROR_LABEL[errorCode.toLowerCase()];
  if (providerLabel) {
    if (errorCode.toLowerCase() === "yandex") {
      return AUTH_ERRORS.yandex;
    }
    return `Не удалось войти через ${providerLabel}. Попробуйте ещё раз.`;
  }

  return known ?? AUTH_ERRORS.Default;
}

const EMPTY_OPTIONS: LoginOptions = {
  email: false,
  telegram: false,
  telegramBotUsername: null,
  telegramBotId: null,
  google: false,
  vk: false,
  yandex: false,
};

export default function LoginForm() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [options, setOptions] = useState<LoginOptions | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  /** APK shell — hide web chrome («На главную»). Sync seed + async confirm. */
  const [capacitorShell, setCapacitorShell] = useState(() => isCapacitorNative());

  const verifyRequest = searchParams.get("verify") === "1";
  const authError = searchParams.get("error");
  const providerHint = searchParams.get("provider");
  const ready = options ?? EMPTY_OPTIONS;

  const hasSocial = ready.google || ready.vk || ready.yandex || ready.telegram;

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/ration/");
    }
  }, [status, router]);

  useEffect(() => {
    if (authError) {
      setError(resolveAuthErrorMessage(authError, providerHint));
    }
  }, [authError, providerHint]);

  // Capacitor: hook App Link return from Chrome Custom Tabs (Google/VK OAuth).
  useEffect(() => {
    void ensureCapacitorOAuthDeepLink();
    const onFinished = () => setLoading(false);
    window.addEventListener("cv-oauth-browser-finished", onFinished);
    return () => window.removeEventListener("cv-oauth-browser-finished", onFinished);
  }, []);

  // Detect Capacitor / CvSession (product origin has no Cap JS — only CvSession).
  // If a resume token is stored, re-mint cookies and leave /login immediately.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const native = (await detectCapacitorShell(2500)) || isApkWebView();
      if (cancelled || !native) return;
      markCapacitorShell();
      setCapacitorShell(true);
      if (status === "authenticated") return;
      await resumeCapacitorSessionInPlace();
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  // First-run: show welcome slider before login in the APK.
  // Sync localStorage only — async Preferences raced and looped welcome ↔ login.
  useLayoutEffect(() => {
    if (!isCapacitorNative() && !capacitorShell) return;
    if (hasSeenAppWelcomeSync()) return;
    router.replace(withBasePath("/welcome"));
  }, [router, capacitorShell]);

  useEffect(() => {
    let cancelled = false;

    fetch(withBasePath("/api/auth/login-options"))
      .then((response) => response.json())
      .then((data: LoginOptions) => {
        if (cancelled) return;
        setOptions(data);
        if (!data.google && !data.vk && !data.yandex && !data.telegram && data.email) {
          setShowEmail(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOptions(EMPTY_OPTIONS);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEmailLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const result = await signIn("email", {
      email,
      redirect: false,
      callbackUrl: withBasePath("/ration/"),
    });

    setLoading(false);

    if (result?.error) {
      setError(
        result.error === "EmailSignin" || result.error === "Configuration"
          ? "Не удалось отправить письмо. Проверьте SMTP (EMAIL_SERVER) на сервере и адрес email."
          : "Не удалось отправить письмо. Проверьте адрес email и попробуйте позже.",
      );
      return;
    }

    setMessage("Ссылка для входа отправлена на ваш email");
  }

  async function handleOauthLogin(provider: "google" | "vk" | "yandex") {
    setLoading(true);
    setError(null);
    rememberOauthProvider(provider);
    try {
      // Capacitor: stay in the app WebView (IdP hosts allowlisted). Do not open Custom Tabs.
      await startCapacitorOAuth(provider, withBasePath("/ration/"));
    } catch {
      setLoading(false);
      setError(resolveAuthErrorMessage("OAuthSignin", provider));
    }
  }

  return (
    <main className="login-screen mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="card p-8">
        <div className="flex items-center gap-3">
          <BrandMark size={72} />
          <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            Calorie Vision
          </p>
        </div>
        <h1 className="font-display mt-3 text-2xl font-bold tracking-tight">Вход в аккаунт</h1>
        <p className="mt-2 text-slate-600 capacitor-web-only">
          Войдите через Яндекс, Google, VK, Telegram или email — дневник сохранится в вашем аккаунте.
        </p>
        <p className="mt-2 text-slate-600 capacitor-native-only">
          Вход через соцсети остаётся в приложении. После авторизации откроется ваш дневник.
        </p>

        {verifyRequest ? (
          <p className="mt-4 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900">
            Проверьте почту — мы отправили ссылку для входа.
          </p>
        ) : null}

        {options === null ? (
          <p className="mt-6 text-sm text-slate-500">Загрузка способов входа…</p>
        ) : (
          <>
            {hasSocial ? (
              <div className="mt-6 flex flex-col gap-3">
                {ready.yandex ? (
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#FC3F1D] px-4 py-3 font-medium text-white transition hover:bg-[#e53718]"
                    disabled={loading}
                    onClick={() => handleOauthLogin("yandex")}
                  >
                    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.85 3H8.5v18h3.1v-6.2h1.25c3.55 0 5.8-1.95 5.8-5.05C18.65 5.05 16.35 3 12.85 3zm.05 9.15h-1.3V5.65h1.15c2.05 0 3.2.95 3.2 3.15 0 2.3-1.2 3.35-3.05 3.35z" />
                    </svg>
                    Продолжить с Яндекс
                  </button>
                ) : null}
                {ready.google ? (
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-800 transition hover:border-teal-300 hover:bg-teal-50"
                    disabled={loading}
                    onClick={() => handleOauthLogin("google")}
                  >
                    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Продолжить с Google
                  </button>
                ) : null}
                {ready.vk ? (
                  <button
                    type="button"
                    className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#0077FF] px-4 py-3 font-medium text-white transition hover:bg-[#0066dd]"
                    disabled={loading}
                    onClick={() => handleOauthLogin("vk")}
                  >
                    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.6 16.8h-1.5s-1.1.1-2-.7c-1.2-1.1-2.3-3.2-3.1-4.3-.8-1.1-.2-.9.4-.9h1.8c.5 0 .7.3.8.6.6 1.3 1.6 3.4 2 3.4.4 0 .5-.6.5-1v-3.3c0-.8-.2-1.3-.8-1.4-.2 0 .1-.4 1.1-.4h1.4c.6 0 .8.3.8.9v4.2c0 .5.2 1 .8 0 .5-.9 1.4-2.6 2-3.6.2-.4.5-.6.9-.6h1.8c.9 0 .6.5.3 1.1-.6 1.2-2.1 3.5-2.2 3.7-.3.4-.4.6 0 1 .3.4 1.3 1.3 2 2.1.8.9.2 1.3-.5 1.3h-1.7c-.5 0-.7-.2-1.2-.7-.5-.6-1.3-1.6-1.7-1.6-.4 0-.5.3-.5 1v1.1c0 .4-.2.8-1.1.8z" />
                    </svg>
                    Продолжить с VK
                  </button>
                ) : null}
                {ready.telegram && ready.telegramBotUsername && ready.telegramBotId ? (
                  <TelegramLoginButton
                    botId={ready.telegramBotId}
                    botUsername={ready.telegramBotUsername}
                    origin={ready.telegramOrigin}
                    useOidc={Boolean(ready.telegramOidc)}
                    disabled={loading}
                  />
                ) : null}
              </div>
            ) : null}

            {ready.email ? (
              <div className={`${hasSocial ? "mt-6 border-t border-slate-200 pt-6" : "mt-6"}`}>
                {hasSocial ? (
                  <button
                    type="button"
                    className="text-sm font-semibold text-teal-800 hover:underline"
                    onClick={() => setShowEmail((value) => !value)}
                  >
                    {showEmail ? "Скрыть вход по email" : "Войти по email"}
                  </button>
                ) : (
                  <p className="text-sm font-semibold text-slate-700">Вход по email</p>
                )}

                {showEmail || !hasSocial ? (
                  <form className="mt-4 flex flex-col gap-4" onSubmit={handleEmailLogin}>
                    <div className="field">
                      <label htmlFor="email">Email</label>
                      <input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        disabled={loading}
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary inline-flex items-center justify-center gap-2"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="daisy-loading daisy-loading-sm" aria-hidden>
                            <span />
                            <span />
                            <span />
                          </span>
                          Отправляем…
                        </>
                      ) : (
                        "Получить ссылку для входа"
                      )}
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}

            {!hasSocial && !ready.email ? (
              <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Способы входа ещё не настроены на сервере. Нужны Яндекс, Google, VK, Telegram или SMTP для email.
              </p>
            ) : null}
          </>
        )}

        {message ? <p className="mt-4 text-sm text-teal-700">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        {/* Web only — APK must not look like a site with «На главную». */}
        {!capacitorShell ? (
          <p className="capacitor-web-only mt-6 text-center text-sm text-slate-500">
            <Link href="/" className="text-teal-700 hover:underline">
              На главную
            </Link>
          </p>
        ) : null}
      </div>
    </main>
  );
}
