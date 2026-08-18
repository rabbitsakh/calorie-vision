import { NextRequest, NextResponse } from "next/server";
import { parseAdminPageOffset, parseAdminPageSize, type AdminUserRow } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdmin();
    if (response) {
      return response;
    }

    const offset = parseAdminPageOffset(request.nextUrl.searchParams.get("offset"));
    const limit = parseAdminPageSize(request.nextUrl.searchParams.get("limit"));

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        skip: offset,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          sex: true,
          timezone: true,
          image: true,
          createdAt: true,
          _count: {
            select: {
              mealEntries: true,
              weightEntries: true,
            },
          },
        },
      }),
      prisma.user.count(),
    ]);

    const photoCounts = rows.length
      ? await prisma.mealEntry.groupBy({
          by: ["userId"],
          where: {
            userId: { in: rows.map((row) => row.id) },
            imagePath: { not: null },
          },
          _count: { _all: true },
        })
      : [];

    const photosByUser = new Map(photoCounts.map((row) => [row.userId, row._count._all]));

    const users: AdminUserRow[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      sex: row.sex,
      timezone: row.timezone,
      image: row.image,
      createdAt: row.createdAt.toISOString(),
      mealCount: row._count.mealEntries,
      weightCount: row._count.weightEntries,
      photoCount: photosByUser.get(row.id) ?? 0,
    }));

    return NextResponse.json({
      users,
      total,
      hasMore: offset + users.length < total,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить пользователей" }, { status: 500 });
  }
}
