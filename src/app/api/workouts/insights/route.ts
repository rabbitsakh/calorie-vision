import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { mondayOfWeek, shiftDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { normalizeExerciseName } from "@/lib/workouts/exercise-name";
import { roundLoad } from "@/lib/workouts/load";
import { isMuscleGroupKey, muscleGroupLabel, parseMuscleGroupKeys } from "@/lib/workouts/muscle-groups";
import { serializeSessionSummary, sessionInclude } from "@/lib/workouts/serialize";

export const dynamic = "force-dynamic";

/**
 * GET ?groups=chest,triceps&weekOf=YYYY-MM-DD
 * → exercise name suggestions from history + weekly tonnage by group.
 */
export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const groupsRaw = request.nextUrl.searchParams.get("groups");
    const groups = groupsRaw
      ? parseMuscleGroupKeys(groupsRaw.split(",").map((s) => s.trim()).filter(Boolean))
      : null;

    const weekOf = request.nextUrl.searchParams.get("weekOf");
    const anchor = weekOf && /^\d{4}-\d{2}-\d{2}$/.test(weekOf) ? weekOf : null;
    // Default: current UTC date is fine for admin tool; UI passes local today.
    const today = anchor ?? new Date().toISOString().slice(0, 10);
    const weekStart = mondayOfWeek(today);
    const weekEnd = shiftDateKey(weekStart, 6);

    const history = await prisma.workoutSession.findMany({
      where: { userId: session.user.id },
      include: sessionInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 80,
    });

    const summaries = history.map(serializeSessionSummary);

    // Weekly volume (all groups in the calendar week).
    const weekSessions = summaries.filter((s) => s.date >= weekStart && s.date <= weekEnd);
    const weeklyByGroup: Record<string, number> = {};
    let weeklyTotal = 0;
    for (const s of weekSessions) {
      weeklyTotal += s.totalLoad;
      for (const [g, load] of Object.entries(s.loadByGroup)) {
        weeklyByGroup[g] = roundLoad((weeklyByGroup[g] ?? 0) + load);
      }
    }

    // Exercise suggestions: names seen with matching muscle groups (or any if no filter).
    const nameStats = new Map<
      string,
      { name: string; count: number; lastDate: string; lastSets: Array<{
        weightKg: number | null;
        reps: number | null;
        distanceKm: number | null;
        durationSec: number | null;
      }> }
    >();

    for (const row of history) {
      const sessionGroups = new Set(row.muscles.map((m) => m.groupKey));
      const matchesGroups =
        !groups || groups.some((g) => sessionGroups.has(g));
      if (!matchesGroups && groups) {
        // Still allow exercises explicitly tagged with one of the groups.
      }

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
      weeklyTotal: roundLoad(weeklyTotal),
      weeklyByGroup: Object.fromEntries(
        Object.entries(weeklyByGroup).map(([k, v]) => [k, { load: v, label: muscleGroupLabel(k) }]),
      ),
      suggestions,
      sessionCount: weekSessions.length,
    });
  } catch (error) {
    console.error("GET /api/workouts/insights", error);
    return NextResponse.json({ error: "Не удалось загрузить подсказки" }, { status: 500 });
  }
}
