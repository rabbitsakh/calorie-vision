/** Block structure for live logging beyond a plain list. */
export const BLOCK_MODES = ["normal", "circuit", "rest_pause"] as const;
export type BlockMode = (typeof BLOCK_MODES)[number];

export const BLOCK_MODE_LABELS: Record<BlockMode, string> = {
  normal: "Обычный",
  circuit: "Круг",
  rest_pause: "Rest-pause",
};

export function isBlockMode(value: unknown): value is BlockMode {
  return typeof value === "string" && (BLOCK_MODES as readonly string[]).includes(value);
}

export function parseBlockMode(raw: unknown, fallback: BlockMode = "normal"): BlockMode {
  if (isBlockMode(raw)) return raw;
  return fallback;
}

export function parseCircuitRounds(raw: unknown, fallback = 3): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(20, Math.max(1, Math.round(n)));
}

/** Short rest after a rest-pause mini-set (seconds). */
export const REST_PAUSE_SEC = 20;

/** Default rest between circuit rounds (seconds). */
export const CIRCUIT_ROUND_REST_SEC = 90;
