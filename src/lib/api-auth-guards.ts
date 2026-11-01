/**
 * Shared ownership checks for API routes — kept pure so auth/IDOR tests
 * do not need a live DB or NextAuth session.
 */

export function resourceOwnedByUser(
  row: { userId: string } | null | undefined,
  sessionUserId: string,
): boolean {
  if (!row) return false;
  return row.userId === sessionUserId;
}

/** @deprecated Prefer resourceOwnedByUser — same check for meals. */
export function mealOwnedByUser(
  meal: { userId: string } | null | undefined,
  sessionUserId: string,
): boolean {
  return resourceOwnedByUser(meal, sessionUserId);
}

/** Map ownership miss to the same 404 body routes return today. */
export function notFoundMealResponse(): { error: string; status: number } {
  return { error: "Запись не найдена", status: 404 };
}

/** Workouts / generic resources — same privacy posture as meals (404, not 403). */
export function notFoundResourceResponse(
  label = "Запись",
): { error: string; status: number } {
  return { error: `${label} не найдена`, status: 404 };
}

export function unauthorizedResponse(): { error: string; status: number } {
  return { error: "Войдите в аккаунт", status: 401 };
}
