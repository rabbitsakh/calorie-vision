/**
 * Wave A4 — one contextual next step for the assistant (morning / evening).
 * Deterministic from snapshot; no LLM.
 */

import type { AssistantContextSnapshot } from "@/lib/admin-assistant";
import { dayPartFromHour } from "@/lib/splash-tips";

export type AssistantDayVoice = {
  label: string;
  actionLabel: string;
  /** Prefill composer and optionally auto-send later. */
  draft?: string;
  /** In-app path (deep link). */
  href?: string;
  /** Open photo picker in chat. */
  openPhoto?: boolean;
};

export type AssistantDayVoiceInput = {
  hour: number;
  isToday: boolean;
  snapshot: AssistantContextSnapshot | null;
};

/**
 * Single soft prompt for the assistant header. Null = stay quiet.
 */
export function buildAssistantDayVoice(
  input: AssistantDayVoiceInput,
): AssistantDayVoice | null {
  if (!input.isToday || !input.snapshot) return null;
  const part = dayPartFromHour(input.hour);
  const s = input.snapshot;
  const emptyDay = s.calories <= 0;
  const waterLow =
    s.waterTargetMl > 0 && s.waterMl < s.waterTargetMl * 0.35;
  const caloriesLeft =
    s.remainingCalories != null && s.targetCalories != null
      ? s.remainingCalories
      : null;

  if (part === "morning") {
    if (emptyDay) {
      return {
        label: "Утро без записей — первый приём или фото",
        actionLabel: "Фото",
        openPhoto: true,
      };
    }
    if (waterLow) {
      return {
        label: "Воды маловато с утра",
        actionLabel: "Вода",
        href: "/ration",
        draft: "Добавь 250 мл воды",
      };
    }
    return null;
  }

  if (part === "evening") {
    if (emptyDay) {
      return {
        label: "День почти пустой — быстрый лог еды",
        actionLabel: "Текст",
        draft: "Запиши ужин: ",
      };
    }
    if (waterLow) {
      return {
        label: "До вечера воды мало",
        actionLabel: "Вода",
        draft: "Добавь 300 мл воды",
      };
    }
    if (caloriesLeft != null && caloriesLeft > 400) {
      return {
        label: `Ещё ~${Math.round(caloriesLeft)} ккал до цели`,
        actionLabel: "Подскажи",
        draft: "Что съесть на ужин в рамках остатка калорий?",
      };
    }
    return null;
  }

  // Afternoon: only if clearly empty or water critically low.
  if (emptyDay && input.hour >= 12) {
    return {
      label: "Пока нет приёмов — можно быстро дописать",
      actionLabel: "Фото",
      openPhoto: true,
    };
  }
  if (waterLow && input.hour >= 14) {
    return {
      label: "Воды пока мало",
      actionLabel: "Вода",
      draft: "Добавь 250 мл воды",
    };
  }

  return null;
}
