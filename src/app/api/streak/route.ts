import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function computeStreak(dates: string[], today: string): number {
  if (dates.length === 0) return 0;

  const sorted = [...new Set(dates)].sort().reverse();
  let streak = 0;
  let expected = today;

  for (const date of sorted) {
    if (date === expected) {
      streak += 1;
      // Move expected to the previous day
      const d = new Date(date + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      expected = d.toISOString().slice(0, 10);
    } else if (date < expected) {
      // Gap — streak broken
      break;
    }
  }

  return streak;
}

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) {
      return response;
    }

    const todayParam = request.nextUrl.searchParams.get("today");
    const today = todayParam ?? new Date().toISOString().slice(0, 10);

    const entries = await prisma.mealEntry.findMany({
      where: { userId: session.user.id },
      select: { date: true },
      orderBy: { date: "desc" },
      take: 400, // enough for ~13 months
    });

    const dates = entries.map((e) => e.date);
    const streak = computeStreak(dates, today);

    return NextResponse.json({ streak });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Не удалось загрузить серию" }, { status: 500 });
  }
}
