"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { ConfirmationCard } from "@/components/ConfirmationCard";
import { DailyLog } from "@/components/DailyLog";
import { PhotoUploader } from "@/components/PhotoUploader";
import { formatDateInput } from "@/lib/dates";
import type { RecognitionResponse } from "@/types";

export default function HomePage() {
  const { status } = useSession();
  const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date()));
  const [pendingResult, setPendingResult] = useState<RecognitionResponse | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const isAuthenticated = status === "authenticated";

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

          <div className="flex flex-col items-stretch gap-4 sm:items-end">
            <AuthPanel />
            <div className="field min-w-52">
              <label htmlFor="date">Дата</label>
              <input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                disabled={!isAuthenticated}
              />
            </div>
          </div>
        </div>
      </header>

      {!isAuthenticated && status !== "loading" ? (
        <section className="card p-8 text-center">
          <h2 className="text-xl font-semibold">Войдите, чтобы начать</h2>
          <p className="mt-2 text-slate-600">
            Дневник питания привязан к вашему аккаунту Google или Apple.
          </p>
          <Link href="/login" className="btn btn-primary mt-6 inline-flex">
            Войти
          </Link>
        </section>
      ) : (
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
                  setRefreshKey((value) => value + 1);
                }}
              />
            ) : null}
          </div>

          <DailyLog selectedDate={selectedDate} refreshKey={refreshKey} />
        </div>
      )}
    </main>
  );
}
