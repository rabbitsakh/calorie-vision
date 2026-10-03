"use client";

export type WorkoutTemplateRow = {
  id: string;
  name: string;
  planLabel?: string | null;
  muscleLabels: string[];
  exerciseCount: number;
};

type Props = {
  routines: WorkoutTemplateRow[];
  busy: boolean;
  onCreateNew: () => void;
  onStart: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

/** Hub «Шаблоны» tab — list + start/edit/delete (extracted from WorkoutsView). */
export function WorkoutTemplatesPanel({
  routines,
  busy,
  onCreateNew,
  onStart,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
        onClick={onCreateNew}
      >
        + Новый шаблон
      </button>
      {routines.length === 0 ? (
        <p className="text-sm text-slate-500">Пока нет шаблонов.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {routines.map((r) => (
            <li
              key={r.id}
              className="flex items-stretch gap-2 rounded-xl border border-slate-100 bg-slate-50"
            >
              <button
                type="button"
                disabled={busy}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-white disabled:opacity-40"
                onClick={() => onStart(r.id)}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {r.planLabel ? (
                      <span className="mr-1 rounded bg-teal-700 px-1.5 py-0.5 text-[10px] text-white">
                        {r.planLabel}
                      </span>
                    ) : null}
                    {r.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {r.muscleLabels.join(" · ")} · {r.exerciseCount} упр.
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-teal-800">Старт</span>
              </button>
              <button
                type="button"
                className="shrink-0 border-l border-slate-100 px-2.5 text-xs font-semibold text-slate-600"
                onClick={() => onEdit(r.id)}
              >
                ✎
              </button>
              <button
                type="button"
                className="shrink-0 border-l border-slate-100 px-2.5 text-xs text-slate-400 hover:text-red-600"
                title="Удалить шаблон"
                onClick={() => onDelete(r.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
