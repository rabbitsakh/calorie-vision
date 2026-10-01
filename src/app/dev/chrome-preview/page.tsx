import { AppShell } from "@/components/AppShell";

/**
 * Visual QA for design D0+D1 chrome (no auth).
 * Safe for APK 2.3.22 — web-only preview route.
 */
export default function ChromePreviewPage() {
  return (
    <AppShell title="Рацион" description="Превью хрома D0+D1" compact date="2026-10-01">
      <section className="space-y-3 py-2">
        <p className="font-display text-lg font-semibold text-[var(--accent-ink)]">
          Шапка без карточки · слово Calorie Vision крупнее
        </p>
        <p className="text-sm text-[var(--muted)]">
          Токены teal/cyan, таббар с индикатором. Проверка совместимости: только веб-CSS/компоненты.
        </p>
        <div className="grid grid-cols-3 gap-2 pt-2">
          <div className="rounded-[var(--radius-md)] bg-[var(--accent-soft)] px-3 py-4 text-center text-xs font-semibold text-[var(--accent-ink)]">
            Белки
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--accent-streak-soft)] px-3 py-4 text-center text-xs font-semibold text-[var(--accent-streak)]">
            Жиры
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--accent-carbs-soft)] px-3 py-4 text-center text-xs font-semibold text-[var(--accent-carbs)]">
            Углеводы
          </div>
        </div>
        <div className="card p-4 text-sm text-slate-600">
          Карточка остаётся только для интерактивных блоков — не для хрома.
        </div>
      </section>
    </AppShell>
  );
}
