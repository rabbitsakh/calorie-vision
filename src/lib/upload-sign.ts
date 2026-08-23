import { createHmac, timingSafeEqual } from "crypto";
import { withBasePath } from "@/lib/paths";

function signSecret(): string {
  return (
    process.env.UPLOAD_SIGN_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    "dev-upload-sign-secret"
  );
}

function hmac(payload: string): string {
  return createHmac("sha256", signSecret()).update(payload).digest("base64url");
}

/**
 * Short-lived signed photo URL (#2) — usable without session cookie
 * (e.g. email, share, or cross-context <img>).
 */
export function signUploadAccess(
  id: string,
  userId: string,
  ttlSeconds = 60 * 60,
): { url: string; exp: number; sig: string } {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${id}.${userId}.${exp}`;
  const sig = hmac(payload);
  const url = withBasePath(`/api/uploads/${id}?exp=${exp}&uid=${encodeURIComponent(userId)}&sig=${sig}`);
  return { url, exp, sig };
}

export function verifyUploadAccess(
  id: string,
  expRaw: string | null,
  uid: string | null,
  sig: string | null,
): boolean {
  if (!expRaw || !uid || !sig) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  if (!id || !uid) return false;

  const expected = hmac(`${id}.${uid}.${exp}`);
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
