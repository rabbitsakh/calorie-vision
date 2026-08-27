import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { decodeHtmlEntities } from "@/lib/html-text";
import { prisma } from "@/lib/prisma";

const MAX_PORTIONS = 5;

/**
 * Distinct recent portionGrams for the same dish name (user history).
 * GET /api/meals/portion-history?dishName=...
 */
export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const raw = request.nextUrl.searchParams.get("dishName")?.trim() ?? "";
    const dishName = decodeHtmlEntities(raw).trim();
    if (!dishName || dishName.length < 2) {
      return NextResponse.json({ portions: [] as number[] });
    }

    const rows = await prisma.mealEntry.findMany({
      where: {
        userId: session.user.id,
        dishName: { equals: dishName },
        portionGrams: { not: null, gt: 0 },
      },
      orderBy: { createdAt: "desc" },
      select: { portionGrams: true },
      take: 40,
    });

    const portions: number[] = [];
    const seen = new Set<number>();
    for (const row of rows) {
      const grams = row.portionGrams;
      if (grams == null || grams <= 0 || seen.has(grams)) continue;
      seen.add(grams);
      portions.push(grams);
      if (portions.length >= MAX_PORTIONS) break;
    }

    return NextResponse.json({ portions });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить историю порций" }, { status: 500 });
  }
}
