import { NextResponse } from "next/server";
import { buildAssetLinksDocument, parseTwaSha256Fingerprints } from "@/lib/twa-assetlinks";

export const dynamic = "force-dynamic";

/**
 * Digital Asset Links for the RuStore TWA (package ru.calorievision.app).
 * Env: TWA_SHA256_FINGERPRINTS (colon-hex, comma/space separated),
 * optional TWA_PACKAGE_NAME (default ru.calorievision.app).
 */
export async function GET() {
  const packageName = process.env.TWA_PACKAGE_NAME?.trim() || "ru.calorievision.app";
  const fingerprints = parseTwaSha256Fingerprints(process.env.TWA_SHA256_FINGERPRINTS);

  if (fingerprints.length === 0) {
    return NextResponse.json(
      {
        error:
          "TWA_SHA256_FINGERPRINTS не задан — добавьте SHA-256 сертификата подписи (см. rustore/README.md)",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  }

  const body = buildAssetLinksDocument(packageName, fingerprints);
  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
