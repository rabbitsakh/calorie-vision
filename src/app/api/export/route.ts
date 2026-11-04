import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { buildDiaryCsv, buildDiaryPdf } from "@/lib/export/diary";
import { exportAttachment, exportFailed, readExportQuery } from "@/lib/export/http";
import { loadDiaryEntries, loadUserExportTimezone } from "@/lib/export/load";
import { exportDownloadName } from "@/lib/export/paths";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response || !session?.user?.id) {
      return response ?? NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });
    }

    const { format, from, to } = readExportQuery(request);
    const timezone = await loadUserExportTimezone(session.user.id);
    const entries = await loadDiaryEntries(session.user.id, from, to);

    if (format === "pdf") {
      const pdf = await buildDiaryPdf({ entries, timezone, from, to });
      return exportAttachment(pdf, "application/pdf", exportDownloadName("ration", "pdf", from, to));
    }

    const csv = buildDiaryCsv(entries, timezone);
    return exportAttachment(csv, "text/csv; charset=utf-8", exportDownloadName("ration", "csv", from, to));
  } catch (error) {
    console.error(error);
    return exportFailed();
  }
}
