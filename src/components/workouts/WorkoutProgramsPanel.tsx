"use client";

import { useState } from "react";
import { withBasePath } from "@/lib/paths";
import { EQUIPMENT_KEYS, EQUIPMENT_LABELS, type EquipmentKey } from "@/lib/workouts/exercise-catalog";
import {
  COACH_EXPERIENCE,
  COACH_GOALS,
  draftFromPreview,
  type CoachExperience,
  type CoachGoal,
  type CoachPreview,
} from "@/lib/workouts/coach-plan";
import {
  GYM_PROGRAMS,
  planProgramSave,
  programPreviewLines,
  uniqueDraftName,
  type RoutineDraft,
} from "@/lib/workouts/programs";

const GOAL_LABEL: Record<CoachGoal, string> = {
  strength: "Сила",
  muscle: "Объём",
  general: "Тонус",
};

const EXPERIENCE_LABEL: Record<CoachExperience, string> = {
  new: "Только начинаю",
  some: "Уже хожу",
  regular: "Регулярно",
};

type SaveResult = { saved: number; skipped: number; firstId: string | null };

type Props = {
  existingNames: string[];
  busy: boolean;
  onSaveDrafts: (drafts: RoutineDraft[]) => Promise<SaveResult>;
  onStart: (routineId: string) => void;
};

export function WorkoutProgramsPanel({ existingNames, busy, onSaveDrafts, onStart }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [goal, setGoal] = useState<CoachGoal>("general");
  const [minutes, setMinutes] = useState(45);
  const [experience, setExperience] = useState<CoachExperience>("some");
  const [equipment, setEquipment] = useState<EquipmentKey[]>(["barbell", "dumbbell"]);
  const [limitations, setLimitations] = useState("");
  const [preview, setPreview] = useState<CoachPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleEquipment = (key: EquipmentKey) => {
    setEquipment((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const saveDrafts = async (drafts: RoutineDraft[], start: boolean) => {
    if (saving || busy) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await onSaveDrafts(drafts);
      if (result.saved === 0 && result.skipped > 0) {
        setMessage("Такой шаблон уже есть — второй не создаю.");
      } else if (result.skipped > 0) {
        setMessage(`Сохранено ${result.saved}. Уже были: ${result.skipped}.`);
      } else if (result.saved > 0) {
        setMessage(result.saved === 1 ? "Шаблон сохранён." : `Сохранено шаблонов: ${result.saved}.`);
      }
      if (start && result.firstId) onStart(result.firstId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить шаблон");
    } finally {
      setSaving(false);
    }
  };

  const askCoach = async () => {
    setAsking(true);
    setMessage(null);
    try {
      const response = await fetch(withBasePath("/api/workouts/coach"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, minutes, experience, equipment, limitations }),
      });
      const data = (await response.json()) as { preview?: CoachPreview; error?: string };
      if (!response.ok || !data.preview) {
        setMessage(data.error ?? "Не удалось собрать тренировку");
        return;
      }
      setPreview(data.preview);
    } catch {
      setMessage("Сеть недоступна — попробуйте ещё раз");
    } finally {
      setAsking(false);
    }
  };

  return (
    <section className="gym-plane" aria-label="Готовые программы" data-tour="gym-programs">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Готовые программы</p>
      <p className="mt-1 text-sm text-[var(--muted-strong)]">
        Схема из справочника, без весов. В дневник попадёт только после «Сохранить» или «Начать».
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {GYM_PROGRAMS.map((program) => {
          const open = openId === program.id;
          const plan = planProgramSave(existingNames, program.id);
          return (
            <li key={program.id} className="rounded-xl border border-[var(--border-hairline)] px-3 py-2.5">
              <button
                type="button"
                className="min-h-11 w-full text-left"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : program.id)}
              >
                <p className="font-semibold text-[var(--foreground)]">{program.title}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {program.equipment} · {program.days.length} дн.
                </p>
                <p className="mt-1 text-sm text-[var(--muted-strong)]">{program.summary}</p>
              </button>
              {open ? (
                <div className="mt-2">
                  {program.days.map((day) => (
                    <div key={day.id} className="mt-2">
                      <p className="text-sm font-semibold">{day.name}</p>
                      <p className="text-xs text-[var(--muted)]">{day.note}</p>
                      <ul className="mt-1 space-y-0.5 text-sm tabular-nums text-[var(--muted-strong)]">
                        {programPreviewLines(day).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={busy || saving || !plan}
                    className="gym-primary mt-3"
                    onClick={() => {
                      const drafts = (plan ?? []).filter((step) => !step.skip).map((step) => step.draft);
                      if (drafts.length === 0) {
                        setMessage("Эти дни уже лежат в шаблонах.");
                        return;
                      }
                      void saveDrafts(drafts, false);
                    }}
                  >
                    Сохранить в мои шаблоны
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 border-t border-[var(--border-hairline)] pt-3" data-tour="gym-coach">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Собрать под себя</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Черновик с учётом цели, времени и свежести мышц. Еда не меняет веса. Это не медицинский совет.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {COACH_GOALS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={goal === item}
              className={`min-h-11 rounded-full px-3 text-xs font-semibold ${
                goal === item ? "bg-[var(--accent)] text-white" : "bg-[var(--accent-soft)] text-[var(--muted-strong)]"
              }`}
              onClick={() => setGoal(item)}
            >
              {GOAL_LABEL[item]}
            </button>
          ))}
        </div>
        <label className="mt-2 block text-xs font-medium text-[var(--muted-strong)]">
          Минут: {minutes}
          <input
            type="range"
            min={20}
            max={90}
            step={5}
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
            className="mt-1 block w-full"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {COACH_EXPERIENCE.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={experience === item}
              className={`min-h-11 rounded-full px-3 text-xs font-semibold ${
                experience === item
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--accent-soft)] text-[var(--muted-strong)]"
              }`}
              onClick={() => setExperience(item)}
            >
              {EXPERIENCE_LABEL[item]}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EQUIPMENT_KEYS.filter((key) => key !== "other").map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={equipment.includes(key)}
              className={`min-h-11 rounded-full px-3 text-xs font-semibold ${
                equipment.includes(key)
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface-mist)] text-[var(--muted-strong)]"
              }`}
              onClick={() => toggleEquipment(key)}
            >
              {EQUIPMENT_LABELS[key]}
            </button>
          ))}
        </div>
        <label className="mt-2 block text-xs font-medium text-[var(--muted-strong)]">
          Что не брать. Это не оценка здоровья.
          <textarea
            value={limitations}
            maxLength={240}
            rows={2}
            placeholder="Например: колено, поясница"
            onChange={(event) => setLimitations(event.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border-quiet)] px-2 py-1.5 text-sm"
          />
        </label>
        {equipment.length === 0 ? (
          <p className="mt-2 text-xs text-[var(--muted)]">Отметьте, что есть под рукой. Без выбора останется только свой вес.</p>
        ) : null}
        <button type="button" className="gym-primary mt-2" disabled={asking || busy || saving} onClick={() => void askCoach()}>
          {asking ? "Собираю…" : "Предложить тренировку"}
        </button>
        {preview ? (
          <div className="mt-3 rounded-xl bg-[var(--accent-soft)] px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--accent-ink)]">
              {preview.source === "ai" ? "Ответ ИИ" : "Запасной шаблон"}
            </p>
            <p className="mt-1 font-semibold">{preview.title}</p>
            <p className="mt-1 text-sm text-[var(--muted-strong)]">{preview.note}</p>
            {preview.caution ? <p className="mt-1 text-sm text-[var(--muted-strong)]">{preview.caution}</p> : null}
            <ul className="mt-2 space-y-0.5 text-sm tabular-nums">
              {preview.exercises.map((exercise) => (
                <li key={exercise.catalogId}>
                  {exercise.name} · {exercise.sets}×{exercise.reps}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-11 rounded-full bg-[var(--accent)] px-3 text-xs font-semibold text-white disabled:opacity-40"
                disabled={busy || saving}
                onClick={() => {
                  const draft = draftFromPreview(preview);
                  if (!draft) return;
                  void saveDrafts([{ ...draft, name: uniqueDraftName(draft.name, existingNames) }], false);
                }}
              >
                Сохранить шаблон
              </button>
              <button
                type="button"
                className="min-h-11 rounded-full bg-white px-3 text-xs font-semibold text-[var(--accent-ink)] disabled:opacity-40"
                disabled={busy || saving}
                onClick={() => {
                  const draft = draftFromPreview(preview);
                  if (!draft) return;
                  void saveDrafts([{ ...draft, name: uniqueDraftName(draft.name, existingNames) }], true);
                }}
              >
                Сохранить и начать
              </button>
            </div>
          </div>
        ) : null}
        {message ? (
          <p className="mt-2 text-sm text-[var(--muted-strong)]" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
