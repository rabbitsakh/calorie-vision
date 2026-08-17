import { NextRequest, NextResponse } from "next/server";
import { readUploadedImageById } from "@/lib/upload";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { buffer, mimeType } = await readUploadedImageById(id);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Фото не найдено" }, { status: 404 });
  }
}
