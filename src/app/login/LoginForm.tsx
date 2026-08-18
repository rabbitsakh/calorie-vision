"use client";

import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { withBasePath } from "@/lib/paths";

type AuthTab = "phone" | "email";

const AUTH_ERRORS: Record<string, string> = {
  OAuthSignin: "Не удалось начать вход через соцсеть.",
  OAuthCallback: "Не удалось войти через VK. В кабинете VK ID в «Доверенный Redirect URL» укажите точно https://calorievision.ru/api/auth/callback/vk",
  OAuthCreateAccount: "Не удалось создать аккаунт.",
  OAuthAccountNotLinked: "Этот email уже используется другим способом входа.",
  Callback: "Не удалось сохранить вход через VK. Попробуйте ещё раз.",
  CredentialsSignin: "Неверный или просроченный код.",
  Configuration: "Вход через соцсеть не настроен на сервере.",
  AccessDenied: "Доступ через соцсеть запрещён.",
  Default: "Не удалось войти. Попробуйте ещё раз.",
};

export default function LoginForm() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<AuthTab>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<{ google: boolean; vk: boolean }>({
    google: false,
    vk: false,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verifyRequest = searchParams.get("verify") === "1";
  const authError = searchParams.get("error");

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (authError) {
      setError(AUTH_ERRORS[authError] ?? AUTH_ERRORS.Default);
    }
  }, [authError]);

  useEffect(() => {
    let cancelled = false;

    fetch(withBasePath("/api/auth/providers"))
      .then((response) => response.json())
      .then((providers: Record<string, unknown>) => {
        if (!cancelled) {
          setOauthProviders({
            google: Boolean(providers?.google),
            vk: Boolean(providers?.vk),
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOauthProviders({ google: false, vk: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSendCode(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(withBasePath("/api/auth/phone/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await response.json()) as { error?: string; message?: string; devCode?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось отправить код");
      }

      setCodeSent(true);
      setMessage(
        data.devCode
          ? `Код для разработки: ${data.devCode}`
          : (data.message ?? "Код отправлен по SMS"),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отправки");
    } finally {
      setLoading(false);
    }
  }

  async function handlePhoneLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("phone", {
      phone,
      code,
      redirect: false,
      callbackUrl: withBasePath("/"),
    });

    setLoading(false);

    if (!result?.ok) {
      setError("Неверный или просроченный код");
      return;
    }

    router.replace("/");
  }

  async function handleEmailLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const result = await signIn("email", {
      email,
      redirect: false,
      callbackUrl: withBasePath("/"),
    });

    setLoading(false);

    if (result?.error) {
      setError("Не удалось отправить письмо. Проверьте email и настройки SMTP.");
      return;
    }

    setMessage("Ссылка для входа отправлена на ваш email");
  }

  function handleOauthLogin(provider: "google" | "vk") {
    setLoading(true);
    setError(null);
    void signIn(provider, { callbackUrl: withBasePath("/") });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="card p-8">
        <div className="flex items-center gap-3">
          <BrandMark size={48} />
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
            Calorie Vision
          </p>
        </div>
        <h1 className="mt-3 text-2xl font-bold">Вход в аккаунт</h1>
        <p className="mt-2 text-slate-600">
          Войдите по телефону, email, Google или VK, чтобы сохранять дневник питания.
        </p>

        {verifyRequest ? (
          <p className="mt-4 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900">
            Проверьте почту — мы отправили ссылку для входа.
          </p>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === "phone" ? "bg-white text-teal-800 shadow" : "text-slate-600"}`}
            onClick={() => setTab("phone")}
          >
            Телефон
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === "email" ? "bg-white text-teal-800 shadow" : "text-slate-600"}`}
            onClick={() => setTab("email")}
          >
            Email
          </button>
        </div>

        {tab === "phone" ? (
          <form className="mt-6 flex flex-col gap-4" onSubmit={codeSent ? handlePhoneLogin : handleSendCode}>
            <div className="field">
              <label htmlFor="phone">Номер телефона</label>
              <input
                id="phone"
                type="tel"
                placeholder="+7 900 123-45-67"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={loading}
                required
              />
            </div>

            {codeSent ? (
              <div className="field">
                <label htmlFor="code">Код из SMS</label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            ) : null}

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Подождите…" : codeSent ? "Войти" : "Получить код"}
            </button>

            {codeSent ? (
              <button
                type="button"
                className="text-sm text-teal-700 hover:underline"
                onClick={() => {
                  setCodeSent(false);
                  setCode("");
                  setMessage(null);
                }}
              >
                Изменить номер
              </button>
            ) : null}
          </form>
        ) : (
          <form className="mt-6 flex flex-col gap-4" onSubmit={handleEmailLogin}>
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

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Отправляем…" : "Получить ссылку для входа"}
            </button>
          </form>
        )}

        {message ? <p className="mt-4 text-sm text-teal-700">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        {oauthProviders.google || oauthProviders.vk ? (
          <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-6">
            {oauthProviders.google ? (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-800 transition hover:border-teal-300 hover:bg-teal-50"
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
            {oauthProviders.vk ? (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#0077FF] px-4 py-3 font-medium text-white transition hover:bg-[#0066dd]"
                disabled={loading}
                onClick={() => handleOauthLogin("vk")}
              >
                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.6 16.8h-1.5s-1.1.1-2-.7c-1.2-1.1-2.3-3.2-3.1-4.3-.8-1.1-.2-.9.4-.9h1.8c.5 0 .7.3.8.6.6 1.3 1.6 3.4 2 3.4.4 0 .5-.6.5-1v-3.3c0-.8-.2-1.3-.8-1.4-.2 0 .1-.4 1.1-.4h1.4c.6 0 .8.3.8.9v4.2c0 .5.2 1 .8 0 .5-.9 1.4-2.6 2-3.6.2-.4.5-.6.9-.6h1.8c.9 0 .6.5.3 1.1-.6 1.2-2.1 3.5-2.2 3.7-.3.4-.4.6 0 1 .3.4 1.3 1.3 2 2.1.8.9.2 1.3-.5 1.3h-1.7c-.5 0-.7-.2-1.2-.7-.5-.6-1.3-1.6-1.7-1.6-.4 0-.5.3-.5 1v1.1c0 .4-.2.8-1.1.8z" />
                </svg>
                Продолжить с VK
              </button>
            ) : null}
          </div>
        ) : null}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/" className="text-teal-700 hover:underline">
            На главную
          </Link>
        </p>
      </div>
    </main>
  );
}
