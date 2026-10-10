"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistantActions, AssistantContextSnapshot, AssistantMode } from "@/lib/admin-assistant";
import type { AssistantPrefs } from "@/lib/assistant-prefs";
import { withBasePath } from "@/lib/paths";
import { addItemsFromDishNames } from "@/lib/shopping-list";

type ChatRole = "user" | "assistant";

type ChatTurn = {
  id: string;
  role: ChatRole;
  content: string;
  actions?: AssistantActions | null;
};

const STORAGE_KEY = "cv-assistant-chat-v3";

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
    "Запомни: не предлагай творог",
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
      "Привет. Я вижу твой рацион и зал. Можно сохранить блюда в дневник, создать шаблон тренировки и список покупок — и запомнить предпочтения («не люблю …»).",
  };
}

function loadStored(userId: string | undefined) {
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
      mode:
        parsed.mode === "food" || parsed.mode === "gym" || parsed.mode === "week"
          ? parsed.mode
          : "all",
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

function parseSseChunk(buffer: string): { events: Array<{ event: string; data: string }>; rest: string } {
  const events: Array<{ event: string; data: string }> = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const block of parts) {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data += line.slice(5).trim();
    }
    if (data) events.push({ event, data });
  }
  return { events, rest };
}

function SnapshotChips({ snapshot }: { snapshot: AssistantContextSnapshot | null }) {
  if (!snapshot) return null;
  const chips: string[] = [];
  if (snapshot.remainingCalories != null && snapshot.targetCalories != null) {
    chips.push(`остаток ${snapshot.remainingCalories} / ${snapshot.targetCalories} ккал`);
  } else {
    chips.push(`${snapshot.calories} ккал`);
  }
  if (snapshot.targetProtein != null) chips.push(`Б ${snapshot.protein}/${snapshot.targetProtein}`);
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
  onFlash,
}: {
  actions: AssistantActions;
  userId?: string;
  date: string;
  onFlash: (msg: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const shopping = [
    ...(actions.shopping ?? []),
    ...(actions.meals ?? []).map((m) => m.name),
  ].filter(Boolean);

  async function apply(kind: "meals" | "routine") {
    setBusy(kind);
    try {
      const resp = await fetch(withBasePath("/api/assistant/apply"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, date, actions }),
      });
      const data = (await resp.json().catch(() => null)) as { error?: string; meals?: unknown[]; routine?: { id?: string } } | null;
      if (!resp.ok) throw new Error(data?.error || "Не удалось");
      if (kind === "meals") onFlash(`В дневник: ${data?.meals?.length ?? 0}`);
      else onFlash("Шаблон создан в Зале");
    } catch (err) {
      onFlash(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

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
              onFlash(`В покупках: ${shopping.length}`);
            }}
          >
            В покупки ({shopping.length})
          </button>
        ) : null}
        {actions.meals?.length ? (
          <button
            type="button"
            className="rounded-lg border border-teal-700/40 bg-white px-2.5 py-1 text-[11px] font-semibold text-teal-900 hover:bg-teal-100 disabled:opacity-50"
            disabled={busy === "meals"}
            onClick={() => void apply("meals")}
          >
            {busy === "meals" ? "Пишу…" : "В дневник"}
          </button>
        ) : null}
        {actions.workoutDays?.length ? (
          <>
            <button
              type="button"
              className="rounded-lg border border-teal-700/40 bg-white px-2.5 py-1 text-[11px] font-semibold text-teal-900 hover:bg-teal-100 disabled:opacity-50"
              disabled={busy === "routine"}
              onClick={() => void apply("routine")}
            >
              {busy === "routine" ? "Создаю…" : "Шаблон в зал"}
            </button>
            <Link
              href="/workouts"
              className="rounded-lg border border-teal-700/40 bg-white px-2.5 py-1 text-[11px] font-semibold text-teal-900 hover:bg-teal-100"
            >
              Открыть зал
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function AssistantChat() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [hydrated, setHydrated] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([welcomeTurn()]);
  const [mode, setMode] = useState<AssistantMode>("all");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<AssistantContextSnapshot | null>(null);
  const [prefs, setPrefs] = useState<AssistantPrefs>({ likes: [], dislikes: [], notes: [] });
  const [dislikeDraft, setDislikeDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = loadStored(userId);
    if (stored) {
      setTurns(stored.turns);
      setMode(stored.mode as AssistantMode);
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
      const resp = await fetch(withBasePath(`/api/assistant?date=${encodeURIComponent(day)}`));
      const data = (await resp.json().catch(() => null)) as {
        snapshot?: AssistantContextSnapshot;
        prefs?: AssistantPrefs;
      } | null;
      if (resp.ok && data?.snapshot) setSnapshot(data.snapshot);
      if (resp.ok && data?.prefs) setPrefs(data.prefs);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void refreshSnapshot(date);
  }, [hydrated, date, refreshSnapshot]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  function showFlash(msg: string) {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2200);
  }

  async function savePrefs(next: AssistantPrefs) {
    const resp = await fetch(withBasePath("/api/assistant/apply"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "prefs", prefs: next }),
    });
    const data = (await resp.json().catch(() => null)) as { prefs?: AssistantPrefs; error?: string } | null;
    if (!resp.ok) throw new Error(data?.error || "Не сохранилось");
    if (data?.prefs) setPrefs(data.prefs);
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;

    // Soft preference capture: «не предлагай X» / «не люблю X»
    const dislikeMatch = /(?:не\s+(?:предлагай|люблю|ем)|без)\s+(.+)$/i.exec(content);
    if (dislikeMatch?.[1]) {
      const item = dislikeMatch[1].replace(/[.!?]+$/, "").trim().slice(0, 80);
      if (item) {
        const next = {
          ...prefs,
          dislikes: [...prefs.dislikes.filter((d) => d.toLowerCase() !== item.toLowerCase()), item].slice(
            0,
            24,
          ),
        };
        try {
          await savePrefs(next);
          showFlash(`Запомнил: не предлагать «${item}»`);
        } catch {
          // continue to ask AI anyway
        }
      }
    }

    setError(null);
    setDraft("");
    const userTurn: ChatTurn = { id: newId(), role: "user", content };
    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);
    setBusy(true);

    const history = nextTurns
      .filter((t) => t.id !== "welcome")
      .map((t) => ({ role: t.role, content: t.content }));

    const assistantId = newId();
    setTurns((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const resp = await fetch(withBasePath("/api/assistant/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, date, mode }),
      });
      if (!resp.ok || !resp.body) {
        const fallback = await fetch(withBasePath("/api/assistant"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, date, mode }),
        });
        const data = (await fallback.json().catch(() => null)) as {
          reply?: string;
          actions?: AssistantActions | null;
          snapshot?: AssistantContextSnapshot;
          prefs?: AssistantPrefs;
          error?: string;
        } | null;
        if (!fallback.ok) throw new Error(data?.error || "Не удалось получить ответ");
        if (data?.snapshot) setSnapshot(data.snapshot);
        if (data?.prefs) setPrefs(data.prefs);
        setTurns((prev) =>
          prev.map((t) =>
            t.id === assistantId
              ? { ...t, content: data?.reply?.trim() || "…", actions: data?.actions ?? null }
              : t,
          ),
        );
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parsed = parseSseChunk(buf);
        buf = parsed.rest;
        for (const ev of parsed.events) {
          let json: Record<string, unknown> = {};
          try {
            json = JSON.parse(ev.data) as Record<string, unknown>;
          } catch {
            continue;
          }
          if (ev.event === "token" && typeof json.text === "string") {
            acc += json.text;
            const live = acc.replace(/```cv-actions[\s\S]*$/i, "").trimEnd();
            setTurns((prev) =>
              prev.map((t) => (t.id === assistantId ? { ...t, content: live || "…" } : t)),
            );
          }
          if (ev.event === "meta") {
            if (json.snapshot) setSnapshot(json.snapshot as AssistantContextSnapshot);
            if (json.prefs) setPrefs(json.prefs as AssistantPrefs);
          }
          if (ev.event === "done") {
            if (json.snapshot) setSnapshot(json.snapshot as AssistantContextSnapshot);
            if (json.prefs) setPrefs(json.prefs as AssistantPrefs);
            setTurns((prev) =>
              prev.map((t) =>
                t.id === assistantId
                  ? {
                      ...t,
                      content: String(json.reply || acc).trim() || "…",
                      actions: (json.actions as AssistantActions | null) ?? null,
                    }
                  : t,
              ),
            );
          }
          if (ev.event === "error") {
            throw new Error(String(json.error || "Ошибка стрима"));
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
      setTurns((prev) => prev.filter((t) => t.id !== assistantId || t.content));
    } finally {
      setBusy(false);
    }
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
          onClick={() => {
            setTurns([welcomeTurn()]);
            setError(null);
          }}
        >
          Очистить чат
        </button>
      </div>

      <SnapshotChips snapshot={snapshot} />

      {(prefs.dislikes.length > 0 || prefs.likes.length > 0) && (
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          {prefs.dislikes.map((d) => (
            <button
              key={`d-${d}`}
              type="button"
              className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 font-medium text-rose-800"
              title="Убрать"
              onClick={() => {
                void savePrefs({
                  ...prefs,
                  dislikes: prefs.dislikes.filter((x) => x !== d),
                }).then(() => showFlash("Убрал из запретов"));
              }}
            >
              не: {d} ×
            </button>
          ))}
          {prefs.likes.map((d) => (
            <span
              key={`l-${d}`}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800"
            >
              ок: {d}
            </span>
          ))}
        </div>
      )}

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const item = dislikeDraft.trim();
          if (!item) return;
          void savePrefs({
            ...prefs,
            dislikes: [...prefs.dislikes.filter((d) => d.toLowerCase() !== item.toLowerCase()), item].slice(
              0,
              24,
            ),
          }).then(() => {
            setDislikeDraft("");
            showFlash(`Запомнил: не предлагать «${item}»`);
          });
        }}
      >
        <input
          value={dislikeDraft}
          onChange={(e) => setDislikeDraft(e.target.value)}
          placeholder="Не предлагать (например: творог)"
          className="input min-h-9 flex-1 text-sm"
          maxLength={80}
        />
        <button type="submit" className="btn btn-secondary min-h-9 px-3 text-xs">
          Запомнить
        </button>
      </form>

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
            <div className="whitespace-pre-wrap">{turn.content || (busy ? "…" : "")}</div>
            {turn.role === "assistant" && turn.actions ? (
              <ActionCard
                actions={turn.actions}
                userId={userId}
                date={date}
                onFlash={showFlash}
              />
            ) : null}
          </div>
        ))}
        {busy ? (
          <p className="mr-auto text-xs font-medium text-[var(--muted)]">Пишет ответ…</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {flash ? <p className="text-sm font-medium text-teal-800">{flash}</p> : null}
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
        <button
          type="submit"
          className="btn btn-primary min-h-11 self-end px-4"
          disabled={busy || !draft.trim()}
        >
          Отправить
        </button>
      </form>
    </section>
  );
}
