"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useFoodAddUi } from "@/components/FoodAddHost";
import { NavIcon } from "@/components/NavIcons";
import { APP_NAV, navKeepsDate } from "@/lib/navigation";
import { countAllOfflineDrafts } from "@/lib/offline-draft-count";
import { subscribeMealDraftQueue } from "@/lib/meal-draft-queue";
import { subscribeWaterDraftQueue } from "@/lib/water-draft-queue";
import { subscribeWeightDraftQueue } from "@/lib/weight-draft-queue";
import { subscribeDiaryNoteDraftQueue } from "@/lib/diary-note-draft-queue";
import { subscribeLocalWorkoutSessions } from "@/lib/workout-local-session";
import { subscribeWorkoutExerciseDraftQueue } from "@/lib/workout-exercise-draft-queue";
import { subscribeWorkoutSetDraftQueue } from "@/lib/workout-set-draft-queue";
import { requestOpenFoodAddPicker } from "@/lib/open-food-camera";
import { withDateQuery } from "@/lib/use-selected-date";

type MobileTabBarProps = {
  date?: string;
  /** Center dock (AI | +) — off on admin shells. */
  showAdd?: boolean;
};

/**
 * Bottom tab bar — in-flow flex child of `.cv-app-frame` (not position:fixed).
 * Center E2 split: left → AI assistant, right → add sheet.
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
    return () => {
      unsubMeal();
      unsubWater();
      unsubWeight();
      unsubDiary();
      unsubLocal();
      unsubEx();
      unsubSets();
    };
  }, []);

  const left = APP_NAV.slice(0, 2);
  const right = APP_NAV.slice(2);
  const assistantActive =
    pathname === "/assistant" || pathname.startsWith("/assistant/");

  return (
    <nav className="mobile-tab-bar shrink-0 md:hidden" aria-label="Основные разделы">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1.5">
        {left.map((item) => (
          <TabLink
            key={item.href}
            item={item}
            pathname={pathname}
            date={date}
            queueCount={item.href === "/ration" ? queueCount : 0}
          />
        ))}

        {showAdd ? (
          <SplitCenterDock
            active={assistantActive}
            disabled={confirmOpen}
          />
        ) : null}

        {right.map((item) => (
          <TabLink
            key={item.href}
            item={item}
            pathname={pathname}
            date={date}
            queueCount={0}
          />
        ))}
      </div>
    </nav>
  );
}

/** E2 — dual center: AI assistant | add picker. */
function SplitCenterDock({
  active,
  disabled,
}: {
  active: boolean;
  disabled: boolean;
}) {
  return (
    <div
      className={`mobile-tab-bar__split${active ? " mobile-tab-bar__split--active" : ""}${
        disabled ? " mobile-tab-bar__split--disabled" : ""
      }`}
      role="group"
      aria-label="Ассистент и добавление"
    >
      <Link
        href="/assistant"
        className="mobile-tab-bar__split-ai"
        aria-label="AI‑ассистент"
        aria-current={active ? "page" : undefined}
      >
        <svg aria-hidden className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path
            d="M12 3l1.2 3.6L17 8l-3.8 1.4L12 13l-1.2-3.6L7 8l3.8-1.4L12 3z"
            strokeLinejoin="round"
          />
          <path d="M18.5 13.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1z" strokeLinejoin="round" />
          <path d="M6 15l.5 1.5L8 17l-1.5.5L6 19l-.5-1.5L4 17l1.5-.5L6 15z" strokeLinejoin="round" />
        </svg>
        <span className="mobile-tab-bar__split-label">AI</span>
      </Link>
      <span className="mobile-tab-bar__split-divider" aria-hidden />
      <button
        type="button"
        className="mobile-tab-bar__split-plus"
        aria-label="Добавить: фото, текст, штрихкод, вода, вес или тренировка"
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => {
          if (!disabled) requestOpenFoodAddPicker();
        }}
      >
        <svg aria-hidden className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>
    </div>
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
