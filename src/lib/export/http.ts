import { NextRequest, NextResponse } from "next/server";
import { requireDateKey } from "@/lib/dates";

export function readExportQuery(request: NextRequest): {
  format: string;
  from: string | null;
  to: string | null;
} {
  return {
    format: (request.nextUrl.searchParams.get("format") ?? "csv").trim().toLowerCase(),
    from: requireDateKey(request.nextUrl.searchParams.get("from")),
    to: requireDateKey(request.nextUrl.searchParams.get("to")),
  };
}

export function exportAttachment(
  body: string | Buffer,
  contentType: string,
  filename: string,
): NextResponse {
  const payload = typeof body === "string" ? body : new Uint8Array(body);
  return new NextResponse(payload, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function exportFailed(): NextResponse {
  return NextResponse.json({ error: "Ошибка экспорта" }, { status: 500 });
}
