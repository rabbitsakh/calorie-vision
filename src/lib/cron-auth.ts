import type { NextRequest } from "next/server";

/**
 * Cron routes must send `Authorization: Bearer $CRON_SECRET`.
 * Missing/empty CRON_SECRET → always deny (401).
 */
export function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
