import type { Metadata } from "next";
import Link from "next/link";
import { InstallPageClient } from "@/components/InstallPageClient";
import {
  getApkDownloadUrl,
  getRustoreBadgeUrl,
  getRustoreUrl,
  RUSTORE_BADGE_SRC,
} from "@/lib/android-install";
import { withBasePath } from "@/lib/paths";

export const metadata: Metadata = {
  title: "Установка — Calorie Vision",
  description:
    "Установите Calorie Vision на экран «Домой» или скачайте Android APK — без App Store и Google Play.",
};

export default function InstallPage() {
  const apkUrl = getApkDownloadUrl();
  const rustoreUrl = getRustoreUrl();
  const rustoreBadgeUrl = getRustoreBadgeUrl();

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">На телефон</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--foreground)]">Установка</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted-strong)]">
          Calorie Vision — PWA. Добавьте на главный экран: иконка, полноэкранный режим, удобный дневник.
          На Android удобнее ставить из RuStore. Напоминания на iPhone работают только с этой иконки
          (iOS 16.4+).
        </p>
      </div>

      <InstallPageClient />

      {rustoreUrl && rustoreBadgeUrl ? (
        <section className="rounded-2xl border border-[rgba(13,115,119,0.14)] bg-white p-4">
          <h2 className="font-semibold text-[var(--foreground)]">Android · RuStore</h2>
          <p className="mt-1 text-sm text-[var(--muted-strong)]">
            Бесплатное приложение в официальном магазине — тот же дневник и зал. Обновления приходят
            сами, без Google Play.
          </p>
          <a
            href={rustoreBadgeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="landing-rustore-badge mt-3"
            aria-label="Скачать из RuStore"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={withBasePath(RUSTORE_BADGE_SRC)}
              alt="Скачать из RuStore"
              width={188}
              height={68}
              decoding="async"
            />
          </a>
        </section>
      ) : null}

      <section className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
        <h2 className="font-semibold text-[var(--foreground)]">Android · APK</h2>
        <p className="mt-1 text-sm text-[var(--muted-strong)]">
          Тот же дневник на телефоне: офлайн-иконка, напоминания и камера. Установите APK
          напрямую — без Google Play.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={apkUrl} className="btn btn-primary inline-flex" download>
            Скачать APK
          </a>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
          Файл: <code className="text-[var(--muted)]">calorie-vision.apk</code>. После сборки копируется
          в <code className="text-[var(--muted)]">public/downloads/</code> скриптом{" "}
          <code className="text-[var(--muted)]">rustore:build</code>.
        </p>
      </section>

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
