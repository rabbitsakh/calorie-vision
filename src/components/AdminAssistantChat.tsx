"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantActions, AssistantContextSnapshot, AssistantMode } from "@/lib/admin-assistant";
import { withBasePath } from "@/lib/paths";
import { addItemsFromDishNames } from "@/lib/shopping-list";

type ChatRole = "user" | "assistant";

type ChatTurn = {
  id: string;
  role: ChatRole;
  content: string;
  actions?: AssistantActions | null;
};

const STORAGE_KEY = "cv-admin-assistant-chat-v2";

const STARTERS: Record<AssistantMode, string[]> = {
  all: [
    "Что ещё съесть сегодня по остатку КБЖУ?",
    "Собери рацион на завтра под мою цель",
    "Какую тренировку сделать завтра?",
    "План зала на неделю: 3 дня + покупки",
  ],
  food: [
    "Остаток КБЖУ и 3 идеи на ужин",
    "Рацион на завтра с клетчаткой",
    "Список покупок на 2 дня",
    "Где я недобираю белок за неделю?",
  ],
  gym: [
    "Тренировка завтра с учётом недавних",
    "Сплит на 4 дня без пересечения групп",
    "Лёгкая сессия / deload",
    "Кардио: сколько минут на этой неделе?",
  ],
  week: [
    "Недельный план: еда + 3 тренировки",
    "Пн–Пт рацион и зал кратко",
    "Список покупок под недельный рацион",
    "Где слабое место недели?",
  ],
};

const MODES: Array<{ id: AssistantMode; label: string }> = [
  { id: "all", label: "Всё" },
  { id: "food", label: "Еда" },
  { id: "gym", label: "Зал" },
  { id: "week", label: "Неделя" },
];

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function welcomeTurn(): ChatTurn {
  return {
    id: "welcome",
    role: "assistant",
    content:
      "Привет. Контекст: рацион, вес, вода, серия, челлендж, недавние дни и тренировки. Выбери режим и спрашивай — к планам можно сразу добавить покупки.",
  };
}

function loadStored(userId: string | undefined): {
  turns: ChatTurn[];
  mode: AssistantMode;
  date: string | null;
} | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      turns?: ChatTurn[];
      mode?: AssistantMode;
      date?: string;
    };
    if (!Array.isArray(parsed.turns) || parsed.turns.length === 0) return null;
    return {
      turns: parsed.turns.slice(-80),
      mode: parsed.mode === "food" || parsed.mode === "gym" || parsed.mode === "week" ? parsed.mode : "all",
      date: typeof parsed.date === "string" ? parsed.date : null,
    };
  } catch {
    return null;
  }
}

function saveStored(
  userId: string | undefined,
  turns: ChatTurn[],
  mode: AssistantMode,
  date: string,
) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(
      `${STORAGE_KEY}:${userId}`,
      JSON.stringify({ turns: turns.slice(-80), mode, date, savedAt: Date.now() }),
    );
  } catch {
    // quota
  }
}

function SnapshotChips({ snapshot }: { snapshot: AssistantContextSnapshot | null }) {
  if (!snapshot) return null;
  const chips: string[] = [];
  if (snapshot.remainingCalories != null && snapshot.targetCalories != null) {
    chips.push(`остаток ${snapshot.remainingCalories} / ${snapshot.targetCalories} ккал`);
  } else {
    chips.push(`${snapshot.calories} ккал`);
  }
  if (snapshot.targetProtein != null) {
    chips.push(`Б ${snapshot.protein}/${snapshot.targetProtein}`);
  }
  chips.push(`вода ${snapshot.waterMl}/${snapshot.waterTargetMl}`);
  if (snapshot.weightKg != null) chips.push(`${snapshot.weightKg} кг`);
  if (snapshot.streakDays != null) chips.push(`серия ${snapshot.streakDays}`);
  if (snapshot.challenge) chips.push(snapshot.challenge);
  if (snapshot.recentWorkoutLabel) chips.push(snapshot.recentWorkoutLabel);

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span
          key={c}
          className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--muted-strong)]"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function ActionCard({
  actions,
  userId,
  date,
}: {
  actions: AssistantActions;
  userId?: string;
  date: string;
}) {
  const [shopFlash, setShopFlash] = useState(false);
  const shopping = [
    ...(actions.shopping ?? []),
    ...(actions.meals ?? []).map((m) => m.name),
  ].filter(Boolean);

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-teal-200 bg-teal-50/80 px-3 py-2 text-xs text-teal-950">
      {actions.summary ? <p className="font-semibold">{actions.summary}</p> : null}
      {actions.meals?.length ? (
        <ul className="space-y-0.5">
          {actions.meals.map((m) => (
            <li key={m.name}>
              • {m.name}
              {m.kcal != null ? ` — ${m.kcal} ккал` : ""}
              {m.note ? ` (${m.note})` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {actions.workoutDays?.length ? (
        <ul className="space-y-0.5">
          {actions.workoutDays.map((w) => (
            <li key={`${w.day}-${w.focus}`}>
              • {w.day}: {w.focus}
              {w.notes ? ` — ${w.notes}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        {shopping.length ? (
          <button
            type="button"
            className="rounded-lg bg-teal-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-800"
            onClick={() => {
              addItemsFromDishNames(shopping, date, { userId });
              setShopFlash(true);
              window.setTimeout(() => setShopFlash(false), 1600);
            }}
          >
            {shopFlash ? "В покупках" : `В покупки (${shopping.length})`}
          </button>
        ) : null}
        {actions.workoutDays?.length ? (
          <Link
            href="/workouts"
            className="rounded-lg border border-teal-700/40 bg-white px-2.5 py-1 text-[11px] font-semibold text-teal-900 hover:bg-teal-100"
          >
            Открыть зал
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function AdminAssistantChat() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [hydrated, setHydrated] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([welcomeTurn()]);
  const [mode, setMode] = useState<AssistantMode>("all");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<AssistantContextSnapshot | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = loadStored(userId);
    if (stored) {
      setTurns(stored.turns);
      setMode(stored.mode);
      if (stored.date) setDate(stored.date);
    }
    setHydrated(true);
  }, [userId]);

  useEffect(() => {
    if (!hydrated) return;
    saveStored(userId, turns, mode, date);
  }, [hydrated, userId, turns, mode, date]);

  const refreshSnapshot = useCallback(async (day: string) => {
    try {
      const resp = await fetch(withBasePath(`/api/admin/assistant?date=${encodeURIComponent(day)}`));
      const data = (await resp.json().catch(() => null)) as {
        snapshot?: AssistantContextSnapshot;
        today?: string;
      } | null;
      if (resp.ok && data?.snapshot) {
        setSnapshot(data.snapshot);
        if (data.today && !loadStored(userId)?.date) {
          // keep explicit user date
        }
      }
    } catch {
      // ignore chip load errors
    }
  }, [userId]);

  useEffect(() => {
    if (!hydrated) return;
    void refreshSnapshot(date);
  }, [hydrated, date, refreshSnapshot]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setError(null);
    setDraft("");
    const userTurn: ChatTurn = { id: newId(), role: "user", content };
    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);
    setBusy(true);

    try {
      const history = nextTurns
        .filter((t) => t.id !== "welcome")
        .map((t) => ({ role: t.role, content: t.content }));
      const resp = await fetch(withBasePath("/api/admin/assistant"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, date, mode }),
      });
      const data = (await resp.json().catch(() => null)) as {
        reply?: string;
        actions?: AssistantActions | null;
        snapshot?: AssistantContextSnapshot;
        error?: string;
      } | null;
      if (!resp.ok) {
        throw new Error(data?.error || "Не удалось получить ответ");
      }
      const reply = data?.reply?.trim();
      if (!reply) throw new Error("Пустой ответ");
      if (data?.snapshot) setSnapshot(data.snapshot);
      setTurns((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: reply,
          actions: data?.actions ?? null,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  function clearChat() {
    setTurns([welcomeTurn()]);
    setError(null);
  }

  return (
    <section className="flex min-h-[75vh] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-[var(--muted-strong)]">
          День{" "}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ml-1 rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-sm"
            disabled={busy}
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                mode === m.id
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--line)] bg-white text-[var(--muted-strong)]"
              }`}
              disabled={busy}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ml-auto text-[11px] font-semibold text-[var(--muted)] underline-offset-2 hover:underline"
          disabled={busy}
          onClick={clearChat}
        >
          Очистить чат
        </button>
      </div>

      <SnapshotChips snapshot={snapshot} />

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 sm:p-4">
        {turns.map((turn) => (
          <div
            key={turn.id}
            className={`max-w-[94%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
              turn.role === "user"
                ? "ml-auto bg-[var(--accent)] text-white"
                : "mr-auto bg-[var(--surface-mist)] text-[var(--ink)]"
            }`}
          >
            <div className="whitespace-pre-wrap">{turn.content}</div>
            {turn.role === "assistant" && turn.actions ? (
              <ActionCard actions={turn.actions} userId={userId} date={date} />
            ) : null}
          </div>
        ))}
        {busy ? (
          <p className="mr-auto text-xs font-medium text-[var(--muted)]">Смотрю дневник и зал…</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-1.5">
        {STARTERS[mode].map((hint) => (
          <button
            key={hint}
            type="button"
            className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--muted-strong)] hover:bg-[var(--surface-mist)] disabled:opacity-50"
            disabled={busy}
            onClick={() => void send(hint)}
          >
            {hint}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Вопрос про еду, зал или неделю…"
          className="input min-h-11 flex-1 resize-y py-2"
          disabled={busy}
          maxLength={6000}
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
        />
        <button type="submit" className="btn btn-primary min-h-11 self-end px-4" disabled={busy || !draft.trim()}>
          Отправить
        </button>
      </form>
    </section>
  );
}
