/**
 * Порядок подходов внутри одного упражнения.
 * Номера на экране — это позиция в этом списке, не отдельное поле.
 */

export type SetMoveDirection = "up" | "down";

export function moveSetWithinExercise<T extends { id: string }>(
  sets: readonly T[],
  setId: string,
  direction: SetMoveDirection,
): { sets: T[]; moved: boolean; restRestarted: false } {
  const idx = sets.findIndex((set) => set.id === setId);
  if (idx < 0) return { sets: [...sets], moved: false, restRestarted: false };
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= sets.length) {
    return { sets: [...sets], moved: false, restRestarted: false };
  }
  const next = [...sets];
  const current = next[idx]!;
  next[idx] = next[target]!;
  next[target] = current;
  return { sets: next, moved: true, restRestarted: false };
}

export function assignSortOrders<T extends { id: string }>(
  sets: readonly T[],
): Array<T & { sortOrder: number }> {
  return sets.map((set, sortOrder) => ({ ...set, sortOrder }));
}

/** Куда вернуть удалённый подход, если список уже изменился. */
export function clampSetIndex(length: number, index: number): number {
  if (!Number.isFinite(index)) return Math.max(0, length);
  const i = Math.floor(index);
  if (i < 0) return 0;
  if (i > length) return length;
  return i;
}

export function removeSetById<T extends { id: string }>(
  sets: readonly T[],
  setId: string,
): { sets: T[]; index: number; set: T } | null {
  const index = sets.findIndex((set) => set.id === setId);
  if (index < 0) return null;
  return {
    sets: sets.filter((set) => set.id !== setId),
    index,
    set: sets[index]!,
  };
}

export function restoreDeletedSet<T>(
  sets: readonly T[],
  removed: { index: number; set: T },
): T[] {
  const index = clampSetIndex(sets.length, removed.index);
  const next = [...sets];
  next.splice(index, 0, removed.set);
  return next;
}
