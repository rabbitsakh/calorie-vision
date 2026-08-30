/**
 * Soft celebration chimes + haptic (Duolingo-like reward feedback).
 * Web Audio only — no asset files. Safe no-op when AudioContext unavailable.
 */

export type CelebrationChimeKind = "cheer" | "streak" | "goal" | "badge" | "soft" | "chest";

function canPlay(): boolean {
  return typeof window !== "undefined";
}

function tone(
  ctx: AudioContext,
  start: number,
  frequency: number,
  duration: number,
  gainPeak = 0.09,
  type: OscillatorType = "sine",
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

export function playCelebrationChime(kind: CelebrationChimeKind = "cheer"): void {
  if (!canPlay()) return;

  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;

    const ctx = new AC();
    const now = ctx.currentTime;

    if (kind === "streak") {
      tone(ctx, now, 523.25, 0.12, 0.08);
      tone(ctx, now + 0.1, 659.25, 0.12, 0.09);
      tone(ctx, now + 0.2, 783.99, 0.18, 0.1);
    } else if (kind === "goal") {
      tone(ctx, now, 392, 0.1, 0.07);
      tone(ctx, now + 0.09, 523.25, 0.12, 0.08);
      tone(ctx, now + 0.2, 659.25, 0.2, 0.1);
    } else if (kind === "badge") {
      tone(ctx, now, 587.33, 0.1, 0.08, "triangle");
      tone(ctx, now + 0.12, 880, 0.22, 0.1, "triangle");
    } else if (kind === "soft") {
      tone(ctx, now, 660, 0.08, 0.06);
      tone(ctx, now + 0.07, 880, 0.1, 0.05);
    } else if (kind === "chest") {
      // Warm ascending loot fanfare
      tone(ctx, now, 329.63, 0.07, 0.05);
      tone(ctx, now + 0.07, 440, 0.09, 0.06);
      tone(ctx, now + 0.14, 554.37, 0.11, 0.07, "triangle");
      tone(ctx, now + 0.24, 659.25, 0.14, 0.08, "triangle");
      tone(ctx, now + 0.36, 880, 0.2, 0.09, "triangle");
    } else {
      // cheer — short fanfare
      tone(ctx, now, 523.25, 0.1, 0.08);
      tone(ctx, now + 0.08, 659.25, 0.1, 0.09);
      tone(ctx, now + 0.16, 783.99, 0.16, 0.1);
    }

    void ctx.resume();
    window.setTimeout(() => {
      void ctx.close();
    }, 600);
  } catch {
    // autoplay / unsupported
  }

  try {
    if (kind === "chest") {
      navigator.vibrate?.([14, 28, 14, 36, 20]);
    } else if (kind === "streak" || kind === "badge") {
      navigator.vibrate?.([18, 40, 18]);
    } else if (kind === "soft") {
      navigator.vibrate?.(10);
    } else {
      navigator.vibrate?.(22);
    }
  } catch {
    // ignore
  }
}
