import { randomUUID } from "crypto";
import https from "https";
import { URL } from "url";
import type { FoodRecognitionResult } from "../food-types";
import { FOOD_RECOGNITION_PROMPT, FOOD_RECOGNITION_RETRY_PROMPT, buildFiberSugarLookupPrompt, buildFoodLookupPrompt } from "@/lib/ai/prompt";
import { parseFoodRecognitionResponse } from "@/lib/ai/parse-response";
import {
  getRecognitionRetryReason,
  isBetterRecognitionResult,
  shouldRetryFoodRecognition,
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
import { sanitizeVisionBarcode, shouldRunBarcodePass } from "@/lib/ai/barcode-vision";
import { isBetterPlateResult, shouldRunPlatePass } from "@/lib/ai/plate-vision";
import { isBetterLabelResult, shouldRunLabelPass } from "@/lib/ai/label-vision";
import { isBetterPackageResult, shouldRunPackagePass } from "@/lib/ai/package-vision";
import { isBetterStickerResult, shouldRunStickerPass } from "@/lib/ai/sticker-vision";
import { isBetterDrinkResult, shouldRunDrinkPass } from "@/lib/ai/drink-vision";

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
  return withRateLimitRetry(async () => {
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
): Promise<string> {
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
  });
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

export async function recognizeWithGigaChat(
  imageBuffer: Buffer,
  filename: string,
): Promise<FoodRecognitionResult> {
  const prepared = await prepareImageForVision(imageBuffer);
  const token = await getAccessToken();
  const fileId = await uploadImage(token, prepared.buffer, prepared.mimeType, filename);

  const ask = async (mode: "full" | "retry" = "full") => {
    const content =
      mode === "retry"
        ? FOOD_RECOGNITION_RETRY_PROMPT
        : `${FOOD_RECOGNITION_PROMPT}\n\nПроанализируй фото еды и верни только JSON.`;
    return completeChat([
      {
        role: "user",
        content,
        attachments: [fileId],
      },
    ]);
  };

  let text = await ask("full");
  let result: FoodRecognitionResult;
  try {
    result = parseFoodRecognitionResponse(text);
  } catch {
    text = await ask("retry");
    result = parseFoodRecognitionResponse(text);
  }

  logRecognitionPass({
    pass: "main",
    photoKind: result.photoKind,
    retryReason: getRecognitionRetryReason(result),
    itemCount: result.items?.length ?? 0,
    calories: result.calories,
    confidence: result.confidence,
    dishName: result.dishName,
  });

  if (shouldRetryFoodRecognition(result)) {
    try {
      text = await ask("retry");
      const retried = parseFoodRecognitionResponse(text);
      logRecognitionPass({
        pass: "retry",
        photoKind: retried.photoKind,
        retryReason: getRecognitionRetryReason(retried),
        itemCount: retried.items?.length ?? 0,
        calories: retried.calories,
        confidence: retried.confidence,
        dishName: retried.dishName,
      });
      if (isBetterRecognitionResult(result, retried)) {
        result = retried;
      }
    } catch {
      // keep first parse
    }
  }

  result = sanitizeVisionBarcode(result);

  if (shouldRunBarcodePass(result)) {
    try {
      const barcodeText = await completeChat([
        {
          role: "user",
          content: buildBarcodeVisionPrompt(),
          attachments: [fileId],
        },
      ]);
      const refined = sanitizeVisionBarcode(parseFoodRecognitionResponse(barcodeText));
      if (refined.barcode) {
        result = {
          ...result,
          ...refined,
          photoKind: "barcode",
          barcode: refined.barcode,
          dishName: refined.dishName || result.dishName,
          brand: refined.brand || result.brand,
        };
      }
    } catch {
      // keep sanitized first pass
    }
  }

  if (shouldRunPlatePass(result)) {
    try {
      const plateText = await completeChat([
        {
          role: "user",
          content: buildPlateVisionPrompt(),
          attachments: [fileId],
        },
      ]);
      const plated = parseFoodRecognitionResponse(plateText);
      if (isBetterPlateResult(result, plated)) {
        result = {
          ...plated,
          photoKind: "meal",
          source: result.source,
        };
      }
    } catch {
      // keep first/retry result
    }
  }

  if (shouldRunLabelPass(result)) {
    try {
      const labelPrepared = await prepareImageForLabelVision(imageBuffer);
      const labelFileId = await uploadImage(
        token,
        labelPrepared.buffer,
        labelPrepared.mimeType,
        filename,
      );
      const labelText = await completeChat([
        {
          role: "user",
          content: buildLabelVisionPrompt(),
          attachments: [labelFileId],
        },
      ]);
      const labeled = parseFoodRecognitionResponse(labelText);
      if (isBetterLabelResult(result, labeled)) {
        result = {
          ...result,
          ...labeled,
          photoKind: "label",
          dishName: labeled.dishName || result.dishName,
          brand: labeled.brand || result.brand,
          barcode: labeled.barcode || result.barcode,
        };
      }
    } catch {
      // keep first/retry result
    }
  }

  if (shouldRunPackagePass(result)) {
    try {
      const packageText = await completeChat([
        {
          role: "user",
          content: buildPackageVisionPrompt(),
          attachments: [fileId],
        },
      ]);
      const packaged = parseFoodRecognitionResponse(packageText);
      if (isBetterPackageResult(result, packaged)) {
        result = {
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
    } catch {
      // keep first/retry result
    }
  }

  if (shouldRunStickerPass(result)) {
    try {
      const stickerText = await completeChat([
        {
          role: "user",
          content: buildStickerVisionPrompt(),
          attachments: [fileId],
        },
      ]);
      const stickered = parseFoodRecognitionResponse(stickerText);
      if (isBetterStickerResult(result, stickered)) {
        result = {
          ...result,
          ...stickered,
          photoKind: "label",
          dishName: stickered.dishName || result.dishName,
          brand: stickered.brand || result.brand,
          barcode: stickered.barcode || result.barcode,
        };
      }
    } catch {
      // keep first/retry result
    }
  }

  if (shouldRunDrinkPass(result)) {
    try {
      const drinkText = await completeChat([
        {
          role: "user",
          content: buildDrinkVisionPrompt(),
          attachments: [fileId],
        },
      ]);
      const drink = parseFoodRecognitionResponse(drinkText);
      if (isBetterDrinkResult(result, drink)) {
        result = {
          ...result,
          ...drink,
          dishName: drink.dishName || result.dishName,
          brand: drink.brand || result.brand,
          barcode: drink.barcode || result.barcode,
          photoKind: drink.photoKind ?? result.photoKind ?? "package",
        };
      }
    } catch {
      // keep first/retry result
    }
  }

  logRecognitionPass({
    pass: "accepted",
    photoKind: result.photoKind,
    retryReason: getRecognitionRetryReason(result),
    itemCount: result.items?.length ?? 0,
    calories: result.calories,
    confidence: result.confidence,
    dishName: result.dishName,
  });

  return result;
}
