import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { readUploadedImageById, userCanAccessUpload } from "@/lib/upload";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const { id } = await params;
    if (!id || !/^[0-9a-f-]{8,}$/i.test(id)) {
      return NextResponse.json({ error: "Фото не найдено" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });
    const allowed = await userCanAccessUpload(id, session.user.id, {
      isAdmin: isAdminEmail(user?.email),
    });
    if (!allowed) {
      return NextResponse.json({ error: "Нет доступа к фото" }, { status: 403 });
    }

    const { buffer, mimeType } = await readUploadedImageById(id);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Фото не найдено" }, { status: 404 });
  }
}
