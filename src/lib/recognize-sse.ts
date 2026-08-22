import type { FoodRecognitionResult } from "@/lib/food-types";
import type { RecognitionResponse } from "@/types";

export type RecognizeSseEvent =
  | { event: "image"; data: { imagePath: string } }
  | { event: "vision"; data: { recognition: FoodRecognitionResult } }
  | { event: "done"; data: RecognitionResponse }
  | { event: "error"; data: { error: string } };

export type RecognizeSseHandlers = {
  onImage?: (imagePath: string) => void;
  onVision?: (recognition: FoodRecognitionResult) => void;
  onDone?: (result: RecognitionResponse) => void;
  onError?: (error: string) => void;
};

function parseSseBlock(block: string): RecognizeSseEvent | null {
  const lines = block.split("\n");
  let event = "message";
  let data = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      data += line.slice(5).trim();
    }
  }

  if (!data) {
    return null;
  }

  try {
    const parsed = JSON.parse(data) as unknown;
    if (event === "image" && parsed && typeof parsed === "object" && "imagePath" in parsed) {
      return { event: "image", data: parsed as { imagePath: string } };
    }
    if (event === "vision" && parsed && typeof parsed === "object" && "recognition" in parsed) {
      return { event: "vision", data: parsed as { recognition: FoodRecognitionResult } };
    }
    if (event === "done" && parsed && typeof parsed === "object" && "recognition" in parsed) {
      return { event: "done", data: parsed as RecognitionResponse };
    }
    if (event === "error" && parsed && typeof parsed === "object" && "error" in parsed) {
      return { event: "error", data: parsed as { error: string } };
    }
  } catch {
    return null;
  }

  return null;
}

/** Consume POST /api/recognize/stream SSE body. */
export async function consumeRecognizeSse(
  response: Response,
  handlers: RecognizeSseHandlers,
): Promise<RecognitionResponse> {
  if (!response.ok) {
    const text = await response.text();
    let message = "Ошибка распознавания";
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      if (text.trim()) message = text.trim();
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("Пустой ответ сервера");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: RecognitionResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const parsed = parseSseBlock(part.trim());
      if (!parsed) {
        continue;
      }

      switch (parsed.event) {
        case "image":
          handlers.onImage?.(parsed.data.imagePath);
          break;
        case "vision":
          handlers.onVision?.(parsed.data.recognition);
          break;
        case "done":
          finalResult = parsed.data;
          handlers.onDone?.(parsed.data);
          break;
        case "error":
          handlers.onError?.(parsed.data.error);
          throw new Error(parsed.data.error);
      }
    }
  }

  if (!finalResult) {
    throw new Error("Распознавание не завершилось");
  }

  return finalResult;
}
