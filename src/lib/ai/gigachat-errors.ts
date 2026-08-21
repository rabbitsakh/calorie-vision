/**
 * Map raw GigaChat / provider HTTP failures to user-facing Russian copy.
 */

export class GigaChatApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GigaChatApiError";
    this.status = status;
  }
}

export function isGigaChatApiError(error: unknown): error is GigaChatApiError {
  return error instanceof GigaChatApiError;
}

export function formatGigaChatHttpError(status: number, body: string): string {
  const parsed = extractProviderMessage(body);

  if (status === 429 || /too many requests/i.test(parsed) || /rate limit/i.test(parsed)) {
    return "Слишком много запросов к распознаванию. Подождите около минуты и попробуйте снова.";
  }

  if (status === 401 || status === 403) {
    return "Нет доступа к сервису распознавания. Проверьте ключ GigaChat на сервере.";
  }

  if (status === 413) {
    return "Фото слишком большое для распознавания. Выберите снимок поменьше.";
  }

  if (status >= 500) {
    return "Сервис распознавания временно недоступен. Попробуйте чуть позже.";
  }

  if (parsed && !/^gigachat error:/i.test(parsed) && !/^upload error:/i.test(parsed)) {
    if (/too many requests/i.test(parsed)) {
      return "Слишком много запросов к распознаванию. Подождите около минуты и попробуйте снова.";
    }
    return parsed;
  }

  return `Не удалось обратиться к распознаванию (код ${status}).`;
}

function extractProviderMessage(body: string): string {
  try {
    const data = JSON.parse(body) as {
      message?: string;
      error?: string | { message?: string };
    };
    if (typeof data.message === "string" && data.message.trim()) {
      return data.message.trim();
    }
    if (typeof data.error === "string" && data.error.trim()) {
      return data.error.trim();
    }
    if (data.error && typeof data.error === "object" && data.error.message?.trim()) {
      return data.error.message.trim();
    }
  } catch {
    if (body.trim()) {
      return body.trim().slice(0, 200);
    }
  }
  return "";
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
