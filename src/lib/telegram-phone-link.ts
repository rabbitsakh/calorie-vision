import { normalizeAuthPhone } from "@/lib/phone";

/**
 * Normalize a phone claim from Telegram OIDC (`phone_number`) to our +7… form.
 * Telegram may return digits without `+` or with a country code.
 */
export function normalizeTelegramPhone(raw: string | null | undefined): string | null {
  return normalizeAuthPhone(raw);
}
