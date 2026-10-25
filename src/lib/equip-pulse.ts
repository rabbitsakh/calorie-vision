/**
 * Chests 2.0 C2 — brief «новое» pulse after equip (auto or «Надеть»).
 */

export type EquipPulseKind = "sticker" | "frame" | "cheer";

export type EquipPulseDetail = {
  kind: EquipPulseKind;
  rewardKey: string;
};

export const EQUIP_PULSE_EVENT = "cv-equip-pulse";
/** Visible pulse window on avatar / DayHero / diary sticker. */
export const EQUIP_PULSE_MS = 2000;

type Listener = (detail: EquipPulseDetail) => void;

/** In-process bus (works in Node tests and the browser). */
const listeners = new Set<Listener>();

export function emitEquipPulse(kind: EquipPulseKind, rewardKey: string): void {
  const key = rewardKey.trim();
  if (!key) return;
  const detail: EquipPulseDetail = { kind, rewardKey: key };
  for (const listener of listeners) {
    try {
      listener(detail);
    } catch {
      // ignore listener errors
    }
  }
  try {
    const w = (globalThis as { window?: Window }).window;
    w?.dispatchEvent(new CustomEvent<EquipPulseDetail>(EQUIP_PULSE_EVENT, { detail }));
  } catch {
    // ignore
  }
}

export function subscribeEquipPulse(
  listener: (detail: EquipPulseDetail) => void,
  kind?: EquipPulseKind,
): () => void {
  const filtered: Listener = (detail) => {
    if (kind && detail.kind !== kind) return;
    listener(detail);
  };
  listeners.add(filtered);
  return () => {
    listeners.delete(filtered);
  };
}
