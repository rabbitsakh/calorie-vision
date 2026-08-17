import { lookupFoodWithGigaChat, recognizeWithGigaChat } from "@/lib/ai/gigachat";

export type FoodRecognitionResult = {
  dishName: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  portionGrams?: number;
  confidence: number;
  alternatives?: Array<{
    dishName: string;
    calories: number;
  }>;
  source?: string;
};

export async function recognizeFoodWithAI(
  imageBuffer: Buffer,
  filename: string,
): Promise<FoodRecognitionResult> {
  if (!process.env.GIGACHAT_CREDENTIALS) {
    throw new Error(
      "Не задан GIGACHAT_CREDENTIALS в .env. Получите ключ: https://developers.sber.ru/studio/workspaces",
    );
  }

  const result = await recognizeWithGigaChat(imageBuffer, filename);
  return { ...result, source: "gigachat" };
}

export async function lookupFoodByName(dishName: string): Promise<FoodRecognitionResult> {
  if (!process.env.GIGACHAT_CREDENTIALS) {
    throw new Error(
      "Не задан GIGACHAT_CREDENTIALS в .env. Получите ключ: https://developers.sber.ru/studio/workspaces",
    );
  }

  if (!dishName.trim()) {
    throw new Error("Укажите название блюда");
  }

  const result = await lookupFoodWithGigaChat(dishName);
  return { ...result, source: "gigachat-lookup" };
}
