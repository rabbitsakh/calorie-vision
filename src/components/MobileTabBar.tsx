"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BottomComposer } from "@/components/BottomComposer";
import { useFoodAddUi } from "@/components/FoodAddHost";
import { NavIcon } from "@/components/NavIcons";
import { APP_NAV, navKeepsDate, showsComposer } from "@/lib/navigation";
import { countAllOfflineDrafts } from "@/lib/offline-draft-count";
import { subscribeMealDraftQueue } from "@/lib/meal-draft-queue";
import { subscribeWaterDraftQueue } from "@/lib/water-draft-queue";
import { subscribeWeightDraftQueue } from "@/lib/weight-draft-queue";
import { subscribeDiaryNoteDraftQueue } from "@/lib/diary-note-draft-queue";
import { subscribeLocalWorkoutSessions } from "@/lib/workout-local-session";
import { subscribeWorkoutExerciseDraftQueue } from "@/lib/workout-exercise-draft-queue";
import { subscribeWorkoutSetDraftQueue } from "@/lib/workout-set-draft-queue";
import { subscribeShoppingSyncDraft } from "@/lib/shopping-sync-draft";
import { subscribeAssistantApplyQueue } from "@/lib/assistant-apply-queue";
import { subscribeRewardsDraftQueue } from "@/lib/rewards-draft-queue";
import { withDateQuery } from "@/lib/use-selected-date";

type MobileTabBarProps = {
  date?: string;
  /** Composer (text · photo · +) on «Сегодня» — off on admin shells. */
  showAdd?: boolean;
};

/**
 * Bottom tab bar — in-flow flex child of `.cv-app-frame` (not position:fixed).
 * Hybrid: four tabs; on «Сегодня» a composer sits above them (text → AI, photo, «+»).
 */
export function MobileTabBar({ date, showAdd = true }: MobileTabBarProps) {
  const pathname = usePathname();
  const { confirmOpen } = useFoodAddUi();
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    const refresh = () => setQueueCount(countAllOfflineDrafts());
    refresh();
    const unsubMeal = subscribeMealDraftQueue(refresh);
    const unsubWater = subscribeWaterDraftQueue(refresh);
    const unsubWeight = subscribeWeightDraftQueue(refresh);
    const unsubDiary = subscribeDiaryNoteDraftQueue(refresh);
    const unsubSets = subscribeWorkoutSetDraftQueue(refresh);
    const unsubEx = subscribeWorkoutExerciseDraftQueue(refresh);
    const unsubLocal = subscribeLocalWorkoutSessions(refresh);
    const unsubShopping = subscribeShoppingSyncDraft(refresh);
    const unsubAi = subscribeAssistantApplyQueue(refresh);
    const unsubRewards = subscribeRewardsDraftQueue(refresh);
    return () => {
      unsubMeal();
      unsubWater();
      unsubWeight();
      unsubDiary();
      unsubLocal();
      unsubEx();
      unsubSets();
      unsubShopping();
      unsubAi();
      unsubRewards();
    };
  }, []);

  const composer = showAdd && showsComposer(pathname);

  return (
    <nav className="mobile-tab-bar shrink-0 md:hidden" aria-label="Основные разделы">
      {composer ? <BottomComposer date={date} disabled={confirmOpen} /> : null}
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1.5">
        {APP_NAV.map((item) => (
          <TabLink
            key={item.href}
            item={item}
            pathname={pathname}
            date={date}
            queueCount={item.href === "/ration" ? queueCount : 0}
          />
        ))}
      </div>
    </nav>
  );
}

function TabLink({
  item,
  pathname,
  date,
  queueCount,
}: {
  item: (typeof APP_NAV)[number];
  pathname: string;
  date?: string;
  queueCount: number;
}) {
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const href = date && navKeepsDate(item.href) ? withDateQuery(item.href, date) : item.href;
  const showQueueBadge = queueCount > 0;

  return (
    <Link
      href={href}
      className={`mobile-tab-bar__link${active ? " mobile-tab-bar__link--active" : ""}`}
      aria-label={
        showQueueBadge
          ? `${item.label}: ${queueCount} ждёт сеть`
          : item.label
      }
      title={showQueueBadge ? `${queueCount} в очереди — ждёт сеть` : undefined}
    >
      <div className="mobile-tab-bar__icon">
        <NavIcon
          name={item.icon}
          className={`h-5 w-5 ${active ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
        />
        {showQueueBadge ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--warn)] px-1 text-[10px] font-bold leading-none text-white">
            {queueCount > 9 ? "9+" : queueCount}
          </span>
        ) : null}
      </div>
      <span className="truncate">{item.shortLabel}</span>
    </Link>
  );
}
