/**
 * Safely read JSON from a fetch Response.
 * Safari throws "The string did not match the expected pattern." on empty
 * or non-JSON bodies (e.g. nginx 502/504 HTML) — never surface that raw text.
 */

export function messageForApiHttpStatus(status: number, bodyText = ""): string {
  if (status === 401) {
    return "Войдите в аккаунт";
  }
  if (status === 413) {
    return "Фото слишком большое. Выберите снимок поменьше.";
  }
  if (status === 429) {
    return "Слишком много запросов. Подождите около минуты и попробуйте снова.";
  }
  if (status === 502 || status === 503 || status === 504) {
    return "Сервер не успел обработать запрос. Попробуйте ещё раз через минуту.";
  }
  if (status >= 500) {
    return "Сервер временно недоступен. Попробуйте ещё раз.";
  }
  if (/<!DOCTYPE|<html/i.test(bodyText)) {
    return "Не удалось получить ответ сервера. Обновите страницу и попробуйте снова.";
  }
  return "Не удалось обработать ответ сервера. Попробуйте ещё раз.";
}

export function isNetworkFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.trim();
  if (
    /^load failed$/i.test(message) ||
    /failed to fetch/i.test(message) ||
    /networkerror/i.test(message) ||
    /network request failed/i.test(message) ||
    /internet connection appears to be offline/i.test(message)
  ) {
    return true;
  }

  return false;
}

export function humanizeClientFetchError(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message.trim()) {
    return fallback;
  }

  const message = error.message.trim();
  if (
    /did not match the expected pattern/i.test(message) ||
    /unexpected token/i.test(message) ||
    /is not valid JSON/i.test(message) ||
    error.name === "SyntaxError"
  ) {
    return "Не удалось получить ответ сервера. Попробуйте ещё раз.";
  }

  // Safari/WebKit: "Load failed"; Chromium: "Failed to fetch"; Firefox: "NetworkError…"
  if (error.name === "AbortError") {
    return fallback;
  }

  if (isNetworkFetchError(error)) {
    return "Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.";
  }

  return message;
}

export async function readApiJson<T extends Record<string, unknown>>(
  response: Response,
): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(messageForApiHttpStatus(response.status));
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(messageForApiHttpStatus(response.status, text));
  }
}
