import fs from "node:fs/promises";
import path from "node:path";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { recognizeWithGigaChat } from "@/lib/ai/gigachat";
import { normalizeRecognitionNutrition } from "@/lib/recognition-nutrition";

/** Put golden photos in repo-root `eval-fixtures/` (gitignored binary assets). */
export const EVAL_FIXTURES_DIR = path.join(process.cwd(), "eval-fixtures");

export type LiveRecognitionEvalCase = {
  id: string;
  description: string;
  /** File name inside eval-fixtures/ (e.g. plate-borscht.jpg) */
  imageFile: string;
  expect: {
    dishNameIncludes?: string;
    photoKind?: string;
    minCalories?: number;
  };
};

/** Small starter set — enable with RECOGNITION_LIVE_EVAL=1 once photos are added. */
export const LIVE_RECOGNITION_EVAL_CASES: LiveRecognitionEvalCase[] = [
  {
    id: "live-plate-borscht",
    description: "Plate photo — borscht",
    imageFile: "plate-borscht.jpg",
    expect: { dishNameIncludes: "борщ", minCalories: 150 },
  },
  {
    id: "live-label-yogurt",
    description: "Label photo — yogurt",
    imageFile: "label-yogurt.jpg",
    expect: { photoKind: "label", minCalories: 50 },
  },
  {
    id: "live-drink-bottle",
    description: "Drink bottle label",
    imageFile: "drink-bottle.jpg",
    expect: { dishNameIncludes: "пиво|кола|напиток|молоко", minCalories: 20 },
  },
];

export type LiveEvalCaseResult = {
  id: string;
  passed: boolean;
  skipped: boolean;
  skipReason?: string;
  errors: string[];
  latencyMs?: number;
};

export function liveEvalEnabled(): boolean {
  return (
    process.env.RECOGNITION_LIVE_EVAL === "1" &&
    Boolean(process.env.GIGACHAT_CREDENTIALS?.trim())
  );
}

function dishNameMatches(pattern: string, dishName: string): boolean {
  return new RegExp(pattern, "i").test(dishName);
}

function evaluateLiveResult(
  fixture: LiveRecognitionEvalCase,
  result: FoodRecognitionResult,
): string[] {
  const errors: string[] = [];
  const expect = fixture.expect;

  if (expect.dishNameIncludes && !dishNameMatches(expect.dishNameIncludes, result.dishName)) {
    errors.push(`dishName "${result.dishName}" missing /${expect.dishNameIncludes}/`);
  }
  if (expect.photoKind && result.photoKind !== expect.photoKind) {
    errors.push(`photoKind ${result.photoKind} !== ${expect.photoKind}`);
  }
  if (expect.minCalories !== undefined && result.calories < expect.minCalories) {
    errors.push(`calories ${result.calories} < ${expect.minCalories}`);
  }

  return errors;
}

export async function runLiveRecognitionEvalCase(
  fixture: LiveRecognitionEvalCase,
): Promise<LiveEvalCaseResult> {
  const imagePath = path.join(EVAL_FIXTURES_DIR, fixture.imageFile);

  try {
    await fs.access(imagePath);
  } catch {
    return {
      id: fixture.id,
      passed: true,
      skipped: true,
      skipReason: `missing image ${fixture.imageFile}`,
      errors: [],
    };
  }

  if (!liveEvalEnabled()) {
    return {
      id: fixture.id,
      passed: true,
      skipped: true,
      skipReason: "RECOGNITION_LIVE_EVAL=1 and GIGACHAT_CREDENTIALS required",
      errors: [],
    };
  }

  const startedAt = Date.now();
  try {
    const buffer = await fs.readFile(imagePath);
    const vision = await recognizeWithGigaChat(buffer, fixture.imageFile);
    const normalized = normalizeRecognitionNutrition(vision);
    const errors = evaluateLiveResult(fixture, normalized);

    return {
      id: fixture.id,
      passed: errors.length === 0,
      skipped: false,
      errors,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      id: fixture.id,
      passed: false,
      skipped: false,
      errors: [error instanceof Error ? error.message : "live eval failed"],
      latencyMs: Date.now() - startedAt,
    };
  }
}

export async function runLiveRecognitionEvalSuite(cases: LiveRecognitionEvalCase[]): Promise<{
  passed: number;
  failed: number;
  skipped: number;
  results: LiveEvalCaseResult[];
}> {
  const results: LiveEvalCaseResult[] = [];

  for (const fixture of cases) {
    results.push(await runLiveRecognitionEvalCase(fixture));
  }

  const actionable = results.filter((result) => !result.skipped);
  const failed = actionable.filter((result) => !result.passed).length;
  const skipped = results.filter((result) => result.skipped).length;

  return {
    passed: actionable.length - failed,
    failed,
    skipped,
    results,
  };
}
