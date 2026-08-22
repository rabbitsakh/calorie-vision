import { NextRequest, NextResponse } from "next/server";
import {
  LIVE_RECOGNITION_EVAL_CASES,
  liveEvalEnabled,
  runLiveRecognitionEvalSuite,
} from "@/lib/ai/recognition-live-eval";

export const dynamic = "force-dynamic";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Optional live golden eval — requires RECOGNITION_LIVE_EVAL=1, GIGACHAT_CREDENTIALS,
 * and photos in repo-root eval-fixtures/. Skips missing images without failing the run.
 */
export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runLiveRecognitionEvalSuite(LIVE_RECOGNITION_EVAL_CASES);
  const failures = summary.results
    .filter((result) => !result.skipped && !result.passed)
    .map((result) => ({
      id: result.id,
      errors: result.errors,
      latencyMs: result.latencyMs,
    }));

  if (summary.failed > 0) {
    console.error(
      "Live recognition eval regression:",
      JSON.stringify({ failed: summary.failed, failures }),
    );
  }

  return NextResponse.json({
    ok: summary.failed === 0,
    enabled: liveEvalEnabled(),
    passed: summary.passed,
    failed: summary.failed,
    skipped: summary.skipped,
    total: summary.results.length,
    failures,
    ranAt: new Date().toISOString(),
  });
}
