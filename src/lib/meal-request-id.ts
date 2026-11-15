/** Ключ идемпотентности записи дневника. Старые клиенты поле не шлют. */

const CLIENT_REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export function normalizeClientRequestId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  if (!CLIENT_REQUEST_ID_RE.test(id)) return null;
  return id;
}

export function newClientRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cv${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function withClientRequestId<T extends { clientRequestId?: string | null }>(row: T): T {
  const existing = normalizeClientRequestId(row.clientRequestId);
  if (existing) {
    return row.clientRequestId === existing ? row : { ...row, clientRequestId: existing };
  }
  return { ...row, clientRequestId: newClientRequestId() };
}

export function withClientRequestIdsOnBody<T extends { clientRequestId?: string | null }>(
  body: T | { entries: T[] },
): T | { entries: T[] } {
  if (body && typeof body === "object" && "entries" in body && Array.isArray(body.entries)) {
    return { ...body, entries: body.entries.map((row) => withClientRequestId(row)) };
  }
  return withClientRequestId(body as T);
}

const attemptIds = new Map<string, string>();

/** Один ключ на попытку записи, пока она не подтверждена. Повтор кнопки его не меняет. */
export function clientRequestIdForAttempt(scope: string): string {
  const existing = attemptIds.get(scope);
  if (existing) return existing;
  const id = newClientRequestId();
  attemptIds.set(scope, id);
  return id;
}

export function finishClientRequestAttempt(scope: string): void {
  attemptIds.delete(scope);
}

export function clientRequestIdsOf(body: { clientRequestId?: string | null; entries?: Array<{ clientRequestId?: string | null }> }): string[] {
  const rows = Array.isArray(body.entries) ? body.entries : [body];
  const ids: string[] = [];
  for (const row of rows) {
    const id = normalizeClientRequestId(row?.clientRequestId);
    if (id) ids.push(id);
  }
  return ids;
}
