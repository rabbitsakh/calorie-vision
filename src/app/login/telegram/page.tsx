"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { withBasePath } from "@/lib/paths";
import { parseTelegramLoginCallback } from "@/lib/telegram-oauth-result";

function TelegramCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const queryError = searchParams.get("error")?.trim();
    if (queryError) {
      setError(queryError);
      return;
    }

    const ticket = searchParams.get("ticket")?.trim();
    if (ticket) {
      let cancelled = false;
      void (async () => {
        const result = await signIn("telegram", {
          ticket,
          redirect: false,
          callbackUrl: withBasePath("/"),
        });
        if (cancelled) return;
        if (!result?.ok) {
          setError("Не удалось войти через Telegram. Попробуйте ещё раз.");
          return;
        }
        router.replace("/ration/");
      })();
      return () => {
        cancelled = true;
      };
    }

    const fromQuery = Object.fromEntries(searchParams.entries());
    const data = parseTelegramLoginCallback(
      typeof window !== "undefined" ? window.location.hash : "",
      fromQuery,
    );

    const id = data.id?.trim();
    const hash = data.hash?.trim();
    const authDate = data.auth_date?.trim();

    if (!id || !hash || !authDate) {
      setError(
        "Telegram не вернул данные входа. Если ошибка повторяется: добавьте в BotFather Login Widget callback https://calorievision.ru/api/auth/telegram/callback и TELEGRAM_CLIENT_SECRET, либо /setdomain → calorievision.ru.",
      );
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await signIn("telegram", {
        id,
        first_name: data.first_name ?? "",
        last_name: data.last_name ?? "",
        username: data.username ?? "",
        photo_url: data.photo_url ?? "",
        auth_date: authDate,
        hash,
        redirect: false,
        callbackUrl: withBasePath("/"),
      });

      if (cancelled) return;

      if (!result?.ok) {
        setError("Не удалось войти через Telegram. Попробуйте ещё раз.");
        return;
      }

      router.replace("/ration/");
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
      <div className="card p-8 text-center">
        <div className="flex items-center justify-center gap-3">
          <BrandMark size={40} />
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">Calorie Vision</p>
        </div>
        {error ? (
          <>
            <p className="mt-4 text-sm text-red-600">{error}</p>
            <a href={withBasePath("/login")} className="btn btn-primary mt-6 inline-flex">
              Вернуться ко входу
            </a>
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-600">Входим через Telegram…</p>
        )}
      </div>
    </main>
  );
}

export default function TelegramCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
          <p className="text-center text-sm text-slate-500">Загрузка…</p>
        </main>
      }
    >
      <TelegramCallbackInner />
    </Suspense>
  );
}
