"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SoftCelebration } from "@/components/SoftCelebration";
import { withBasePath } from "@/lib/paths";
import {
  isSoftCelebrationSeen,
  markSoftCelebrationSeen,
} from "@/lib/soft-celebration";

type CheckinDoneCelebrationProps = {
  today: string;
  selectedDate: string;
  refreshKey: number;
};

/** Fires once when the user completes the evening mood check-in. */
export function CheckinDoneCelebration({
  today,
  selectedDate,
  refreshKey,
}: CheckinDoneCelebrationProps) {
  const [open, setOpen] = useState(false);
  const prevHasMood = useRef<boolean | null>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (selectedDate !== today) return;

    void (async () => {
      try {
        const resp = await fetch(withBasePath(`/api/diary-note?date=${encodeURIComponent(today)}`));
        if (!resp.ok) return;
        const data = (await resp.json()) as { note: { mood: number | null } | null };
        const hasMood = data.note?.mood != null;

        if (
          prevHasMood.current === false &&
          hasMood &&
          !isSoftCelebrationSeen("checkin-done", today)
        ) {
          markSoftCelebrationSeen("checkin-done", today);
          setOpen(true);
        }

        prevHasMood.current = hasMood;
      } catch {
        // non-critical
      }
    })();
  }, [today, selectedDate, refreshKey]);

  return (
    <SoftCelebration
      open={open}
      title="День закрыт"
      subtitle="Чек-ин сохранён — завтра продолжим без давления."
      pose="cheer"
      onClose={close}
    />
  );
}
