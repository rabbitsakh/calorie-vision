import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-12">
      <section className="card p-8 text-center">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
          Calorie Vision
        </p>
        <h1 className="font-display mt-3 text-2xl font-bold tracking-tight text-[var(--foreground)]">
          Страница не найдена
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Такой страницы нет. Проверьте адрес или откройте дневник с главной.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className="btn btn-primary inline-flex items-center justify-center">
            На главную
          </Link>
          <Link href="/login" className="btn btn-secondary inline-flex items-center justify-center">
            Войти
          </Link>
        </div>
      </section>
    </main>
  );
}
