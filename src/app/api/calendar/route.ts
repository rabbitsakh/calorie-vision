import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { monthDateRange, parseYearMonth, toDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const monthParam = request.nextUrl.searchParams.get("month");
    const parsed = monthParam ? parseYearMonth(monthParam) : null;
    if (!parsed) {
      return NextResponse.json({ error: "Укажите month=YYYY-MM" }, { status: 400 });
    }

    const { start, end } = monthDateRange(parsed.year, parsed.monthIndex);

    const [meals, weights] = await Promise.all([
      prisma.mealEntry.findMany({
        where: { userId: session.user.id, date: { gte: start, lte: end } },
        select: { date: true },
      }),
      prisma.weightEntry.findMany({
        where: { userId: session.user.id, date: { gte: start, lte: end } },
        select: { date: true },
      }),
    ]);

    const dates = [...new Set([...meals, ...weights].map((item) => toDateKey(item.date)))].sort();

    return NextResponse.json({ dates });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить календарь" }, { status: 500 });
  }
}
