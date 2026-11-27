/**
 * Chest-open cues only. Web Audio, no asset files.
 * Default is on. Profile toggle `chestSound` in localStorage turns it off.
 * Other celebrations keep their own quiet switch.
 */

import { toDateKey } from "@/lib/dates";
import { isSoftCelebrationsMutedToday } from "@/lib/soft-celebration";

const STORAGE_KEY = "chestSound";

export type ChestCue = "tap" | "rise" | "open" | "reward";

let audio: AudioContext | null = null;

export function readChestSoundPref(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function isChestSoundEnabled(): boolean {
  if (!readChestSoundPref()) return false;
  return !isSoftCelebrationsMutedToday(toDateKey(new Date()));
}

export function setChestSoundEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    // private mode
  }
}

function context(): AudioContext | null {
  if (!isChestSoundEnabled()) return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audio || audio.state === "closed") audio = new AC();
  void audio.resume();
  return audio;
}

function tone(
  ctx: AudioContext,
  start: number,
  frequency: number,
  duration: number,
  gainPeak: number,
  type: OscillatorType = "sine",
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainPeak), start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playChestCue(kind: ChestCue): void {
  try {
    const ctx = context();
    if (ctx) {
      const now = ctx.currentTime;
      if (kind === "tap") {
        tone(ctx, now, 180, 0.05, 0.05, "square");
        tone(ctx, now, 640, 0.07, 0.04);
      } else if (kind === "rise") {
        tone(ctx, now, 392, 0.08, 0.05);
        tone(ctx, now + 0.08, 494, 0.09, 0.06);
        tone(ctx, now + 0.16, 587, 0.12, 0.07, "triangle");
      } else if (kind === "open") {
        tone(ctx, now, 523, 0.12, 0.07, "triangle");
        tone(ctx, now + 0.08, 659, 0.14, 0.08, "triangle");
        tone(ctx, now + 0.16, 784, 0.22, 0.09, "triangle");
      } else {
        tone(ctx, now, 523, 0.1, 0.06);
        tone(ctx, now + 0.1, 659, 0.12, 0.07);
        tone(ctx, now + 0.2, 784, 0.14, 0.08, "triangle");
        tone(ctx, now + 0.32, 1046, 0.22, 0.07, "triangle");
      }
    }
  } catch {
    // autoplay or unsupported
  }

  try {
    if (!isChestSoundEnabled()) return;
    if (kind === "tap") navigator.vibrate?.([16, 28, 22]);
    else if (kind === "rise") navigator.vibrate?.([18, 30, 26, 36, 30]);
    else if (kind === "open") navigator.vibrate?.([26, 40, 30, 70, 46]);
    else navigator.vibrate?.([14, 24, 16]);
  } catch {
    // ignore
  }
}

export function stopChestAudio(): void {
  const current = audio;
  audio = null;
  if (current && current.state !== "closed") void current.close();
}
