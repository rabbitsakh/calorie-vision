import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { requireSession } from "@/lib/auth-session";
import { resizeImageThumb } from "@/lib/image-compress";
import { prisma } from "@/lib/prisma";
import { readUploadedImageById, userCanAccessUpload } from "@/lib/upload";
import { verifyUploadAccess } from "@/lib/upload-sign";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id || !/^[0-9a-f-]{8,}$/i.test(id)) {
      return NextResponse.json({ error: "Фото не найдено" }, { status: 404 });
    }

    const exp = request.nextUrl.searchParams.get("exp");
    const uid = request.nextUrl.searchParams.get("uid");
    const sig = request.nextUrl.searchParams.get("sig");
    const signedOk = verifyUploadAccess(id, exp, uid, sig);

    if (!signedOk) {
      const { session, response } = await requireSession();
      if (response) {
        return response;
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
    } else if (uid) {
      // Signed URL still requires ownership of the upload id.
      const allowed = await userCanAccessUpload(id, uid);
      if (!allowed) {
        return NextResponse.json({ error: "Нет доступа к фото" }, { status: 403 });
      }
    }

    const { buffer, mimeType } = await readUploadedImageById(id);
    const wRaw = request.nextUrl.searchParams.get("w");
    const w = wRaw != null ? Number(wRaw) : NaN;
    const thumb = Number.isFinite(w) ? await resizeImageThumb(buffer, w) : null;
    const outBuffer = thumb?.buffer ?? buffer;
    const outMime = thumb?.mimeType ?? mimeType;

    return new NextResponse(new Uint8Array(outBuffer), {
      headers: {
        "Content-Type": outMime,
        "Cache-Control": thumb
          ? "private, max-age=86400"
          : "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Фото не найдено" }, { status: 404 });
  }
}
