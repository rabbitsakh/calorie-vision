import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { exportAttachment, exportFailed, readExportQuery } from "@/lib/export/http";
import { loadUserExportTimezone, loadWorkoutSessions } from "@/lib/export/load";
import { buildWorkoutCsv } from "@/lib/workouts/export-csv";
import { workoutExportFilename } from "@/lib/workouts/export-href";
import { buildWorkoutPdf } from "@/lib/workouts/export-pdf";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response || !session?.user?.id) {
      return response ?? NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });
    }

    const { format, from, to } = readExportQuery(request);
    const timezone = await loadUserExportTimezone(session.user.id);
    const sessions = await loadWorkoutSessions(session.user.id, from, to);

    if (format === "pdf") {
      const pdf = await buildWorkoutPdf({ sessions, timezone, from, to });
      return exportAttachment(pdf, "application/pdf", workoutExportFilename("pdf", from, to));
    }

    const csv = buildWorkoutCsv(sessions, timezone);
    return exportAttachment(csv, "text/csv; charset=utf-8", workoutExportFilename("csv", from, to));
  } catch (error) {
    console.error(error);
    return exportFailed();
  }
}
