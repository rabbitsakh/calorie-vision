import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { buildAllPdf, buildAllZip } from "@/lib/export/bundle";
import { exportAttachment, exportFailed, readExportQuery } from "@/lib/export/http";
import {
  loadDiaryEntries,
  loadUserExportTimezone,
  loadWeightEntries,
  loadWorkoutSessions,
} from "@/lib/export/load";
import { exportDownloadName } from "@/lib/export/paths";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response || !session?.user?.id) {
      return response ?? NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });
    }

    const { format, from, to } = readExportQuery(request);
    if (format !== "csv" && format !== "zip" && format !== "pdf") {
      return NextResponse.json({ error: "Неизвестный формат" }, { status: 400 });
    }

    const userId = session.user.id;
    const [timezone, meals, sessions, weights] = await Promise.all([
      loadUserExportTimezone(userId),
      loadDiaryEntries(userId, from, to),
      loadWorkoutSessions(userId, from, to),
      loadWeightEntries(userId, from, to),
    ]);

    if (format === "pdf") {
      const pdf = await buildAllPdf({ meals, sessions, weights, timezone, from, to });
      return exportAttachment(pdf, "application/pdf", exportDownloadName("all", "pdf", from, to));
    }

    const zip = buildAllZip({ meals, sessions, weights, timezone });
    return exportAttachment(zip, "application/zip", exportDownloadName("all", "zip", from, to));
  } catch (error) {
    console.error(error);
    return exportFailed();
  }
}
