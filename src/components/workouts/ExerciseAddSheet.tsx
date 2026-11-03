"use client";

import {
  EXERCISE_KINDS,
  EXERCISE_KIND_LABELS,
  EXERCISE_KIND_PLACEHOLDERS,
  type ExerciseKind,
} from "@/lib/workouts/exercise-kind";

type LibraryHit = {
  id: string;
  name: string;
  kind: ExerciseKind;
  useCount: number;
};

type Suggestion = {
  name: string;
  count: number;
};

type Props = {
  busy?: boolean;
  kind: ExerciseKind;
  name: string;
  hits: LibraryHit[];
  suggestions: Suggestion[];
  onKind: (kind: ExerciseKind) => void;
  onName: (name: string) => void;
  onAdd: (name?: string, kind?: ExerciseKind) => void;
  onClose: () => void;
};

/** Existing name search + library hits. Free text stays as the fallback. */
export function ExerciseAddSheet({
  busy,
  kind,
  name,
  hits,
  suggestions,
  onKind,
  onName,
  onAdd,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Добавить упражнение"
        className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-[var(--foreground)]">Упражнение</h3>
          <button
            type="button"
            className="min-h-[44px] px-2 text-sm font-medium text-[var(--muted-strong)]"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {EXERCISE_KINDS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onKind(key)}
              className={`min-h-[44px] rounded-full px-3 text-xs font-semibold ${
                kind === key
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--accent-soft)] text-[var(--muted-strong)]"
              }`}
            >
              {EXERCISE_KIND_LABELS[key]}
            </button>
          ))}
        </div>
        <label className="mt-3 flex flex-col gap-1 text-xs text-[var(--muted)]">
          Название
          <input
            className="min-h-[44px] rounded-lg border border-[var(--border-quiet)] px-3 text-base text-[var(--foreground)]"
            placeholder={EXERCISE_KIND_PLACEHOLDERS[kind]}
            value={name}
            autoFocus
            autoComplete="off"
            disabled={busy}
            onChange={(e) => onName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
          />
        </label>
        <button
          type="button"
          disabled={busy || !name.trim()}
          className="mt-3 min-h-[44px] w-full rounded-lg bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-40"
          onClick={() => onAdd()}
        >
          {busy ? "Добавляем…" : "Добавить текстом"}
        </button>
        {suggestions.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s.name}
                type="button"
                disabled={busy}
                className="min-h-[44px] rounded-full bg-[var(--accent-soft)] px-3 text-xs font-medium text-[var(--muted-strong)]"
                onClick={() => onAdd(s.name)}
              >
                {s.name}
              </button>
            ))}
          </div>
        ) : null}
        {hits.length > 0 ? (
          <ul className="mt-3 overflow-hidden rounded-xl border border-[var(--border-quiet)]">
            {hits.map((hit) => (
              <li key={hit.id} className="border-t border-[var(--border-quiet)] first:border-t-0">
                <button
                  type="button"
                  disabled={busy}
                  className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 text-left text-sm disabled:opacity-50"
                  onClick={() => {
                    onKind(hit.kind);
                    onAdd(hit.name, hit.kind);
                  }}
                >
                  <span className="font-medium text-[var(--foreground)]">{hit.name}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {EXERCISE_KIND_LABELS[hit.kind]} · {hit.useCount}×
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
