"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12">
      <section className="card p-8 text-center">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Calorie Vision
        </p>
        <h1 className="font-display mt-3 text-2xl font-bold tracking-tight text-[var(--foreground)]">
          Что-то пошло не так
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Не удалось загрузить страницу. Попробуйте ещё раз или вернитесь на главную.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Попробовать снова
          </button>
          <Link href="/" className="btn btn-secondary inline-flex items-center justify-center">
            На главную
          </Link>
        </div>
      </section>
    </main>
  );
}
