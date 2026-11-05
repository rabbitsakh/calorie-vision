"use client";

import { useEffect, useState } from "react";
import {
  EXERCISE_KINDS,
  EXERCISE_KIND_LABELS,
  EXERCISE_KIND_PLACEHOLDERS,
  type ExerciseKind,
} from "@/lib/workouts/exercise-kind";
import { MUSCLE_GROUPS, type MuscleGroupKey } from "@/lib/workouts/muscle-groups";
import type { CatalogSearchHit } from "@/lib/workouts/catalog-search";
import { withBasePath } from "@/lib/paths";

type Suggestion = {
  name: string;
  count: number;
};

type Props = {
  busy?: boolean;
  kind: ExerciseKind;
  name: string;
  suggestions: Suggestion[];
  onKind: (kind: ExerciseKind) => void;
  onName: (name: string) => void;
  onAdd: (
    name?: string,
    kind?: ExerciseKind,
    extra?: { restSec?: number; muscle?: string },
  ) => void;
  onClose: () => void;
};

/** Поле с автоподсказкой справочника. Своё название по-прежнему можно ввести текстом. */
export function ExerciseAddSheet({
  busy,
  kind,
  name,
  suggestions,
  onKind,
  onName,
  onAdd,
  onClose,
}: Props) {
  const [muscle, setMuscle] = useState<MuscleGroupKey | "">("");
  const [hits, setHits] = useState<CatalogSearchHit[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (name.trim()) params.set("q", name.trim());
      if (muscle) params.set("muscle", muscle);
      params.set("limit", "12");
      void fetch(withBasePath(`/api/workouts/catalog?${params}`), { signal: ctrl.signal })
        .then(async (res) => {
          if (!res.ok) return;
          const data = (await res.json()) as { hits?: CatalogSearchHit[] };
          setHits(data.hits ?? []);
        })
        .catch(() => {
          // офлайн — остаётся ввод своего названия
        });
    }, 160);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [name, muscle]);

  const exact = hits.some((hit) => hit.name.toLocaleLowerCase("ru") === name.trim().toLocaleLowerCase("ru"));

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Добавить упражнение"
        className="gym-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">Упражнение</h3>
          <button type="button" className="gym-chip" onClick={onClose}>
            Закрыть
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={`gym-chip ${muscle === "" ? "is-on" : ""}`}
            onClick={() => setMuscle("")}
          >
            Все
          </button>
          {MUSCLE_GROUPS.map((group) => (
            <button
              key={group.key}
              type="button"
              className={`gym-chip ${muscle === group.key ? "is-on" : ""}`}
              onClick={() => setMuscle(group.key)}
            >
              {group.label}
            </button>
          ))}
        </div>
        <label className="mt-3 flex flex-col gap-1 text-xs text-[var(--muted)]">
          Название
          <input
            className="gym-field"
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
        {hits.length > 0 ? (
          <ul className="mt-3 flex max-h-64 flex-col gap-1.5 overflow-auto">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  disabled={busy}
                  className="gym-hit"
                  onClick={() =>
                    onAdd(hit.name, hit.kind, {
                      restSec: hit.defaultRestSec,
                      muscle: hit.primary[0],
                    })
                  }
                >
                  <span>
                    <span className="block font-semibold text-[var(--foreground)]">{hit.name}</span>
                    <span className="block text-xs text-[var(--muted)]">
                      {hit.primaryLabels.join(" · ")} · {hit.equipmentLabel}
                      {hit.source === "recent" ? " · недавнее" : ""}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-[var(--accent-ink)]">Добавить</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {suggestions.length > 0 && !name.trim() ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {suggestions.map((item) => (
              <button
                key={item.name}
                type="button"
                disabled={busy}
                className="gym-chip"
                onClick={() => onAdd(item.name)}
              >
                {item.name}
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXERCISE_KINDS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onKind(key)}
              className={`gym-chip ${kind === key ? "is-on" : ""}`}
            >
              {EXERCISE_KIND_LABELS[key]}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={busy || !name.trim()}
          className="gym-primary mt-3 w-full"
          onClick={() => onAdd()}
        >
          {busy ? "Добавляем…" : exact ? "Добавить из справочника" : "Своё упражнение"}
        </button>
      </div>
    </div>
  );
}
