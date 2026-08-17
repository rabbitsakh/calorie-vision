import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { recognizeFoodWithAI } from "@/lib/food-recognition";
import { saveUploadedImage } from "@/lib/upload";

export async function POST(request: NextRequest) {
  try {
    const { response } = await requireSession();
    if (response) {
      return response;
    }

    const formData = await request.formData();
    const file = formData.get("photo");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Фото не найдено" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Нужен файл изображения" }, { status: 400 });
    }

    const imagePath = await saveUploadedImage(file);
    const buffer = Buffer.from(await file.arrayBuffer());
    const recognition = await recognizeFoodWithAI(buffer, file.name);

    return NextResponse.json({
      imagePath,
      recognition,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Не удалось распознать фото",
      },
      { status: 500 },
    );
  }
}
