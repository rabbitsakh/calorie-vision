import { NextResponse } from "next/server";
import { getRecognitionLowConfidenceThreshold } from "@/lib/ai/recognition-thresholds";
import { loadLowConfidenceThresholdFromDb } from "@/lib/recognition-threshold-store";
import { requireSession } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const { response } = await requireSession();
  if (response) {
    return response;
  }

  await loadLowConfidenceThresholdFromDb();

  return NextResponse.json({
    lowConfidenceThreshold: getRecognitionLowConfidenceThreshold(),
  });
}
