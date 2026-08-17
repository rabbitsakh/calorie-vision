const EAN_LENGTHS = new Set([8, 12, 13]);

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
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
