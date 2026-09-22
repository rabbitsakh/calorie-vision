import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { mondayOfWeek, shiftDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { normalizeExerciseName } from "@/lib/workouts/exercise-name";
import { isMuscleGroupKey, parseMuscleGroupKeys } from "@/lib/workouts/muscle-groups";
import { serializeSessionSummary, sessionInclude } from "@/lib/workouts/serialize";
import {
  aggregatePeriod,
  monthEndKey,
  monthStartKey,
  trendPct,
} from "@/lib/workouts/trends";

export const dynamic = "force-dynamic";

/**
 * GET ?groups=chest,triceps&weekOf=YYYY-MM-DD
 * → suggestions + weekly/monthly tonnage (separate from cardio km) + trends.
 */
export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const groupsRaw = request.nextUrl.searchParams.get("groups");
    const groups = groupsRaw
      ? parseMuscleGroupKeys(groupsRaw.split(",").map((s) => s.trim()).filter(Boolean))
      : null;

    const weekOf = request.nextUrl.searchParams.get("weekOf");
    const anchor = weekOf && /^\d{4}-\d{2}-\d{2}$/.test(weekOf) ? weekOf : null;
    const today = anchor ?? new Date().toISOString().slice(0, 10);
    const weekStart = mondayOfWeek(today);
    const weekEnd = shiftDateKey(weekStart, 6);
    const prevWeekStart = shiftDateKey(weekStart, -7);
    const prevWeekEnd = shiftDateKey(weekStart, -1);
    const monthStart = monthStartKey(today);
    const monthEnd = monthEndKey(today);
    const prevMonthAnchor = shiftDateKey(monthStart, -1);
    const prevMonthStart = monthStartKey(prevMonthAnchor);
    const prevMonthEnd = monthEndKey(prevMonthAnchor);

    const history = await prisma.workoutSession.findMany({
      where: { userId: session.user.id },
      include: sessionInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 120,
    });

    const summaries = history.map(serializeSessionSummary);
    const periodSessions = summaries.map((s) => ({
      date: s.date,
      totalLoad: s.totalLoad,
      loadByGroup: s.loadByGroup,
      cardioDistanceKm: s.cardioDistanceKm,
      cardioDurationSec: s.cardioDurationSec,
    }));

    const week = aggregatePeriod(periodSessions, weekStart, weekEnd);
    const prevWeek = aggregatePeriod(periodSessions, prevWeekStart, prevWeekEnd);
    const month = aggregatePeriod(periodSessions, monthStart, monthEnd);
    const prevMonth = aggregatePeriod(periodSessions, prevMonthStart, prevMonthEnd);

    const nameStats = new Map<
      string,
      {
        name: string;
        count: number;
        lastDate: string;
        lastSets: Array<{
          weightKg: number | null;
          reps: number | null;
          distanceKm: number | null;
          durationSec: number | null;
        }>;
      }
    >();

    for (const row of history) {
      const sessionGroups = new Set(row.muscles.map((m) => m.groupKey));
      const matchesGroups = !groups || groups.some((g) => sessionGroups.has(g));

      for (const ex of row.exercises) {
        const tagged = ex.muscleGroup;
        const ok =
          !groups ||
          (tagged && isMuscleGroupKey(tagged) && groups.includes(tagged)) ||
          (!tagged && matchesGroups);
        if (!ok) continue;

        const key = normalizeExerciseName(ex.name);
        if (!key) continue;
        const sets = [...ex.sets]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((s) => ({
            weightKg: s.weightKg,
            reps: s.reps,
            distanceKm: s.distanceKm ?? null,
            durationSec: s.durationSec ?? null,
          }));
        const prev = nameStats.get(key);
        if (!prev) {
          nameStats.set(key, {
            name: ex.name.trim(),
            count: 1,
            lastDate: row.date,
            lastSets: sets,
          });
        } else {
          prev.count += 1;
          if (row.date > prev.lastDate || (row.date === prev.lastDate && sets.length > 0)) {
            if (row.date >= prev.lastDate) {
              prev.lastDate = row.date;
              if (sets.length > 0) prev.lastSets = sets;
            }
          }
        }
      }
    }

    const suggestions = [...nameStats.values()]
      .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
      .slice(0, 12)
      .map((s) => ({
        name: s.name,
        count: s.count,
        lastDate: s.lastDate,
        lastSets: s.lastSets,
      }));

    return NextResponse.json({
      weekStart,
      weekEnd,
      weeklyTotal: week.tonnage,
      weeklyByGroup: week.byGroup,
      weeklyCardioKm: week.cardioDistanceKm,
      weeklyCardioSec: week.cardioDurationSec,
      sessionCount: week.sessionCount,
      weekTrendPct: trendPct(week.tonnage, prevWeek.tonnage),
      weekCardioTrendPct: trendPct(week.cardioDistanceKm, prevWeek.cardioDistanceKm),
      monthStart,
      monthEnd,
      monthlyTotal: month.tonnage,
      monthlyByGroup: month.byGroup,
      monthlyCardioKm: month.cardioDistanceKm,
      monthlyCardioSec: month.cardioDurationSec,
      monthlySessionCount: month.sessionCount,
      monthTrendPct: trendPct(month.tonnage, prevMonth.tonnage),
      monthCardioTrendPct: trendPct(month.cardioDistanceKm, prevMonth.cardioDistanceKm),
      suggestions,
    });
  } catch (error) {
    console.error("GET /api/workouts/insights", error);
    return NextResponse.json({ error: "Не удалось загрузить подсказки" }, { status: 500 });
  }
}
