import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-session";
import { exportAttachment, exportFailed, readExportQuery } from "@/lib/export/http";
import { loadUserExportTimezone, loadWeightEntries } from "@/lib/export/load";
import { exportDownloadName } from "@/lib/export/paths";
import { buildWeightCsv, buildWeightPdf } from "@/lib/export/weight";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, response } = await requireSession();
    if (response || !session?.user?.id) {
      return response ?? NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });
    }

    const { format, from, to } = readExportQuery(request);
    const timezone = await loadUserExportTimezone(session.user.id);
    const entries = await loadWeightEntries(session.user.id, from, to);

    if (format === "pdf") {
      const pdf = await buildWeightPdf({ entries, timezone, from, to });
      return exportAttachment(pdf, "application/pdf", exportDownloadName("weight", "pdf", from, to));
    }

    const csv = buildWeightCsv(entries, timezone);
    return exportAttachment(csv, "text/csv; charset=utf-8", exportDownloadName("weight", "csv", from, to));
  } catch (error) {
    console.error(error);
    return exportFailed();
  }
}
