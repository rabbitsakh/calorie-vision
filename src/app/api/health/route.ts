import { NextResponse } from "next/server";
import { readPackageVersion } from "@/lib/read-package-version";

export const dynamic = "force-dynamic";

/**
 * Liveness probe for deploy, monitoring, and APK connectivity checks.
 * CORS * — Capacitor shell probes from https://localhost / capacitor origin.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "calorie-vision",
      version: readPackageVersion(),
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}
