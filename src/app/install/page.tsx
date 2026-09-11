import type { Metadata } from "next";
import Link from "next/link";
import { InstallPageClient } from "@/components/InstallPageClient";
import { getApkDownloadUrl, getRustoreUrl } from "@/lib/android-install";
import { withBasePath } from "@/lib/paths";

export const metadata: Metadata = {
  title: "Установка — Calorie Vision",
  description:
    "Установите Calorie Vision на экран «Домой» или скачайте Android APK — без App Store и Google Play.",
};

export default function InstallPage() {
  const apkUrl = getApkDownloadUrl();
  const rustoreUrl = getRustoreUrl();

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">На телефон</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-slate-900">Установка</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Calorie Vision — PWA. Добавьте на главный экран: иконка, полноэкранный режим, удобный дневник.
          На Android можно скачать APK. Напоминания на iPhone работают только с этой иконки (iOS 16.4+).
        </p>
      </div>

      <InstallPageClient />

      <section className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
        <h2 className="font-semibold text-slate-900">Android · APK</h2>
        <p className="mt-1 text-sm text-slate-600">
          Тот же сайт в обёртке приложения. Установите APK напрямую — без Google Play.
          {rustoreUrl ? " Или поставьте из RuStore." : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={apkUrl} className="btn btn-primary inline-flex" download>
            Скачать APK
          </a>
          {rustoreUrl ? (
            <a
              href={rustoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary inline-flex"
            >
              Открыть в RuStore
            </a>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          Файл: <code className="text-slate-500">calorie-vision.apk</code>. После сборки копируется
          в <code className="text-slate-500">public/downloads/</code> скриптом{" "}
          <code className="text-slate-500">rustore:build</code>.
        </p>
      </section>

      {!rustoreUrl ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">RuStore</h2>
          <p className="mt-1 text-sm text-slate-600">
            Готовим бесплатное приложение в RuStore на базе этого же сайта. Пока удобнее APK или PWA
            на экран «Домой».
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            Для TWA на сервере нужен <code className="text-slate-500">TWA_SHA256_FINGERPRINTS</code> — см.{" "}
            <code className="text-slate-500">rustore/README.md</code>.
          </p>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link href={withBasePath("/ration")} className="btn btn-primary">
          Открыть рацион
        </Link>
        <Link href={withBasePath("/")} className="btn btn-secondary">
          На главную
        </Link>
      </div>
    </main>
  );
}
