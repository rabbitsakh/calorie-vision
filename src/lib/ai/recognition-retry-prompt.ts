import { FOOD_JSON_SHAPE } from "@/lib/ai/prompt";
import type { RecognitionRetryReason } from "@/lib/ai/recognition-retry";

const RETRY_HINTS: Record<RecognitionRetryReason, string> = {
  "failed-name":
    "На фото еда — укажи конкретное блюдо или продукт на русском, не «Не удалось распознать».",
  "plate-list-without-items":
    "В dishName перечислено несколько блюд — обязательно заполни items (2–8) с calories, portionGrams и КБЖУ для каждого.",
  "zero-calorie-meal":
    "Укажи ненулевые calories и portionGrams для видимой порции (типично 150–350 г).",
  "low-confidence":
    "Уточни название и калории — confidence должен отражать уверенность в блюде и порции.",
  "vague-name":
    "Замени общее название («обед», «еда») на конкретные продукты или блюда.",
  "empty-label":
    "Считай таблицу на этикетке: per100g и/или calories на порцию, portionGrams с упаковки.",
  "missing-macros":
    "Добавь protein, fat, carbs на всю порцию — не только calories.",
  "package-no-barcode":
    "Считай штрихкод EAN/UPC или per100g с упаковки; укажи brand и net weight.",
  "packaged-soup-mismatch":
    "На фото упаковка/стаканчик с крупой (овсянка, геркулес, хлопья) — прочитай КРУПНЫЙ текст с упаковки буквально. Это не суп и не том ям; укажи реальное название продукта с упаковки.",
};

/** Retry message tailored to the weak spot in the first vision response. */
export function buildRecognitionRetryPrompt(reason: RecognitionRetryReason | null): string {
  const hint =
    reason && RETRY_HINTS[reason]
      ? RETRY_HINTS[reason]
      : "Исправь предыдущий ответ: валидный JSON; для смешанной тарелки items 2–8 с ненулевыми calories/portionGrams.";

  return `По фото еды верни ТОЛЬКО валидный JSON (без markdown) по схеме:
${FOOD_JSON_SHAPE}

${hint}
alternatives: 0–3 варианта с calories и protein/fat/carbs если можешь; иначе [].
fiber/sugar — только если знаешь; для мяса/рыбы/яиц — 0; если не знаешь — не добавляй ключи.`;
}
