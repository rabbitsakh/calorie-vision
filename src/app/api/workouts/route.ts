import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { requireDateKey } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import {
  buildProgressSummary,
  findPreviousSession,
  parseProgressRate,
  type SessionLikeForProgress,
} from "@/lib/workouts/load";
import { parseMuscleGroupKeys } from "@/lib/workouts/muscle-groups";
import { countPrsBySessionId } from "@/lib/workouts/prs";
import { sweepIdleSessions } from "@/lib/workouts/apply-session-clock";
import { serializeSessionSummary, sessionInclude } from "@/lib/workouts/serialize";
import { estimateDbSessionEnergy, formatSessionEnergyLine } from "@/lib/workouts/energy";
import { weightEntryOrderNewestFirst } from "@/lib/weight-entries";

export const dynamic = "force-dynamic";

function toProgressRows(
  sessions: Array<ReturnType<typeof serializeSessionSummary>>,
): SessionLikeForProgress[] {
  return sessions.map((s) => ({
    id: s.id,
    date: s.date,
    createdAt: s.createdAt,
    muscleKeys: s.muscleKeys,
    totalLoad: s.totalLoad,
    loadByGroup: s.loadByGroup,
  }));
}

async function progressFor(
  userId: string,
  muscleGroups: readonly string[],
  currentLoad: number,
  progressRate: number,
  excludeSessionId?: string,
) {
  const history = await prisma.workoutSession.findMany({
    where: { userId },
    include: sessionInclude,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 60,
  });
  const prev = findPreviousSession(toProgressRows(history.map(serializeSessionSummary)), muscleGroups, {
    excludeSessionId,
  });
  return buildProgressSummary({
    targetGroups: muscleGroups,
    currentLoad,
    previous: prev,
    progressRate,
  });
}

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    await sweepIdleSessions(prisma, session.user.id);

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 100) : 40;
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    const groupsRaw = request.nextUrl.searchParams.get("groups");
    const groups = groupsRaw
      ? parseMuscleGroupKeys(groupsRaw.split(",").map((s) => s.trim()).filter(Boolean))
      : null;
    const cardioOnly = request.nextUrl.searchParams.get("cardio") === "1";
    const dateExact = request.nextUrl.searchParams.get("date");

    const dateFilter: { gte?: string; lte?: string; equals?: string } = {};
    if (dateExact && /^\d{4}-\d{2}-\d{2}$/.test(dateExact)) {
      dateFilter.equals = dateExact;
    } else {
      if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) dateFilter.gte = from;
      if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) dateFilter.lte = to;
    }

    const rows = await prisma.workoutSession.findMany({
      where: {
        userId: session.user.id,
        ...(dateFilter.equals
          ? { date: dateFilter.equals }
          : dateFilter.gte || dateFilter.lte
            ? {
                date: {
                  ...(dateFilter.gte ? { gte: dateFilter.gte } : {}),
                  ...(dateFilter.lte ? { lte: dateFilter.lte } : {}),
                },
              }
            : {}),
        ...(groups
          ? { muscles: { some: { groupKey: { in: groups } } } }
          : {}),
      },
      include: sessionInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    // Broader history so PR badges compare against prior sessions, not only the page window.
    const prHistory = await prisma.workoutSession.findMany({
      where: { userId: session.user.id },
      include: sessionInclude,
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      take: 120,
    });
    const prCounts = countPrsBySessionId(
      prHistory.map((row) => ({
        id: row.id,
        date: row.date,
        createdAt: row.createdAt,
        exercises: row.exercises.map((ex) => ({
          name: ex.name,
          kind: ex.kind,
          sets: ex.sets,
        })),
      })),
    );

    const latestWeight = await prisma.weightEntry.findFirst({
      where: { userId: session.user.id },
      orderBy: weightEntryOrderNewestFirst,
      select: { weightKg: true },
    });
    const bodyWeightKg =
      latestWeight?.weightKg != null && latestWeight.weightKg > 0 ? latestWeight.weightKg : null;

    let sessions = rows.map((row) => {
      const energy = estimateDbSessionEnergy(row, bodyWeightKg);
      return {
        ...serializeSessionSummary(row),
        prCount: prCounts.get(row.id) ?? 0,
        energy,
        energyLabel: formatSessionEnergyLine(energy),
      };
    });
    if (cardioOnly) {
      sessions = sessions.filter((s) => s.cardioOnly || s.muscleKeys.includes("cardio"));
    }

    return NextResponse.json({ sessions, bodyWeightKg });
  } catch (error) {
    console.error("GET /api/workouts", error);
    return NextResponse.json({ error: "Не удалось загрузить тренировки" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response) return response;

    const body = (await request.json()) as {
      date?: string;
      muscleGroups?: unknown;
      note?: string | null;
      progressRate?: unknown;
    };

    const date = requireDateKey(body.date ?? null);
    if (!date) {
      return NextResponse.json({ error: "Укажите дату" }, { status: 400 });
    }

    const muscleGroups = parseMuscleGroupKeys(body.muscleGroups);
    if (!muscleGroups) {
      return NextResponse.json({ error: "Выберите хотя бы одну группу мышц" }, { status: 400 });
    }

    const note =
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 200)
        : null;
    const progressRate = parseProgressRate(body.progressRate);

    const created = await prisma.workoutSession.create({
      data: {
        userId: session.user.id,
        date,
        note,
        progressRate,
        muscles: {
          create: muscleGroups.map((groupKey) => ({ groupKey })),
        },
      },
      include: sessionInclude,
    });

    const summary = serializeSessionSummary(created);
    const progress = await progressFor(
      session.user.id,
      muscleGroups,
      summary.totalLoad,
      progressRate,
      summary.id,
    );

    return NextResponse.json({ session: summary, progress }, { status: 201 });
  } catch (error) {
    console.error("POST /api/workouts", error);
    return NextResponse.json({ error: "Не удалось создать тренировку" }, { status: 500 });
  }
}
