const RU_PHONE = /^\+7\d{10}$/;

export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("7")) {
    return `+${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("8")) {
    return `+7${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `+7${digits}`;
  }

  return null;
}

/**
 * Normalize an OAuth/Telegram phone claim to our +7… form.
 * Accepts `+7900…`, `7900…`, `8900…`, or 10-digit local numbers.
 */
export function normalizeAuthPhone(raw: string | null | undefined): string | null {
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

export function isValidPhone(phone: string): boolean {
  return RU_PHONE.test(phone);
}

export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) {
    return phone;
  }

  return `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
}
