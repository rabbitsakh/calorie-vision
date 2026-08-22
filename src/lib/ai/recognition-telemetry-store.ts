import type { RecognitionPassEvent } from "@/lib/ai/recognition-telemetry";
import { prisma } from "@/lib/prisma";

const RETENTION_DAYS = 30;

function persistEnabled(): boolean {
  return process.env.RECOGNITION_TELEMETRY_PERSIST !== "0";
}

/** Fire-and-forget DB write for admin dashboards. */
export async function persistRecognitionPassEvent(event: RecognitionPassEvent): Promise<void> {
  if (!persistEnabled()) {
    return;
  }

  await prisma.recognitionPassLog.create({
    data: {
      pass: event.pass,
      photoKind: event.photoKind?.slice(0, 32) ?? null,
      retryReason: event.retryReason?.slice(0, 32) ?? null,
      specialistPass: event.specialistPass?.slice(0, 16) ?? null,
      itemCount: event.itemCount,
      calories: Math.round(event.calories),
      confidence: event.confidence,
      dishName: event.dishName?.slice(0, 80) ?? null,
      source: event.source?.slice(0, 64) ?? null,
      chatCalls: event.chatCalls ?? null,
      latencyMs: event.latencyMs ?? null,
      enrichmentTimedOut: event.enrichmentTimedOut ?? false,
    },
  });

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.recognitionPassLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
}
