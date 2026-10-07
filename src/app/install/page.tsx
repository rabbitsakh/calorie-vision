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
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--foreground)]">Установка</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted-strong)]">
          Calorie Vision — PWA. Добавьте на главный экран: иконка, полноэкранный режим, удобный дневник.
          На Android можно скачать APK. Напоминания на iPhone работают только с этой иконки (iOS 16.4+).
        </p>
      </div>

      <InstallPageClient />

      <section className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
        <h2 className="font-semibold text-[var(--foreground)]">Android · APK</h2>
        <p className="mt-1 text-sm text-[var(--muted-strong)]">
          Тот же дневник на телефоне: офлайн-иконка, напоминания и камера. Установите APK
          напрямую — без Google Play.
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
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
          Файл: <code className="text-[var(--muted)]">calorie-vision.apk</code>. После сборки копируется
          в <code className="text-[var(--muted)]">public/downloads/</code> скриптом{" "}
          <code className="text-[var(--muted)]">rustore:build</code>.
        </p>
      </section>

      {rustoreUrl ? (
        <section className="rounded-2xl border border-[rgba(13,115,119,0.14)] bg-white p-4">
          <h2 className="font-semibold text-[var(--foreground)]">RuStore</h2>
          <p className="mt-1 text-sm text-[var(--muted-strong)]">
            Бесплатное приложение в RuStore — тот же дневник и зал. Удобнее ставить из магазина: обновления
            приходят сами.
          </p>
          <a
            href={rustoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary mt-3 inline-flex"
          >
            Открыть в RuStore
          </a>
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
