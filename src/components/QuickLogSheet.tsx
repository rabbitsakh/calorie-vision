"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import type { AssistantActions } from "@/lib/admin-assistant";
import { assistantHandoffHref } from "@/lib/assistant-handoff";
import { emitMascotReaction } from "@/lib/mascot-reactions";
import { notifyFoodSaved } from "@/lib/open-food-camera";
import { withBasePath } from "@/lib/paths";
import {
  QUICK_SLOTS,
  SLOT_LABEL,
  applyQuickSlot,
  enrichQuickMealsFromText,
  quickDishTone,
  quickHeader,
  quickMacroLine,
  quickPortionStep,
  quickSaveLabel,
  quickTotals,
  rescaleQuickMeal,
  resolveQuickSlot,
  splitQuickPortion,
  type QuickMeal,
  type QuickSlot,
} from "@/lib/quick-log";

type Props = {
  text: string;
  date?: string;
  onClose: () => void;
};

type Phase =
  | { kind: "loading" }
  | { kind: "ready"; actions: AssistantActions; meals: QuickMeal[] }
  | { kind: "reply"; reply: string }
  | { kind: "error"; message: string }
  | { kind: "saved"; kcal: number };

/**
 * Hybrid H2 — one phrase in the composer → «проверь и запиши» right on «Сегодня».
 * The assistant parses the phrase; nothing is written until the big button.
 */
export function QuickLogSheet({ text, date, onClose }: Props) {
  const router = useRouter();
  const day = useOptionalRationDay();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [editing, setEditing] = useState<number | null>(null);
  const [slot, setSlot] = useState<QuickSlot>(() => defaultSlotGuess());
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/assistant"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: text }],
            date,
            mode: "food",
          }),
        });
        const data = (await resp.json().catch(() => null)) as {
          reply?: string;
          actions?: AssistantActions | null;
          error?: string;
        } | null;
        if (cancelled) return;
        if (!resp.ok) {
          setPhase({ kind: "error", message: data?.error || "Не получилось разобрать" });
          return;
        }
        const meals = data?.actions?.meals ?? [];
        if (data?.actions && meals.length) {
          const nextSlot = resolveQuickSlot(meals);
          const enriched = applyQuickSlot(enrichQuickMealsFromText(meals, text), nextSlot);
          setSlot(nextSlot);
          setPhase({ kind: "ready", actions: data.actions, meals: enriched });
          setEditing(0);
        } else {
          setPhase({ kind: "reply", reply: data?.reply?.trim() || "Не нашёл, что записать." });
        }
      } catch {
        if (!cancelled) setPhase({ kind: "error", message: "Нет связи — попробуйте ещё раз" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [text, date]);

  useEffect(() => {
    if (phase.kind !== "saved") return;
    const t = window.setTimeout(onClose, 1100);
    return () => window.clearTimeout(t);
  }, [phase.kind, onClose]);

  const meals = useMemo(
    () => (phase.kind === "ready" ? phase.meals : []),
    [phase],
  );
  const totals = useMemo(() => quickTotals(meals), [meals]);
  const target = day?.data?.meals?.target?.calories ?? null;
  const eaten = day?.data?.meals?.totalCalories ?? 0;
  const leftAfter = target ? Math.round(target - eaten - totals.kcal) : null;

  const setGrams = (index: number, grams: number) => {
    if (phase.kind !== "ready") return;
    const next = phase.meals.map((m, i) => (i === index ? rescaleQuickMeal(m, grams) : m));
    setPhase({ ...phase, meals: next });
  };

  const setMealSlot = (next: QuickSlot) => {
    setSlot(next);
    if (phase.kind !== "ready") return;
    setPhase({ ...phase, meals: applyQuickSlot(phase.meals, next) });
  };

  const save = async () => {
    if (phase.kind !== "ready" || saving) return;
    setSaving(true);
    try {
      const applyDate = phase.actions.targetDate || date;
      const resp = await fetch(withBasePath("/api/assistant/apply"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "meals",
          date: applyDate,
          actions: { ...phase.actions, meals: phase.meals, targetDate: applyDate },
        }),
      });
      const data = (await resp.json().catch(() => null)) as { error?: string } | null;
      if (!resp.ok) throw new Error(data?.error || "Не удалось записать");
      notifyFoodSaved();
      day?.bump();
      emitMascotReaction("save");
      setPhase({ kind: "saved", kcal: totals.kcal });
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message : "Не удалось записать" });
    } finally {
      setSaving(false);
    }
  };

  const sheet = (
    <div className="quick-sheet-dim" role="dialog" aria-modal="true" aria-label="Проверь и запиши">
      <button type="button" className="quick-sheet-backdrop" aria-label="Закрыть" onClick={onClose} />
      <div className="quick-sheet" data-testid="quick-log-sheet">
        <div className="quick-sheet-top">
          <button
            type="button"
            className="quick-sheet-grab"
            aria-label="Закрыть"
            onClick={onClose}
          />
          <button type="button" className="quick-sheet-close" aria-label="Закрыть" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="quick-sheet-bubble">{text}</p>

        {phase.kind === "loading" ? (
          <div className="quick-parse quick-parse--loading" aria-live="polite">
            <span className="quick-parse-dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            Разбираю блюда и граммы…
          </div>
        ) : null}

        {phase.kind === "ready" ? (
          <>
            <div className="quick-slots" role="radiogroup" aria-label="Приём пищи">
              {QUICK_SLOTS.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={slot === key}
                  className={`quick-slot${slot === key ? " quick-slot--on" : ""}`}
                  onClick={() => setMealSlot(key)}
                >
                  {SLOT_LABEL[key]}
                </button>
              ))}
            </div>
            <div className="quick-parse">
              <div className="quick-parse-head">
                <b>{quickHeader(meals.length)}</b>
              </div>
              {meals.map((meal, i) => {
                const portion = splitQuickPortion(meal.name);
                const tone = quickDishTone(i);
                const open = editing === i && portion.grams != null;
                return (
                  <div key={i} className="quick-dish-wrap">
                    <div className="quick-dish">
                      <span className="quick-dish-img" style={{ background: tone.bg, color: tone.fg }} aria-hidden>
                        {portion.base.charAt(0).toUpperCase()}
                      </span>
                      <span className="quick-dish-name">
                        <b>{portion.base}</b>
                        <span>{quickMacroLine(meal)}</span>
                      </span>
                      {portion.grams != null ? (
                        <button
                          type="button"
                          className={`quick-gram${open ? " quick-gram--on" : ""}`}
                          aria-expanded={open}
                          onClick={() => setEditing(open ? null : i)}
                        >
                          {portion.grams} {portion.unit}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="quick-kcal"
                        aria-label={`Ккал ${Math.round(meal.kcal ?? 0)} — изменить порцию`}
                        onClick={() => setEditing(open ? null : i)}
                      >
                        {Math.round(meal.kcal ?? 0)}
                      </button>
                    </div>
                    {open && portion.grams != null ? (
                      <div className="quick-stepper">
                        <button
                          type="button"
                          aria-label="Меньше"
                          onClick={() =>
                            setGrams(i, portion.grams! - quickPortionStep(portion.grams!, portion.unit))
                          }
                        >
                          −
                        </button>
                        <input
                          inputMode="numeric"
                          value={portion.grams}
                          aria-label={`Граммы: ${portion.base}`}
                          autoFocus={meals.length === 1}
                          onChange={(e) => {
                            const n = Number(e.target.value.replace(/\D/g, ""));
                            if (n > 0) setGrams(i, n);
                          }}
                        />
                        <span>{portion.unit}</span>
                        <button
                          type="button"
                          aria-label="Больше"
                          onClick={() =>
                            setGrams(i, portion.grams! + quickPortionStep(portion.grams!, portion.unit))
                          }
                        >
                          +
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <div className="quick-total">
                <b>{totals.kcal} ккал</b>
                <span>
                  Б {totals.protein} · Ж {totals.fat} · У {totals.carbs}
                </span>
              </div>
            </div>
            <p className="quick-note">
              <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" />
              </svg>
              Оценка AI. Нажми на граммы, чтобы поправить.
              {leftAfter != null ? ` Останется ${leftAfter.toLocaleString("ru-RU")} ккал.` : ""}
            </p>
            <button type="button" className="quick-save" disabled={saving} onClick={() => void save()}>
              {saving ? "Записываю…" : quickSaveLabel(meals, totals.kcal)}
            </button>
            <button type="button" className="quick-cancel" onClick={onClose}>
              Отмена
            </button>
          </>
        ) : null}

        {phase.kind === "reply" || phase.kind === "error" ? (
          <>
            <div className={`quick-parse quick-parse--reply${phase.kind === "error" ? " quick-parse--error" : ""}`}>
              {phase.kind === "reply" ? phase.reply : phase.message}
            </div>
            <button
              type="button"
              className="quick-save quick-save--ghost"
              onClick={() => {
                onClose();
                router.push(assistantHandoffHref(text, date));
              }}
            >
              Продолжить в чате
            </button>
            <button type="button" className="quick-cancel" onClick={onClose}>
              Закрыть
            </button>
          </>
        ) : null}

        {phase.kind === "loading" ? (
          <button type="button" className="quick-cancel" onClick={onClose}>
            Отмена
          </button>
        ) : null}

        {phase.kind === "saved" ? (
          <div className="quick-parse quick-parse--saved" role="status">
            <span className="quick-saved-check" aria-hidden>
              ✓
            </span>
            Записано · {phase.kcal} ккал
          </div>
        ) : null}
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(sheet, document.documentElement);
}

function defaultSlotGuess(): QuickSlot {
  return resolveQuickSlot([]);
}
