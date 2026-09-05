import { isValidPhone, normalizePhone } from "@/lib/phone";

/**
 * Normalize a phone claim from Telegram OIDC (`phone_number`) to our +7… form.
 * Telegram may return digits without `+` or with a country code.
 */
export function normalizeTelegramPhone(raw: string | null | undefined): string | null {
  if (!raw?.trim()) {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    const normalized = normalizePhone(trimmed);
    if (normalized && isValidPhone(normalized)) {
      return normalized;
    }
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 10) {
    const normalized = normalizePhone(digits);
    if (normalized && isValidPhone(normalized)) {
      return normalized;
    }
  }

  return null;
}
