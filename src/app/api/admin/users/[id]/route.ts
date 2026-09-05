import { NextRequest, NextResponse } from "next/server";
import { deleteUserAccount } from "@/lib/account-delete";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Admin-only hard delete of a user account (e.g. orphan Telegram duplicate).
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { response } = await requireAdmin();
    if (response) {
      return response;
    }

    const { id } = await context.params;
    const userId = id?.trim();
    if (!userId) {
      return NextResponse.json({ error: "Не указан пользователь" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    try {
      await deleteUserAccount(userId);
    } catch (error) {
      if (error instanceof Error && error.message === "USER_NOT_FOUND") {
        return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true, deleted: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось удалить пользователя" }, { status: 500 });
  }
}
