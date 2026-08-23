/**
 * Short supermarket-style scanner chirp via Web Audio (no asset).
 * Safe no-op when AudioContext is unavailable (SSR / Node / blocked autoplay).
 */
export function playScannerBeep(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) {
      return;
    }

    const ctx = new AC();
    const now = ctx.currentTime;

    const chirp = (start: number, frequency: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      // Square wave reads closer to a handheld/POS scanner than a sine.
      osc.type = "square";
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    };

    // Classic double beep: short pulse, short gap, slightly longer pulse.
    chirp(now, 2700, 0.06);
    chirp(now + 0.085, 2700, 0.09);

    void ctx.resume();
    window.setTimeout(() => {
      void ctx.close();
    }, 350);
  } catch {
    // Autoplay policy / unsupported — ignore.
  }

  try {
    navigator.vibrate?.(35);
  } catch {
    // ignore
  }
}
