import { digitsOnly, normalizeBarcode } from "@/lib/barcode";
import { isNetworkFetchError } from "@/lib/read-api-json";

export type BarcodeLookupFailureKind =
  | "invalid_format"
  | "not_found"
  | "rate_limit"
  | "network"
  | "server"
  | "unknown";

export type BarcodeLookupFailure = {
  kind: BarcodeLookupFailureKind;
  barcode: string;
  message: string;
  hint: string | null;
};

export function validateBarcodeClient(
  raw: string,
): { ok: true; barcode: string } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: "Введите штрихкод" };
  }

  const barcode = normalizeBarcode(trimmed);
  if (!barcode) {
    const digits = digitsOnly(trimmed);
    if (digits.length > 0 && digits.length < 8) {
      return { ok: false, message: "Слишком короткий код — нужно 8, 12 или 13 цифр" };
    }
    return { ok: false, message: "Укажите корректный штрихкод (8, 12 или 13 цифр)" };
  }

  return { ok: true, barcode };
}

export function classifyBarcodeLookupFailure(
  status: number,
  error?: string,
  fetchError?: unknown,
): BarcodeLookupFailureKind {
  if (fetchError && isNetworkFetchError(fetchError)) {
    return "network";
  }
  if (/не найден|open food facts|gigachat/i.test(error ?? "")) {
    return "not_found";
  }
  if (status === 400 && /штрихкод/i.test(error ?? "")) {
    return "invalid_format";
  }
  if (status === 429) {
    return "rate_limit";
  }
  if (status >= 500) {
    return "server";
  }
  return "unknown";
}

export function barcodeFailureMessage(kind: BarcodeLookupFailureKind, barcode?: string): string {
  switch (kind) {
    case "invalid_format":
      return "Некорректный штрихкод — проверьте все цифры";
    case "not_found":
      return barcode ? `По коду ${barcode} продукт не найден` : "Продукт не найден по штрихкоду";
    case "rate_limit":
      return "Слишком много запросов — подождите минуту";
    case "network":
      return "Не удалось связаться с сервером";
    case "server":
      return "Сервер временно недоступен";
    default:
      return "Не удалось найти продукт";
  }
}

export function barcodeFailureHint(kind: BarcodeLookupFailureKind): string | null {
  switch (kind) {
    case "not_found":
      return "Введите название вручную или сфотографируйте этикетку с КБЖУ";
    case "invalid_format":
      return "EAN-8, EAN-12 или EAN-13 — только цифры";
    case "network":
      return "Проверьте интернет и нажмите «Повторить»";
    case "rate_limit":
      return "Подождите около минуты и попробуйте снова";
    default:
      return null;
  }
}

export function buildBarcodeLookupFailure(
  kind: BarcodeLookupFailureKind,
  barcode: string,
): BarcodeLookupFailure {
  return {
    kind,
    barcode,
    message: barcodeFailureMessage(kind, barcode),
    hint: barcodeFailureHint(kind),
  };
}
