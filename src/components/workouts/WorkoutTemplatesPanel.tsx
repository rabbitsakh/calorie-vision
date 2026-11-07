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
    <div className="gym-hub-scene gap-3">
      <button
        type="button"
        className="gym-primary"
        onClick={onCreateNew}
      >
        + Новый шаблон
      </button>
      {routines.length === 0 ? (
        <div className="scene-empty">
          <p className="scene-empty__title">Пока нет шаблонов</p>
          <p className="scene-empty__hint">Создайте шаблон — старт тренировки в один тап.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {routines.map((r) => (
            <li
              key={r.id}
              className="gym-template"
            >
              <div className="gym-template__body">
                <p className="gym-template__name">
                  {r.planLabel ? (
                    <span className="gym-template__plan">{r.planLabel}</span>
                  ) : null}
                  {r.name}
                </p>
                <p className="gym-template__meta">
                  {r.muscleLabels.join(" · ")}
                  {r.muscleLabels.length ? " · " : ""}
                  {r.exerciseCount} упр.
                </p>
              </div>
              <div className="gym-template__actions">
                <button type="button" disabled={busy} className="is-accent" onClick={() => onStart(r.id)}>
                  Старт
                </button>
                <button type="button" disabled={busy} onClick={() => onEdit(r.id)}>
                  Изменить
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="is-danger"
                  title="Удалить шаблон"
                  onClick={() => onDelete(r.id)}
                >
                  Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
