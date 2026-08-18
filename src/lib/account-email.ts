export function normalizeAccountEmail(email: string | null | undefined): string | null {
  if (typeof email !== "string") {
    return null;
  }

  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
}

/** When Google/VK owns the email, ignore the same value and reject only a real change. */
export function lockedEmailDecision(
  emailLocked: boolean,
  incoming: string | null | undefined,
  current: string | null | undefined,
): { action: "skip" } | { action: "update"; email: string | null } | { action: "reject" } {
  if (incoming === undefined) {
    return { action: "skip" };
  }

  const next = normalizeAccountEmail(incoming);
  if (emailLocked) {
    return next === normalizeAccountEmail(current) ? { action: "skip" } : { action: "reject" };
  }

  return { action: "update", email: next };
}
