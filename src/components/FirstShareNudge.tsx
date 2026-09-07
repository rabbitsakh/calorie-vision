"use client";

import { useEffect, useState } from "react";
import { ShareDayButton } from "@/components/ShareDayButton";
import {
  markFirstShareNudgeSeen,
  shouldShowFirstShareNudge,
} from "@/lib/first-hour-trust";

/** Soft one-time nudge to share the day after the first logged meal today. */
export function FirstShareNudge({
  date,
  today,
  mealCount,
}: {
  date: string;
  today: string;
  mealCount: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (date !== today) {
      setVisible(false);
      return;
    }
    setVisible(shouldShowFirstShareNudge(mealCount));
  }, [date, today, mealCount]);

  if (!visible) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-100 bg-teal-50/70 px-3 py-2.5 text-sm text-teal-950">
      <p className="min-w-0 flex-1 font-medium">
        День начат — можно тихо поделиться карточкой, без оценок.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <ShareDayButton
          date={date}
          variant="button"
          className="!gap-0"
          onDone={() => {
            markFirstShareNudgeSeen();
            setVisible(false);
          }}
        />
        <button
          type="button"
          className="btn-quiet text-xs text-teal-800"
          onClick={() => {
            markFirstShareNudgeSeen();
            setVisible(false);
          }}
        >
          Позже
        </button>
      </div>
    </div>
  );
}
