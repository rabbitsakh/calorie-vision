"use client";

import { useEffect, useState } from "react";
import { readChestSoundPref, setChestSoundEnabled } from "@/lib/chest-sfx";
import { isGamificationQuiet, setGamificationQuiet } from "@/lib/gamification-quiet";

/**
 * Profile toggle: soft mode — fewer fullscreen celebrations and quieter save cheer.
 * Backed by existing `gamificationQuiet` localStorage flag.
 */
export function GamificationQuietToggle() {
  const [quiet, setQuiet] = useState(false);
  const [chestSound, setChestSound] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setQuiet(isGamificationQuiet());
    setChestSound(readChestSoundPref());
    setReady(true);
  }, []);

  function handleChange(next: boolean) {
    setQuiet(next);
    setGamificationQuiet(next);
  }

  return (
    <section className="profile-settings__nested p-4 md:p-5">
      <h2 className="text-base font-semibold text-[var(--foreground)]">Празднования</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        По умолчанию тихо: без полноэкранных сцен. Сундуки и награды всё равно
        начисляются — короткий тост и запись в коллекции.
      </p>
      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-[rgba(13,115,119,0.22)] text-[var(--accent)] focus:ring-[var(--accent)]"
          checked={!quiet}
          disabled={!ready}
          onChange={(event) => handleChange(!event.target.checked)}
        />
        <span>
          <span className="block text-sm font-medium text-[var(--foreground)]">Показывать празднования</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            Полноэкранные сцены и звуки при вехах. Награды открываются в любом режиме.
          </span>
        </span>
      </label>
      <label className="mt-4 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-[rgba(13,115,119,0.22)] text-[var(--accent)] focus:ring-[var(--accent)]"
          checked={chestSound}
          disabled={!ready}
          onChange={(event) => {
            const next = event.target.checked;
            setChestSound(next);
            setChestSoundEnabled(next);
          }}
        />
        <span>
          <span className="block text-sm font-medium text-[var(--foreground)]">Звук сундука</span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            Тап, открытие и награда. Включён отдельно от остальных празднований.
          </span>
        </span>
      </label>
    </section>
  );
}
