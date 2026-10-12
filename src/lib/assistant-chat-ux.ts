/**
 * Client helpers for assistant chat reliability UX (Wave A).
 */

export type UndoPayload = {
  mealIds: string[];
  routineIds: string[];
  waterIds: string[];
  weightIds: string[];
};

export const UNDO_STACK_MAX = 8;

export function emptyUndo(): UndoPayload {
  return { mealIds: [], routineIds: [], waterIds: [], weightIds: [] };
}

export function undoHasItems(u: UndoPayload | null | undefined): boolean {
  if (!u) return false;
  return u.mealIds.length + u.routineIds.length + u.waterIds.length + u.weightIds.length > 0;
}

/** Push a successful write onto the undo stack (newest last). */
export function pushUndoStack(
  stack: UndoPayload[],
  next: UndoPayload | null | undefined,
  max = UNDO_STACK_MAX,
): UndoPayload[] {
  if (!next || !undoHasItems(next)) return stack;
  return [...stack, next].slice(-max);
}

/** Pop the newest undo payload. */
export function popUndoStack(stack: UndoPayload[]): {
  stack: UndoPayload[];
  popped: UndoPayload | null;
} {
  if (stack.length === 0) return { stack, popped: null };
  const popped = stack[stack.length - 1]!;
  return { stack: stack.slice(0, -1), popped };
}

/** Show retry when server reported no successful write on a write intent. */
export function shouldOfferWriteRetry(opts: {
  wrote?: boolean | null;
  wantsWrite: boolean;
}): boolean {
  return opts.wantsWrite && opts.wrote === false;
}

export const ASSISTANT_MODE_PILLS: Array<{ id: "all" | "food" | "gym" | "week"; label: string }> = [
  { id: "all", label: "Всё" },
  { id: "food", label: "Еда" },
  { id: "gym", label: "Зал" },
  { id: "week", label: "Неделя" },
];

export const ASSISTANT_ONBOARD_KEY = "cv-assistant-onboarded";

export const ASSISTANT_ONBOARD_STARTERS = [
  { label: "Рацион на сегодня", text: "Запиши обед: курица с рисом ~500 ккал" },
  { label: "План зала", text: "Составь план на завтра и добавь в план" },
  { label: "Неделя", text: "Составь неделю: рацион + 3 тренировки" },
  { label: "Фото", text: "Кинь фото еды — распознаю и покажу перед записью" },
];
