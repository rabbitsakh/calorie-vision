"use client";

import { useEffect, useState } from "react";
import { isGamificationQuiet, setGamificationQuiet } from "@/lib/gamification-quiet";

/**
 * Profile toggle: soft mode — fewer fullscreen celebrations and quieter save cheer.
 * Backed by existing `gamificationQuiet` localStorage flag.
 */
export function GamificationQuietToggle() {
  const [quiet, setQuiet] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setQuiet(isGamificationQuiet());
    setReady(true);
  }, []);

  function handleChange(next: boolean) {
    setQuiet(next);
    setGamificationQuiet(next);
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-hairline)] bg-white p-4 md:p-5">
      <h2 className="text-base font-semibold text-[var(--foreground)]">Празднования</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        По умолчанию тихо: тосты вместо полноэкранных сцен. Можно включить обратно.
      </p>
      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-[rgba(13,115,119,0.22)] text-teal-600 focus:ring-teal-500"
          checked={!quiet}
          disabled={!ready}
          onChange={(event) => handleChange(!event.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-[var(--foreground)]">Показывать празднования</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            Полноэкранные сцены, сундуки и звуки при вехах.
          </span>
        </span>
      </label>
    </section>
  );
}
