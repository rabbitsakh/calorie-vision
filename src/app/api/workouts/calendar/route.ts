import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { serializeSessionSummary, sessionInclude } from "@/lib/workouts/serialize";
import {
  aggregatePeriod,
  monthEndKey,
  monthStartKey,
} from "@/lib/workouts/trends";

export const dynamic = "force-dynamic";

/**
 * GET ?month=YYYY-MM
 * → marked days + per-day counts + monthly tonnage/km summary.
 */
export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const monthRaw = request.nextUrl.searchParams.get("month")?.trim() ?? "";
    const month = /^\d{4}-\d{2}$/.test(monthRaw)
      ? monthRaw
      : new Date().toISOString().slice(0, 7);
    const from = monthStartKey(`${month}-01`);
    const to = monthEndKey(`${month}-01`);

    const rows = await prisma.workoutSession.findMany({
      where: {
        userId: session.user.id,
        date: { gte: from, lte: to },
      },
      include: sessionInclude,
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });

    const summaries = rows.map(serializeSessionSummary);
    const byDate: Record<string, number> = {};
    for (const s of summaries) {
      byDate[s.date] = (byDate[s.date] ?? 0) + 1;
    }

    const summary = aggregatePeriod(
      summaries.map((s) => ({
        date: s.date,
        totalLoad: s.totalLoad,
        loadByGroup: s.loadByGroup,
        cardioDistanceKm: s.cardioDistanceKm,
        cardioDurationSec: s.cardioDurationSec,
      })),
      from,
      to,
    );

    return NextResponse.json({
      month,
      from,
      to,
      dates: Object.keys(byDate).sort(),
      counts: byDate,
      summary: {
        sessionCount: summary.sessionCount,
        tonnage: summary.tonnage,
        cardioDistanceKm: summary.cardioDistanceKm,
        cardioDurationSec: summary.cardioDurationSec,
        byGroup: summary.byGroup,
      },
    });
  } catch (error) {
    console.error("GET /api/workouts/calendar", error);
    return NextResponse.json({ error: "Не удалось загрузить календарь" }, { status: 500 });
  }
}
