import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { isAllowedAvatarUrl } from "@/lib/avatar-url";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import {
  cacheOAuthAvatar,
  readUploadedImageById,
  resolveLegacyImageId,
  userCanAccessUpload,
} from "@/lib/upload";

export const runtime = "nodejs";

/**
 * Authenticated avatar bytes for APK WebView.
 *
 * Capacitor often fails OAuth CDN <img> hotlinks and (less often) cookie-gated
 * /api/uploads for <img>. Client fetch() with credentials → blob URL works.
 *
 * Query: `src` = User.image value (upload path or https avatar URL).
 */
export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const srcRaw = request.nextUrl.searchParams.get("src")?.trim() ?? "";
    if (!srcRaw) {
      return NextResponse.json({ error: "Нет фото" }, { status: 400 });
    }

    const uploadId = resolveLegacyImageId(srcRaw);
    if (uploadId) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true },
      });
      const allowed = await userCanAccessUpload(uploadId, session.user.id, {
        isAdmin: isAdminEmail(user?.email),
      });
      if (!allowed) {
        return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
      }
      const { buffer, mimeType } = await readUploadedImageById(uploadId);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": mimeType,
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    if (!isAllowedAvatarUrl(srcRaw)) {
      return NextResponse.json({ error: "Недопустимый источник" }, { status: 400 });
    }

    // Prefer a cached upload so later loads stay same-origin.
    const cached = await cacheOAuthAvatar(srcRaw, session.user.id);
    if (cached) {
      const id = resolveLegacyImageId(cached);
      if (id) {
        // Soft-upgrade User.image when it still points at the OAuth CDN.
        void prisma.user
          .updateMany({
            where: { id: session.user.id, image: srcRaw },
            data: { image: cached },
          })
          .catch(() => undefined);

        const { buffer, mimeType } = await readUploadedImageById(id);
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            "Content-Type": mimeType,
            "Cache-Control": "private, max-age=86400",
          },
        });
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const remote = await fetch(srcRaw, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          Referer: "https://calorievision.ru/",
        },
        redirect: "follow",
        signal: controller.signal,
      });
      if (!remote.ok) {
        return NextResponse.json({ error: "Фото недоступно" }, { status: 502 });
      }
      if (!isAllowedAvatarUrl(remote.url)) {
        return NextResponse.json({ error: "Недопустимый источник" }, { status: 400 });
      }
      const contentType = (remote.headers.get("content-type") ?? "image/jpeg")
        .split(";")[0]
        .trim();
      const buffer = Buffer.from(await remote.arrayBuffer());
      if (!buffer.length) {
        return NextResponse.json({ error: "Пустое фото" }, { status: 502 });
      }
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": contentType.startsWith("image/") ? contentType : "image/jpeg",
          "Cache-Control": "private, max-age=3600",
        },
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить фото" }, { status: 500 });
  }
}
