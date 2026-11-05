/**
 * Явно сломанная длительность старых тренировок.
 * Ориентир — время подходов. Сомнительные интервалы не трогаем.
 * Ручная правка (endedBy = manual) сохраняется.
 */

export type DurationSample = {
  id: string;
  startedAt: Date | null;
  endedAt: Date | null;
  endedBy?: string | null;
  setTimes: readonly Date[];
};

export type RepairDecision =
  | { id: string; action: "skip"; reason: string }
  | {
      id: string;
      action: "uncertain";
      reason: string;
      proposedStart: string;
      proposedEnd: string;
    }
  | {
      id: string;
      action: "fix";
      reason: string;
      startedAt: Date;
      endedAt: Date;
    };

const SHORT_MS = 90 * 1000;
const LONG_MS = 180 * 60 * 1000;
const MIN_SPAN_MS = 5 * 60 * 1000;

function spanOf(times: readonly Date[]): { first: Date; last: Date; span: number } | null {
  const sorted = [...times]
    .filter((d) => d instanceof Date && Number.isFinite(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (sorted.length === 0) return null;
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  return { first, last, span: last.getTime() - first.getTime() };
}

function currentDurationMs(sample: DurationSample, now: Date): number | null {
  if (!sample.startedAt) return null;
  const end = sample.endedAt ?? now;
  return Math.max(0, end.getTime() - sample.startedAt.getTime());
}

export function decideDurationRepair(sample: DurationSample, now = new Date()): RepairDecision {
  if (sample.endedBy === "manual") {
    return { id: sample.id, action: "skip", reason: "время задано вручную" };
  }
  const span = spanOf(sample.setTimes);
  if (!span) {
    return { id: sample.id, action: "skip", reason: "нет подходов" };
  }
  if (span.span > LONG_MS) {
    return {
      id: sample.id,
      action: "uncertain",
      reason: "подходы растянуты дольше 3 часов",
      proposedStart: span.first.toISOString(),
      proposedEnd: span.last.toISOString(),
    };
  }

  const duration = currentDurationMs(sample, now);
  const proposedSame =
    sample.startedAt != null &&
    sample.endedAt != null &&
    Math.abs(sample.startedAt.getTime() - span.first.getTime()) < 60_000 &&
    Math.abs(sample.endedAt.getTime() - span.last.getTime()) < 60_000;
  if (proposedSame) {
    return { id: sample.id, action: "skip", reason: "уже совпадает с подходами" };
  }

  const forgottenOpen =
    sample.endedAt == null &&
    sample.startedAt != null &&
    now.getTime() - sample.startedAt.getTime() > LONG_MS;
  const neverStarted = sample.startedAt == null;
  const tooShort = duration != null && duration < SHORT_MS && span.span >= MIN_SPAN_MS;
  const tooLong =
    duration != null && duration > LONG_MS && span.span <= LONG_MS;

  if (tooShort) {
    return {
      id: sample.id,
      action: "fix",
      reason: "длительность короче 90 секунд, а подходы идут дольше 5 минут",
      startedAt: span.first,
      endedAt: span.last,
    };
  }
  if (tooLong || forgottenOpen) {
    return {
      id: sample.id,
      action: "fix",
      reason: forgottenOpen
        ? "тренировка не завершена и висит дольше 3 часов"
        : "длительность больше 3 часов при более короткой серии подходов",
      startedAt: span.first,
      endedAt: span.last,
    };
  }
  if (neverStarted && span.span <= LONG_MS) {
    return {
      id: sample.id,
      action: "fix",
      reason: "есть подходы, но часы так и не запущены",
      startedAt: span.first,
      endedAt: span.last,
    };
  }
  return { id: sample.id, action: "skip", reason: "длительность выглядит правдоподобно" };
}
