import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export async function requireSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      session: null,
      response: NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 }),
    };
  }

  return { session, response: null };
}

export async function requireAdmin() {
  const { session, response } = await requireSession();
  if (response) {
    return { session: null, response };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });

  if (!isAdminEmail(user?.email)) {
    return {
      session: null,
      response: NextResponse.json({ error: "Нет доступа" }, { status: 403 }),
    };
  }

  return { session, response: null };
}
