import { NextRequest, NextResponse } from "next/server";
import { RECOGNITION_EVAL_CASES } from "@/lib/ai/recognition-eval-fixtures";
import { runRecognitionEvalSuite } from "@/lib/ai/recognition-eval-harness";

export const dynamic = "force-dynamic";

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** Nightly offline recognition fixture eval — no live GigaChat calls. */
export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = runRecognitionEvalSuite(RECOGNITION_EVAL_CASES);
  const failures = summary.results
    .filter((result) => !result.passed)
    .map((result) => ({
      id: result.id,
      errors: result.errors,
    }));

  if (summary.failed > 0) {
    console.error(
      "Recognition eval regression:",
      JSON.stringify({ failed: summary.failed, failures }),
    );
  }

  return NextResponse.json({
    ok: summary.failed === 0,
    passed: summary.passed,
    failed: summary.failed,
    total: summary.results.length,
    failures,
    ranAt: new Date().toISOString(),
  });
}
