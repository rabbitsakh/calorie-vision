"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { ConfirmationCard } from "@/components/ConfirmationCard";
import { DailyLog } from "@/components/DailyLog";
import { DayCalendar } from "@/components/DayCalendar";
import { PhotoUploader } from "@/components/PhotoUploader";
import { WeightGoalCard } from "@/components/WeightGoalCard";
import { formatDateInput } from "@/lib/dates";
import type { RecognitionResponse } from "@/types";

export default function HomePage() {
  const { status } = useSession();
  const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date()));
  const [pendingResult, setPendingResult] = useState<RecognitionResponse | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const isAuthenticated = status === "authenticated";

  function bumpRefresh() {
    setRefreshKey((value) => value + 1);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
              Calorie Vision
            </p>
            <h1 className="mt-2 text-3xl font-bold">Учёт калорий по фото</h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Загрузите фото еды — GigaChat определит блюдо и калорийность.
              Проверьте результат и сохраните в дневник.
            </p>
          </div>
          <AuthPanel />
        </div>
      </header>

      {!isAuthenticated && status !== "loading" ? (
        <section className="card p-8 text-center">
          <h2 className="text-xl font-semibold">Войдите, чтобы начать</h2>
          <p className="mt-2 text-slate-600">
            Дневник питания привязан к вашему аккаунту — войдите по телефону или email.
          </p>
          <Link href="/login" className="btn btn-primary mt-6 inline-flex">
            Войти
          </Link>
        </section>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <section className="card p-6">
              <h2 className="text-xl font-bold">Календарь</h2>
              <p className="mt-1 text-sm text-slate-500">
                Точки отмечают дни с едой или записанным весом.
              </p>
              <div className="mt-4">
                <DayCalendar
                  selectedDate={selectedDate}
                  onSelect={setSelectedDate}
                  refreshKey={refreshKey}
                  disabled={!isAuthenticated}
                />
              </div>
            </section>
            <WeightGoalCard selectedDate={selectedDate} refreshKey={refreshKey} onChanged={bumpRefresh} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="flex flex-col gap-6">
              <PhotoUploader
                disabled={Boolean(pendingResult) || !isAuthenticated}
                onRecognized={(result) => setPendingResult(result)}
              />

              {pendingResult ? (
                <ConfirmationCard
                  result={pendingResult}
                  selectedDate={selectedDate}
                  onCancel={() => setPendingResult(null)}
                  onSaved={() => {
                    setPendingResult(null);
                    bumpRefresh();
                  }}
                />
              ) : null}
            </div>

            <DailyLog selectedDate={selectedDate} refreshKey={refreshKey} onChanged={bumpRefresh} />
          </div>
        </>
      )}
    </main>
  );
}
