/**
 * Shared ownership checks for API routes — kept pure so auth/IDOR tests
 * do not need a live DB or NextAuth session.
 */

export function mealOwnedByUser(
  meal: { userId: string } | null | undefined,
  sessionUserId: string,
): boolean {
  if (!meal) return false;
  return meal.userId === sessionUserId;
}

/** Map ownership miss to the same 404 body routes return today. */
export function notFoundMealResponse(): { error: string; status: number } {
  return { error: "Запись не найдена", status: 404 };
}

export function unauthorizedResponse(): { error: string; status: number } {
  return { error: "Войдите в аккаунт", status: 401 };
}
