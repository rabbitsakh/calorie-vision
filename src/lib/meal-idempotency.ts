import { normalizeClientRequestId } from "@/lib/meal-request-id";

export function isPrismaUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Повтор с тем же clientRequestId возвращает уже созданную строку.
 * Без ключа каждый вызов создаёт новую запись (старые клиенты).
 */
export async function saveMealOnce<T>(opts: {
  clientRequestId: unknown;
  findExisting: (clientRequestId: string) => Promise<T | null>;
  create: () => Promise<T>;
}): Promise<{ row: T; created: boolean }> {
  const clientRequestId = normalizeClientRequestId(opts.clientRequestId);
  if (clientRequestId) {
    const existing = await opts.findExisting(clientRequestId);
    if (existing) return { row: existing, created: false };
  }
  try {
    const row = await opts.create();
    return { row, created: true };
  } catch (error) {
    if (clientRequestId && isPrismaUniqueConflict(error)) {
      const existing = await opts.findExisting(clientRequestId);
      if (existing) return { row: existing, created: false };
    }
    throw error;
  }
}
