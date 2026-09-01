import { randomUUID } from "crypto";
import https from "https";
import { URL } from "url";
import type { FoodRecognitionResult } from "../food-types";
import {
  buildBarcodeLookupPrompt,
  buildFiberSugarLookupPrompt,
  buildFiberSugarBatchLookupPrompt,
  buildFoodLookupPrompt,
} from "@/lib/ai/prompt";
import {
  buildVisionPrompt,
  resolvePromptVariant,
  type VisionPromptHints,
} from "@/lib/ai/prompt-variants";
import { parseFoodRecognitionResponse } from "@/lib/ai/parse-response";
import { buildRecognitionRetryPrompt } from "@/lib/ai/recognition-retry-prompt";
import {
  getRecognitionRetryReason,
  isBetterRecognitionResult,
  shouldRetryFoodRecognition,
  type RecognitionRetryReason,
} from "@/lib/ai/recognition-retry";
import { prepareImageForLabelVision, prepareImageForVision } from "@/lib/ai/image-utils";
import { formatGigaChatHttpError, GigaChatApiError, sleep } from "@/lib/ai/gigachat-errors";
import { logRecognitionPass } from "@/lib/ai/recognition-telemetry";
import {
  buildBarcodeVisionPrompt,
  buildDrinkVisionPrompt,
  buildLabelVisionPrompt,
  buildPackageVisionPrompt,
  buildPlateVisionPrompt,
  buildStickerVisionPrompt,
} from "@/lib/ai/category-prompts";
import { sanitizeVisionBarcode } from "@/lib/ai/barcode-vision";
import { isBetterPlateResult, shouldForcePlateBeforeRetry } from "@/lib/ai/plate-vision";
import { isBetterLabelResult } from "@/lib/ai/label-vision";
import { isBetterPackageResult, shouldRunPackagePass } from "@/lib/ai/package-vision";
import { isBetterStickerResult } from "@/lib/ai/sticker-vision";
import { isBetterDrinkResult } from "@/lib/ai/drink-vision";
import { pickSpecialistPass, type SpecialistPass } from "@/lib/ai/specialist-pass";
import {
  getCachedFileId,
  imageUploadCacheKey,
  rememberCachedFileId,
} from "@/lib/ai/gigachat-file-cache";
import { normalizeBarcode } from "@/lib/barcode";
import { repairPackagedMislabel } from "@/lib/package-name-guard";

const OAUTH_URL =
  process.env.GIGACHAT_OAUTH_URL ??
  "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
const API_BASE =
  process.env.GIGACHAT_API_BASE ?? "https://api.giga.chat/v1";

type TokenCache = {
  token: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

type HttpResult = {
  status: number;
  body: string;
};

const GIGACHAT_HTTP_TIMEOUT_MS = 25_000;

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  rejectUnauthorized: false,
});

function httpsRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: Buffer | string;
  },
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: options.method ?? "GET",
        headers: options.headers,
        rejectUnauthorized: false,
        timeout: GIGACHAT_HTTP_TIMEOUT_MS,
        agent: httpsAgent,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 500,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );

    req.on("timeout", () => {
      req.destroy();
      reject(
        new GigaChatApiError(
          "Сервис распознавания не ответил вовремя. Попробуйте ещё раз.",
          504,
        ),
      );
    });
    req.on("error", reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

function getAuthorizationKey(): string {
  const rawCredentials = process.env.GIGACHAT_CREDENTIALS?.trim();
  if (rawCredentials) {
    return rawCredentials.replace(/^Basic\s+/i, "");
  }

  const clientId = process.env.GIGACHAT_CLIENT_ID?.trim();
  const clientSecret = process.env.GIGACHAT_CLIENT_SECRET?.trim();

  if (clientId && clientSecret) {
    return Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
  }

  throw new Error(
    "Задайте GIGACHAT_CREDENTIALS или пару GIGACHAT_CLIENT_ID + GIGACHAT_CLIENT_SECRET в .env",
  );
}

function buildMultipartBody(
  boundary: string,
  fileBuffer: Buffer,
  mimeType: string,
  filename: string,
): Buffer {
  return Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\ngeneral\r\n`),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
    ),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

function parseOAuthError(status: number, body: string): string {
  try {
    const data = JSON.parse(body) as {
      error?: string;
      error_description?: string;
      message?: string;
    };

    const details = data.error_description ?? data.message ?? data.error;
    if (details) {
      return details;
    }
  } catch {
    if (body.trim()) {
      return body.trim().slice(0, 200);
    }
  }

  if (status === 401) {
    return "Неверный ключ авторизации. Перевыпустите ключ на developers.sber.ru";
  }

  return `OAuth error: ${status}`;
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const scope = process.env.GIGACHAT_SCOPE?.trim() ?? "GIGACHAT_API_PERS";
  const authKey = getAuthorizationKey();
  const body = new URLSearchParams({ scope }).toString();

  const response = await httpsRequest(OAUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      RqUID: randomUUID(),
      Authorization: `Basic ${authKey}`,
      "Content-Length": String(Buffer.byteLength(body)),
    },
    body,
  });

  let data: {
    access_token?: string;
    expires_at?: number;
  } = {};

  try {
    data = JSON.parse(response.body) as typeof data;
  } catch {
    throw new Error(parseOAuthError(response.status, response.body));
  }

  if (response.status < 200 || response.status >= 300 || !data.access_token) {
    throw new Error(parseOAuthError(response.status, response.body));
  }

  const expiresAt =
    typeof data.expires_at === "number"
      ? data.expires_at > 1_000_000_000_000
        ? data.expires_at
        : data.expires_at * 1000
      : Date.now() + 30 * 60 * 1000;

  tokenCache = {
    token: data.access_token,
    expiresAt,
  };

  return data.access_token;
}

function parseJsonBody<T>(status: number, body: string): T {
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new GigaChatApiError(formatGigaChatHttpError(status, body), status || 502);
  }
}

async function uploadImage(
  token: string,
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  const cacheKey = imageUploadCacheKey(buffer);
  const cached = getCachedFileId(cacheKey);
  if (cached) {
    return cached;
  }

  const fileId = await withRateLimitRetry(async () => {
    const safeName =
      filename.endsWith(".jpg") || filename.endsWith(".jpeg") ? filename : "food.jpg";
    const boundary = `----CalorieVision${randomUUID().replace(/-/g, "")}`;
    const body = buildMultipartBody(boundary, buffer, mimeType, safeName);

    const response = await httpsRequest(`${API_BASE}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body,
    });

    const data = parseJsonBody<{ id?: string; message?: string }>(
      response.status,
      response.body,
    );

    if (response.status < 200 || response.status >= 300 || !data.id) {
      throw new GigaChatApiError(
        formatGigaChatHttpError(response.status, response.body),
        response.status,
      );
    }

    return data.id;
  });

  rememberCachedFileId(cacheKey, fileId);
  return fileId;
}

async function withRateLimitRetry<T>(run: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof GigaChatApiError &&
        (error.status === 429 || error.status >= 500);

      if (!retryable || attempt === attempts - 1) {
        throw error;
      }

      // 1.2s, 2.4s — gentle backoff under GigaChat rate limits
      await sleep(1200 * (attempt + 1));
    }
  }

  throw lastError;
}

export async function completeChat(
  messages: Array<{ role: string; content: string; attachments?: string[] }>,
  temperature = 0.35,
  options?: { retries?: number },
): Promise<string> {
  const attempts = Math.max(1, options?.retries ?? 3);
  return withRateLimitRetry(async () => {
    const token = await getAccessToken();
    const model = process.env.GIGACHAT_MODEL ?? "GigaChat-2-Max";

    const payload = JSON.stringify({
      model,
      temperature,
      messages,
    });

    const response = await httpsRequest(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(payload)),
      },
      body: payload,
    });

    const data = parseJsonBody<{
      choices?: Array<{ message?: { content?: string } }>;
      message?: string;
      error?: { message?: string };
    }>(response.status, response.body);

    if (response.status < 200 || response.status >= 300) {
      throw new GigaChatApiError(
        formatGigaChatHttpError(response.status, response.body),
        response.status,
      );
    }

    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("GigaChat не вернул текст ответа");
    }

    return text;
  }, attempts);
}

export async function lookupFoodWithGigaChat(dishName: string): Promise<FoodRecognitionResult> {
  const text = await completeChat([
    {
      role: "user",
      content: buildFoodLookupPrompt(dishName.trim()),
    },
  ]);

  return parseFoodRecognitionResponse(text);
}

/** OFF miss for a scanned EAN — web evidence + GigaChat keyed on the barcode digits. */
export async function lookupFoodByBarcodeWithGigaChat(
  barcode: string,
  webContext?: string,
): Promise<FoodRecognitionResult> {
  const code = barcode.trim();
  const text = await completeChat(
    [
      {
        role: "user",
        content: buildBarcodeLookupPrompt(code, webContext),
      },
    ],
    0.2,
    { retries: 2 },
  );

  const parsed = parseFoodRecognitionResponse(text);
  const confidence = Math.min(Math.max(parsed.confidence || 0.55, 0.45), 0.7);
  return {
    ...parsed,
    barcode: code,
    photoKind: "barcode",
    source: "gigachat-barcode",
    confidence,
  };
}

export async function lookupFiberSugarWithGigaChat(
  dishName: string,
  portionGrams?: number,
): Promise<{ fiber?: number; sugar?: number }> {
  const text = await completeChat(
    [
      {
        role: "user",
        content: buildFiberSugarLookupPrompt(dishName.trim(), portionGrams),
      },
    ],
    0.2,
    { retries: 1 },
  );

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return {};
  }

  try {
    const data = JSON.parse(match[0]) as { fiber?: unknown; sugar?: unknown };
    const toNum = (value: unknown): number | undefined => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim()) {
        const n = Number(value.replace(",", "."));
        return Number.isFinite(n) ? n : undefined;
      }
      return undefined;
    };
    return { fiber: toNum(data.fiber), sugar: toNum(data.sugar) };
  } catch {
    return {};
  }
}

function parseFiberSugarNumbers(data: { fiber?: unknown; sugar?: unknown }): {
  fiber?: number;
  sugar?: number;
} {
  const toNum = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const n = Number(value.replace(",", "."));
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  };
  return { fiber: toNum(data.fiber), sugar: toNum(data.sugar) };
}

export async function lookupFiberSugarBatchWithGigaChat(
  items: Array<{ dishName: string; portionGrams?: number }>,
): Promise<Array<{ dishName: string; fiber?: number; sugar?: number }>> {
  if (items.length === 0) {
    return [];
  }
  if (items.length === 1) {
    const single = items[0]!;
    const partial = await lookupFiberSugarWithGigaChat(single.dishName, single.portionGrams);
    return [{ dishName: single.dishName, ...partial }];
  }

  const text = await completeChat(
    [
      {
        role: "user",
        content: buildFiberSugarBatchLookupPrompt(items),
      },
    ],
    0.2,
    { retries: 1 },
  );

  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    return [];
  }

  try {
    const parsed = JSON.parse(arrayMatch[0]) as Array<{
      dishName?: unknown;
      fiber?: unknown;
      sugar?: unknown;
    }>;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((entry) => typeof entry.dishName === "string" && entry.dishName.trim())
      .map((entry) => ({
        dishName: String(entry.dishName).trim(),
        ...parseFiberSugarNumbers(entry),
      }));
  } catch {
    return [];
  }
}

export async function recognizeWithGigaChat(
  imageBuffer: Buffer,
  filename: string,
  options?: { hints?: VisionPromptHints },
): Promise<FoodRecognitionResult> {
  const startedAtMs = Date.now();
  const prepared = await prepareImageForVision(imageBuffer);
  const token = await getAccessToken();
  const fileId = await uploadImage(token, prepared.buffer, prepared.mimeType, filename);

  // Budget: main + retry + specialist + optional post-specialist retry.
  const MAX_CHAT_CALLS = 4;
  let chatCalls = 0;
  let specialistPass: SpecialistPass | null = null;
  const promptVariant = resolvePromptVariant();

  const telemetryBase = () => ({
    chatCalls,
    latencyMs: Date.now() - startedAtMs,
    specialistPass,
    promptVariant,
  });

  const ask = async (mode: "full" | "retry" = "full", retryReason: RecognitionRetryReason | null = null) => {
    chatCalls += 1;
    const content =
      mode === "retry"
        ? buildRecognitionRetryPrompt(retryReason)
        : `${buildVisionPrompt(resolvePromptVariant(), options?.hints)}\n\nПроанализируй фото еды и верни только JSON.`;
    return completeChat(
      [
        {
          role: "user",
          content,
          attachments: [fileId],
        },
      ],
      0.35,
      { retries: mode === "retry" ? 1 : 2 },
    );
  };

  const specialistChat = async (content: string, attachmentId: string) => {
    chatCalls += 1;
    return completeChat(
      [
        {
          role: "user",
          content,
          attachments: [attachmentId],
        },
      ],
      0.2,
      // Specialists: fail fast on 429 — long backoff was pushing past nginx 180s.
      { retries: 1 },
    );
  };

  let text = await ask("full");
  let result: FoodRecognitionResult;
  try {
    result = parseFoodRecognitionResponse(text);
  } catch {
    if (chatCalls < MAX_CHAT_CALLS) {
      text = await ask("retry", null);
      result = parseFoodRecognitionResponse(text);
    } else {
      throw new Error("Не удалось разобрать ответ распознавания");
    }
  }

  logRecognitionPass({
    pass: "main",
    photoKind: result.photoKind,
    retryReason: getRecognitionRetryReason(result),
    itemCount: result.items?.length ?? 0,
    calories: result.calories,
    confidence: result.confidence,
    dishName: result.dishName,
    ...telemetryBase(),
  });

  result = sanitizeVisionBarcode(result);

  const runSpecialist = async (pass: SpecialistPass): Promise<FoodRecognitionResult> => {
    if (pass === "barcode") {
      const barcodeText = await specialistChat(buildBarcodeVisionPrompt(), fileId);
      const refined = sanitizeVisionBarcode(parseFoodRecognitionResponse(barcodeText));
      if (!refined.barcode) return result;
      return {
        ...result,
        ...refined,
        photoKind: "barcode",
        barcode: refined.barcode,
        dishName: refined.dishName || result.dishName,
        brand: refined.brand || result.brand,
      };
    }

    if (pass === "plate") {
      const plateText = await specialistChat(buildPlateVisionPrompt(), fileId);
      const plated = parseFoodRecognitionResponse(plateText);
      if (!isBetterPlateResult(result, plated)) return result;
      return { ...plated, photoKind: "meal", source: result.source };
    }

    if (pass === "label") {
      const hasLabelTable =
        (result.per100g?.calories ?? 0) > 0 &&
        result.portionGrams !== undefined &&
        result.portionGrams > 0;
      let labelFileId = fileId;
      if (!hasLabelTable) {
        const labelPrepared = await prepareImageForLabelVision(imageBuffer);
        labelFileId = await uploadImage(
          token,
          labelPrepared.buffer,
          labelPrepared.mimeType,
          filename,
        );
      }
      const labelText = await specialistChat(buildLabelVisionPrompt(), labelFileId);
      const labeled = parseFoodRecognitionResponse(labelText);
      if (!isBetterLabelResult(result, labeled)) return result;
      return {
        ...result,
        ...labeled,
        photoKind: "label",
        dishName: labeled.dishName || result.dishName,
        brand: labeled.brand || result.brand,
        barcode: labeled.barcode || result.barcode,
      };
    }

    if (pass === "package") {
      const packageText = await specialistChat(buildPackageVisionPrompt(), fileId);
      const packaged = parseFoodRecognitionResponse(packageText);
      if (!isBetterPackageResult(result, packaged)) return result;
      return {
        ...result,
        dishName: packaged.dishName || result.dishName,
        brand: packaged.brand || result.brand,
        barcode: packaged.barcode || result.barcode,
        portionGrams:
          packaged.portionGrams && packaged.portionGrams > 0
            ? packaged.portionGrams
            : result.portionGrams,
        photoKind: "package",
        confidence: Math.max(result.confidence, packaged.confidence),
      };
    }

    if (pass === "sticker") {
      const stickerText = await specialistChat(buildStickerVisionPrompt(), fileId);
      const stickered = parseFoodRecognitionResponse(stickerText);
      if (!isBetterStickerResult(result, stickered)) return result;
      return {
        ...result,
        ...stickered,
        photoKind: "label",
        dishName: stickered.dishName || result.dishName,
        brand: stickered.brand || result.brand,
        barcode: stickered.barcode || result.barcode,
      };
    }

    // drink
    const drinkText = await specialistChat(buildDrinkVisionPrompt(), fileId);
    const drink = parseFoodRecognitionResponse(drinkText);
    if (!isBetterDrinkResult(result, drink)) return result;
    return {
      ...result,
      ...drink,
      dishName: drink.dishName || result.dishName,
      brand: drink.brand || result.brand,
      barcode: drink.barcode || result.barcode,
      photoKind: drink.photoKind ?? result.photoKind ?? "package",
    };
  };

  let plateForced = false;
  let specialistRan: SpecialistPass | null = null;
  if (shouldForcePlateBeforeRetry(result) && chatCalls < MAX_CHAT_CALLS) {
    try {
      plateForced = true;
      specialistPass = "plate";
      specialistRan = "plate";
      result = await runSpecialist("plate");
      logRecognitionPass({
        pass: "specialist",
        photoKind: result.photoKind,
        retryReason: getRecognitionRetryReason(result),
        itemCount: result.items?.length ?? 0,
        calories: result.calories,
        confidence: result.confidence,
        dishName: result.dishName,
        ...telemetryBase(),
      });
    } catch (error) {
      console.warn("Forced plate specialist failed", error);
    }
  }

  if (shouldRetryFoodRecognition(result) && chatCalls < MAX_CHAT_CALLS - 1) {
    // Leave chat slots for specialist + optional post-specialist retry.
    try {
      const reason = getRecognitionRetryReason(result);
      text = await ask("retry", reason);
      const retried = parseFoodRecognitionResponse(text);
      logRecognitionPass({
        pass: "retry",
        photoKind: retried.photoKind,
        retryReason: getRecognitionRetryReason(retried),
        itemCount: retried.items?.length ?? 0,
        calories: retried.calories,
        confidence: retried.confidence,
        dishName: retried.dishName,
        ...telemetryBase(),
      });
      if (isBetterRecognitionResult(result, retried)) {
        result = retried;
      }
    } catch (error) {
      console.warn("Recognition quality retry failed", error);
    }
  }

  const specialist = pickSpecialistPass(result);
  const effectiveSpecialist =
    specialist && specialist === "plate" && plateForced ? null : specialist;
  if (effectiveSpecialist && chatCalls < MAX_CHAT_CALLS) {
    try {
      specialistPass = effectiveSpecialist;
      specialistRan = effectiveSpecialist;
      result = await runSpecialist(effectiveSpecialist);
      logRecognitionPass({
        pass: "specialist",
        photoKind: result.photoKind,
        retryReason: getRecognitionRetryReason(result),
        itemCount: result.items?.length ?? 0,
        calories: result.calories,
        confidence: result.confidence,
        dishName: result.dishName,
        ...telemetryBase(),
      });

      // Package with unreadable barcode: one identity fallback if budget remains.
      if (
        effectiveSpecialist === "barcode" &&
        chatCalls < MAX_CHAT_CALLS &&
        !normalizeBarcode(result.barcode ?? null) &&
        (result.photoKind === "package" || result.photoKind === "barcode") &&
        shouldRunPackagePass({ ...result, photoKind: "package" })
      ) {
        specialistPass = "package";
        specialistRan = "package";
        result = await runSpecialist("package");
        logRecognitionPass({
          pass: "specialist",
          photoKind: result.photoKind,
          retryReason: getRecognitionRetryReason(result),
          itemCount: result.items?.length ?? 0,
          calories: result.calories,
          confidence: result.confidence,
          dishName: result.dishName,
          ...telemetryBase(),
        });
      }
    } catch (error) {
      console.warn("Recognition specialist pass failed", effectiveSpecialist, error);
    }
  }

  if (shouldRetryFoodRecognition(result) && chatCalls < MAX_CHAT_CALLS && specialistRan) {
    try {
      const reason = getRecognitionRetryReason(result);
      text = await ask("retry", reason);
      const retried = parseFoodRecognitionResponse(text);
      logRecognitionPass({
        pass: "retry",
        photoKind: retried.photoKind,
        retryReason: getRecognitionRetryReason(retried),
        itemCount: retried.items?.length ?? 0,
        calories: retried.calories,
        confidence: retried.confidence,
        dishName: retried.dishName,
        ...telemetryBase(),
      });
      if (isBetterRecognitionResult(result, retried)) {
        result = retried;
      }
    } catch (error) {
      console.warn("Post-specialist recognition retry failed", error);
    }
  }

  result = repairPackagedMislabel(result);

  logRecognitionPass({
    pass: "accepted",
    photoKind: result.photoKind,
    retryReason: getRecognitionRetryReason(result),
    itemCount: result.items?.length ?? 0,
    calories: result.calories,
    confidence: result.confidence,
    dishName: result.dishName,
    source: result.source,
    ...telemetryBase(),
  });

  return result;
}
