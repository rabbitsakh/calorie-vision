import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import {
  buildProgressSummary,
  findPreviousSession,
  parseProgressRate,
  type SessionLikeForProgress,
} from "@/lib/workouts/load";
import { parseMuscleGroupKeys } from "@/lib/workouts/muscle-groups";
import { serializeSessionSummary, sessionInclude } from "@/lib/workouts/serialize";

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

/** Preview progressive target for selected muscle groups (before / while creating a session). */
export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireAdmin();
    if (response) return response;

    const groupsRaw = request.nextUrl.searchParams.get("groups");
    const groups = parseMuscleGroupKeys(
      groupsRaw ? groupsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [],
    );
    if (!groups) {
      return NextResponse.json({ error: "Укажите groups=chest,triceps" }, { status: 400 });
    }

    const excludeSessionId = request.nextUrl.searchParams.get("exclude") ?? undefined;
    const progressRate = parseProgressRate(request.nextUrl.searchParams.get("rate"));

    const history = await prisma.workoutSession.findMany({
      where: { userId: session.user.id },
      include: sessionInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 60,
    });

    const prev = findPreviousSession(toProgressRows(history.map(serializeSessionSummary)), groups, {
      excludeSessionId,
    });

    const progress = buildProgressSummary({
      targetGroups: groups,
      currentLoad: 0,
      previous: prev,
      progressRate,
    });

    return NextResponse.json({ muscleKeys: groups, progress });
  } catch (error) {
    console.error("GET /api/workouts/progress", error);
    return NextResponse.json({ error: "Не удалось посчитать прогрессию" }, { status: 500 });
  }
}
