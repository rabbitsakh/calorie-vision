import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { parseWorkoutLog } from "@/lib/workouts/parse-log";

export const dynamic = "force-dynamic";

/** Parse free-text workout notes into exercises + sets (regex, then GigaChat). */
export async function POST(request: NextRequest) {
  try {
    const { response } = await requireSession();
    if (response) return response;

    const body = (await request.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text : "";
    if (!text.trim()) {
      return NextResponse.json({ error: "Вставьте текст тренировки" }, { status: 400 });
    }

    const result = await parseWorkoutLog(text);
    if (result.blocks.length === 0) {
      return NextResponse.json(
        {
          error:
            "Не удалось разобрать. Пример: «Жим лёжа 80x8, 80x8» или несколько строк.",
          blocks: [],
          source: result.source,
        },
        { status: 422 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/workouts/parse", error);
    return NextResponse.json({ error: "Не удалось разобрать текст" }, { status: 500 });
  }
}
