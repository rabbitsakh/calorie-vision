import { NextResponse } from "next/server";
import { readPackageVersion } from "@/lib/read-package-version";

export const dynamic = "force-dynamic";

/** Liveness probe for deploy and monitoring (no auth). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "calorie-vision",
    version: readPackageVersion(),
  });
}
