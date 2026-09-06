import type { Metadata } from "next";
import Link from "next/link";
import { InstallPageClient } from "@/components/InstallPageClient";
import { withBasePath } from "@/lib/paths";

export const metadata: Metadata = {
  title: "Установка — Calorie Vision",
  description: "Установите Calorie Vision на экран «Домой» — PWA без App Store и Google Play.",
};

export default function InstallPage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">На телефон</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-slate-900">Установка</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Calorie Vision — PWA. Добавьте на главный экран: иконка, полноэкранный режим, удобный дневник.
          Напоминания на iPhone работают только с этой иконки (iOS 16.4+).
        </p>
      </div>

      <InstallPageClient />

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">RuStore (Android)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Готовим бесплатное приложение в RuStore на базе этого же сайта. Пока удобнее установить PWA —
          так вы сразу получите офлайн-очередь и напоминания.
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
