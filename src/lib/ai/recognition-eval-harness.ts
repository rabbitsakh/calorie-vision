import type { RecognitionEvalCase } from "./recognition-eval-fixtures.ts";
import { parseFoodRecognitionResponse } from "./parse-response.ts";
import { getRecognitionRetryReason, shouldRetryFoodRecognition } from "./recognition-retry.ts";

export type EvalCaseResult = {
  id: string;
  passed: boolean;
  errors: string[];
};

export function evaluateRecognitionCase(fixture: RecognitionEvalCase): EvalCaseResult {
  const errors: string[] = [];

  let parsed;
  try {
    parsed = parseFoodRecognitionResponse(fixture.rawModelJson);
  } catch (error) {
    return {
      id: fixture.id,
      passed: false,
      errors: [error instanceof Error ? error.message : "parse failed"],
    };
  }

  const expect = fixture.expect;

  if (expect.dishNameIncludes && !new RegExp(expect.dishNameIncludes, "i").test(parsed.dishName)) {
    errors.push(`dishName "${parsed.dishName}" missing "${expect.dishNameIncludes}"`);
  }
  if (expect.photoKind && parsed.photoKind !== expect.photoKind) {
    errors.push(`photoKind ${parsed.photoKind} !== ${expect.photoKind}`);
  }
  if (expect.minItems !== undefined && (parsed.items?.length ?? 0) < expect.minItems) {
    errors.push(`items ${parsed.items?.length ?? 0} < ${expect.minItems}`);
  }
  if (expect.minCalories !== undefined && parsed.calories < expect.minCalories) {
    errors.push(`calories ${parsed.calories} < ${expect.minCalories}`);
  }
  if (expect.shouldRetry !== undefined) {
    const retry = shouldRetryFoodRecognition(parsed);
    if (retry !== expect.shouldRetry) {
      errors.push(
        `shouldRetry ${retry} !== ${expect.shouldRetry} (reason=${getRecognitionRetryReason(parsed) ?? "none"})`,
      );
    }
  }

  return { id: fixture.id, passed: errors.length === 0, errors };
}

export function runRecognitionEvalSuite(cases: RecognitionEvalCase[]): {
  passed: number;
  failed: number;
  results: EvalCaseResult[];
} {
  const results = cases.map(evaluateRecognitionCase);
  const failed = results.filter((result) => !result.passed).length;
  return {
    passed: results.length - failed,
    failed,
    results,
  };
}
