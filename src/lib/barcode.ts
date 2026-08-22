const EAN_LENGTHS = new Set([8, 12, 13]);

/** Common OCR misreads in EAN digits (photo / screen glare). */
const OCR_CONFUSABLE: Record<string, readonly string[]> = {
  "0": ["8", "6"],
  "1": ["7"],
  "2": ["7"],
  "3": ["8"],
  "5": ["6", "8"],
  "6": ["8", "5"],
  "7": ["1"],
  "8": ["0", "6", "3"],
};

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function computeEanCheckDigit(bodyWithoutCheck: string): number {
  const sum = [...bodyWithoutCheck].reduce((total, char, index) => {
    const digit = Number(char);
    const fromRight = bodyWithoutCheck.length - index;
    const weight = fromRight % 2 === 1 ? 3 : 1;
    return total + digit * weight;
  }, 0);

  return (10 - (sum % 10)) % 10;
}

export function hasValidEanChecksum(digits: string): boolean {
  if (digits.length === 12) {
    return hasValidEanChecksum(`0${digits}`);
  }
  if (digits.length !== 8 && digits.length !== 13) {
    return false;
  }

  const body = digits.slice(0, -1);
  const check = Number(digits.slice(-1));
  if (!Number.isInteger(check)) {
    return false;
  }

  const sum = [...body].reduce((total, char, index) => {
    const digit = Number(char);
    const fromRight = body.length - index;
    const weight = fromRight % 2 === 1 ? 3 : 1;
    return total + digit * weight;
  }, 0);

  return (10 - (sum % 10)) % 10 === check;
}

export function normalizeBarcode(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const digits = digitsOnly(value);
  if (!EAN_LENGTHS.has(digits.length) || /^0+$/.test(digits)) {
    return null;
  }

  const ean13 = digits.length === 12 ? `0${digits}` : digits;
  if (!hasValidEanChecksum(ean13) && digits.length !== 8) {
    // Keep plausible codes even if the checksum failed: photos are often slightly misread.
    if (digits.length < 8) {
      return null;
    }
  }

  return digits;
}

/**
 * Candidate barcodes when OCR misread one digit or the check digit.
 * Only returns codes with a valid EAN checksum (for OFF lookup).
 */
export function repairBarcodeCandidates(value: string, maxCandidates = 24): string[] {
  const digits = digitsOnly(value);
  if (!EAN_LENGTHS.has(digits.length)) {
    return [];
  }

  const original = normalizeBarcode(digits);
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (candidate: string) => {
    if (out.length >= maxCandidates) {
      return;
    }
    const normalized = normalizeBarcode(candidate);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    const ean13 = normalized.length === 12 ? `0${normalized}` : normalized;
    if (!hasValidEanChecksum(ean13)) {
      return;
    }
    seen.add(normalized);
    out.push(normalized);
  };

  if (digits.length === 13 || digits.length === 8) {
    const body = digits.slice(0, -1);
    push(`${body}${computeEanCheckDigit(body)}`);
  } else if (digits.length === 12) {
    const body = digits.slice(0, 11);
    push(`${body}${computeEanCheckDigit(body)}`);
  }

  for (let i = 0; i < digits.length && out.length < maxCandidates; i++) {
    const char = digits[i]!;
    for (const alt of OCR_CONFUSABLE[char] ?? []) {
      push(`${digits.slice(0, i)}${alt}${digits.slice(i + 1)}`);
    }
  }

  return out.filter((candidate) => candidate !== original);
}

/** First raw decoder value that looks like EAN/UPC. */
export function pickDecodedBarcode(rawValues: Array<string | null | undefined>): string | null {
  for (const raw of rawValues) {
    const normalized = normalizeBarcode(raw);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}
