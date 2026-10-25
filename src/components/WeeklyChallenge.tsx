"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { notifyChestQueueRefresh } from "@/lib/chest-queue-refresh";
import {
  isSoftCelebrationSeen,
  markSoftCelebrationSeen,
} from "@/lib/soft-celebration";
import { withBasePath } from "@/lib/paths";
import {
  hidePanelForWeek,
  isPanelHiddenForWeek,
  showPanelForWeek,
} from "@/lib/panel-visibility";

const PANEL_ID = "challenge";

type ChallengeOption = {
  key: string;
  title: string;
  description: string;
  target: number;
  tight?: boolean;
  daysLeft?: number;
  recommended?: boolean;
};

type ActiveChallenge = {
  challengeKey: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  weekStart: string;
};

type ChallengesResponse = {
  active: ActiveChallenge | null;
  options: ChallengeOption[];
  weekStart: string;
  daysLeft?: number;
};

type WeeklyChallengeProps = {
  selectedDate: string;
  refreshKey: number;
  /** One-line strip for collapsed habits accordion. */
  mini?: boolean;
  /** Mini strip click (e.g. open habits panel). */
  onMiniClick?: () => void;
  /** Fires after a challenge is successfully started / replaced. */
  onStarted?: () => void;
  /** D4: quieter band inside plan-week (no emerald card). */
  embedded?: boolean;
};

export function WeeklyChallenge({
  selectedDate,
  refreshKey,
  mini = false,
  onMiniClick,
  onStarted,
  embedded = false,
}: WeeklyChallengeProps) {
  const [data, setData] = useState<ChallengesResponse | null>(null);
  const [history, setHistory] = useState<
    Array<{ weekStart: string; title: string; completed: boolean; progress: number; target: number }>
  >([]);
  const [hidden, setHidden] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const prevCompleted = useRef<boolean | null>(null);

  const load = useCallback(async () => {
    try {
      const resp = await fetch(withBasePath("/api/challenges"));
      if (!resp.ok) return;
      const next = (await resp.json()) as ChallengesResponse;
      setData(next);
      if (next.weekStart) {
        setHidden(isPanelHiddenForWeek(PANEL_ID, next.weekStart));
      }

      const active = next.active;
      if (!active) {
        prevCompleted.current = null;
        return;
      }

      const doneKey = `${active.weekStart}-${active.challengeKey}`;
      const justCompleted = prevCompleted.current === false && active.completed;
      const firstSightDone =
        prevCompleted.current === null &&
        active.completed &&
        !isSoftCelebrationSeen("challenge-done", doneKey);

      // C3 — enqueue on ChestDock; do not auto-open / fullscreen here.
      if (
        (justCompleted || firstSightDone) &&
        !isSoftCelebrationSeen("challenge-done", doneKey)
      ) {
        markSoftCelebrationSeen("challenge-done", doneKey);
        notifyChestQueueRefresh();
      }

      prevCompleted.current = active.completed;
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey, selectedDate]);

  useEffect(() => {
    if (mini) return;
    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/challenges?history=1"));
        if (!resp.ok) return;
        const next = (await resp.json()) as {
          history?: Array<{
            weekStart: string;
            title: string;
            completed: boolean;
            progress: number;
            target: number;
          }>;
        };
        setHistory(next.history ?? []);
      } catch {
        // ignore
      }
    })();
  }, [mini, refreshKey]);

  async function start(key: string, replace = false) {
    setStarting(key);
    try {
      const resp = await fetch(withBasePath("/api/challenges"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeKey: key, replace }),
      });
      if (resp.ok) {
        setSwitching(false);
        await load();
        onStarted?.();
      }
    } finally {
      setStarting(null);
    }
  }

  if (!data) return null;

  if (mini) {
    const active = data.active;
    const label = active
      ? active.completed
        ? `${active.title} ✓`
        : `${active.progress}/${active.target}`
      : "Выбрать цель";
    const miniClass =
      "flex min-w-0 flex-1 items-center gap-1.5 rounded-xl bg-[var(--accent-soft)] px-2.5 py-1.5 text-left text-xs font-semibold text-[var(--accent-ink)]";
    const miniLabel = (
      <span className="truncate">
        {active ? active.title : "Челлендж"} · {label}
      </span>
    );
    return (
      <>
        {onMiniClick ? (
          <button
            type="button"
            className={miniClass}
            onClick={onMiniClick}
            title={active?.title ?? "Челлендж недели"}
          >
            {miniLabel}
          </button>
        ) : (
          <div className={miniClass} title={active?.title ?? "Челлендж недели"}>
            {miniLabel}
          </div>
        )}
      </>
    );
  }

  if (hidden) {
    return (
      <>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-[var(--accent)]/25 px-4 py-2.5 text-sm text-[var(--accent-ink)] hover:border-[var(--accent)]/40"
          onClick={() => {
            if (data.weekStart) showPanelForWeek(PANEL_ID, data.weekStart);
            setHidden(false);
          }}
        >
          <span>Челлендж недели</span>
          <span className="text-xs">Показать</span>
        </button>
      </>
    );
  }

  const daysLeft = data.daysLeft ?? data.options[0]?.daysLeft;
  const showPicker = !data.active || switching;
  const options = (switching
    ? data.options.filter((o) => o.key !== data.active?.challengeKey)
    : data.options
  )
    .slice()
    .sort((a, b) => Number(Boolean(b.recommended)) - Number(Boolean(a.recommended)));

  const shellClass = embedded
    ? "plan-week__band"
    : "rounded-2xl border border-[var(--border-quiet)] bg-[var(--accent-soft)]/50 p-4";
  const titleClass = embedded ? "font-semibold text-[var(--foreground)]" : "font-semibold text-[var(--accent-ink)]";
  const hintClass = embedded ? "text-xs text-[var(--muted)]" : "text-xs text-[var(--accent-ink)]";

  return (
    <>
      <div className={shellClass}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className={titleClass}>Челлендж недели</p>
            <p className={hintClass}>Одна цель на 7 дней — без перфекционизма</p>
          </div>
          <button
            type="button"
            className="btn-quiet text-xs text-[var(--accent-ink)] hover:bg-[var(--accent-soft)]"
            onClick={() => {
              if (data.weekStart) hidePanelForWeek(PANEL_ID, data.weekStart);
              setHidden(true);
            }}
          >
            Скрыть
          </button>
        </div>

        {data.active && !switching ? (
          <div>
            <p className="font-medium text-[var(--foreground)]">{data.active.title}</p>
            <p className="text-xs text-[var(--muted)]">{data.active.description}</p>
            {(() => {
              const pct = Math.min(
                100,
                Math.round((data.active.progress / Math.max(1, data.active.target)) * 100),
              );
              return (
                <>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <span className="text-sm font-semibold tabular-nums text-[var(--accent-ink)]">
                      {data.active.progress}
                      <span className="font-normal text-[var(--accent-ink)]"> / {data.active.target}</span>
                    </span>
                    <span className="text-sm font-bold tabular-nums text-[var(--accent-ink)]">
                      {data.active.completed ? "Выполнено!" : `${pct}%`}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-4 overflow-hidden rounded-full bg-[var(--accent-soft)] ring-1 ring-inset ring-[var(--accent)]/20"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Прогресс челленджа: ${pct}%`}
                  >
                    <div
                      className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </>
              );
            })()}
            {!data.active.completed ? (
              <button
                type="button"
                className="mt-3 text-xs font-semibold text-[var(--accent-ink)] underline-offset-2 hover:underline"
                onClick={() => setSwitching(true)}
              >
                Сменить цель
              </button>
            ) : null}
          </div>
        ) : null}

        {showPicker ? (
          <div className={`flex flex-col gap-2 ${data.active && switching ? "mt-3" : ""}`}>
            {switching ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-[var(--accent-ink)]">Новая цель на эту неделю</p>
                <button
                  type="button"
                  className="text-xs text-[var(--muted)] hover:text-[var(--muted-strong)]"
                  onClick={() => setSwitching(false)}
                >
                  Отмена
                </button>
              </div>
            ) : null}
            {typeof daysLeft === "number" && daysLeft < 7 && !data.active ? (
              <p className="text-xs text-amber-800">
                До конца недели {daysLeft}{" "}
                {daysLeft === 1 ? "день" : daysLeft < 5 ? "дня" : "дней"} — цели на 7 дней могут не
                успеть без записей с понедельника.
              </p>
            ) : null}
            {options.map((opt) => (
              <button
                key={opt.key}
                type="button"
                disabled={starting !== null}
                className="rounded-xl border border-[var(--border-quiet)] bg-[var(--surface-mist)]/70 px-3 py-2.5 text-left hover:border-[var(--accent)]/35 disabled:opacity-60"
                onClick={() => void start(opt.key, switching)}
              >
                <p className="text-sm font-medium text-[var(--foreground)]">{opt.title}</p>
                <p className="text-xs text-[var(--muted)]">{opt.description}</p>
                {opt.recommended ? (
                  <p className="mt-1 text-xs font-semibold text-[var(--accent-ink)]">Подойдёт на этой неделе</p>
                ) : null}
                {opt.tight ? (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    Сложно успеть: до конца недели меньше дней, чем нужно
                  </p>
                ) : null}
                {starting === opt.key ? (
                  <span className="text-xs text-[var(--accent-ink)]">Стартуем…</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        {history.length > 0 ? (
          <div className="mt-4 border-t border-[var(--border-hairline)] pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--accent-ink)]">
              Прошлые недели
            </p>
            <ul className="flex flex-col gap-1.5">
              {history.slice(0, 6).map((row) => (
                <li
                  key={row.weekStart}
                  className="flex items-center justify-between gap-2 text-xs text-[var(--muted-strong)]"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-[var(--muted-strong)]">{row.weekStart}</span>
                    {" · "}
                    {row.title}
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold text-[var(--accent-ink)]">
                    {row.completed ? "✓" : `${row.progress}/${row.target}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </>
  );
}
