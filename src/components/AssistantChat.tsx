"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AssistantActions,
  AssistantContextSnapshot,
  AssistantMode,
} from "@/lib/admin-assistant";
import { parseAssistantMode } from "@/lib/admin-assistant";
import {
  ASSISTANT_MODE_PILLS,
  ASSISTANT_ONBOARD_KEY,
  ASSISTANT_ONBOARD_STARTERS,
  emptyUndo,
  popUndoStack,
  pushUndoStack,
  shouldOfferWriteRetry,
  undoHasItems,
  type UndoPayload,
} from "@/lib/assistant-chat-ux";
import type { AssistantPrefs } from "@/lib/assistant-prefs";
import { summarizeAssistantPrefsForHeader } from "@/lib/assistant-prefs";
import { buildAssistantDayVoice } from "@/lib/assistant-day-voice";
import {
  countAssistantApplyQueue,
  enqueueAssistantApply,
  listAssistantApplyQueue,
  removeAssistantApply,
  subscribeAssistantApplyQueue,
} from "@/lib/assistant-apply-queue";
import { userWantsStartWorkout, userWantsWrite } from "@/lib/assistant-intent";
import { prepareAssistantImage } from "@/lib/assistant-image-client";
import { subscribeConnectivity } from "@/lib/connectivity";
import { formatDateInput, requireDateKey } from "@/lib/dates";
import { getImageUrl, withBasePath } from "@/lib/paths";
import {
  formatConfidencePercent,
  getConfidenceTone,
  confidenceToneClasses,
} from "@/lib/recognition-confidence-ui";
import { DEFAULT_LOW_CONFIDENCE } from "@/lib/confirm-card-draft";

type ChatRole = "user" | "assistant";

type ToolResult = {
  ok: boolean;
  tool: string;
  message: string;
  data?: unknown;
};

type PhotoDraft = {
  dishName: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
  sugar?: number;
  portionGrams?: number;
  confidence?: number;
  photoKind?: string;
  barcode?: string;
  brand?: string;
  recognitionSource?: string;
};

type ChatTurn = {
  id: string;
  role: ChatRole;
  content: string;
  actions?: AssistantActions | null;
  tools?: ToolResult[];
  undo?: UndoPayload | null;
  imagePreview?: string | null;
  /** Server reported a successful write tool run. */
  wrote?: boolean | null;
};

const STORAGE_KEY = "cv-assistant-chat-v6";

const STARTERS = [
  "Составь план на завтра и добавь в план",
  "Запиши ужин: курица с рисом ~550 ккал",
  "Начни сегодняшнюю тренировку",
  "Выпил 300 мл воды",
];

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function welcomeTurn(): ChatTurn {
  return {
    id: "welcome",
    role: "assistant",
    content:
      "Привет! Могу сам записать рацион, план зала, воду, вес — или стартовать тренировку. Кинь фото еды и нажми → — покажу карточку, ты подтвердишь запись.",
  };
}

function loadOnboarded(userId: string | undefined): boolean {
  if (typeof window === "undefined" || !userId) return true;
  try {
    return localStorage.getItem(`${ASSISTANT_ONBOARD_KEY}:${userId}`) === "1";
  } catch {
    return true;
  }
}

function saveOnboarded(userId: string | undefined) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(`${ASSISTANT_ONBOARD_KEY}:${userId}`, "1");
  } catch {
    // quota
  }
}

function loadStored(userId: string | undefined) {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      turns?: ChatTurn[];
      date?: string;
      mode?: AssistantMode;
      undoStack?: UndoPayload[];
    };
    if (!Array.isArray(parsed.turns) || parsed.turns.length === 0) return null;
    return {
      turns: parsed.turns.slice(-80).map((t) => ({
        ...t,
        imagePreview: undefined,
      })),
      date: typeof parsed.date === "string" ? parsed.date : null,
      mode:
        parsed.mode === "food" || parsed.mode === "gym" || parsed.mode === "week" || parsed.mode === "all"
          ? parsed.mode
          : "all",
      undoStack: Array.isArray(parsed.undoStack)
        ? parsed.undoStack.filter((u) => undoHasItems(u)).slice(-8)
        : [],
    };
  } catch {
    return null;
  }
}

function saveStored(
  userId: string | undefined,
  turns: ChatTurn[],
  date: string,
  mode: AssistantMode,
  undoStack: UndoPayload[],
) {
  if (typeof window === "undefined" || !userId) return;
  try {
    const slim = turns.slice(-80).map(({ imagePreview: _p, ...rest }) => rest);
    localStorage.setItem(
      `${STORAGE_KEY}:${userId}`,
      JSON.stringify({
        turns: slim,
        date,
        mode,
        undoStack: undoStack.slice(-8),
        savedAt: Date.now(),
      }),
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


function lastUserContentBefore(turns: ChatTurn[], assistantId: string): string | null {
  const idx = turns.findIndex((t) => t.id === assistantId);
  if (idx <= 0) return null;
  for (let i = idx - 1; i >= 0; i--) {
    if (turns[i]?.role === "user") return turns[i]!.content;
  }
  return null;
}

function ToolChips({ tools }: { tools: ToolResult[] }) {
  if (!tools.length) return null;
  return (
    <div className="mt-1.5 space-y-0.5">
      {tools.map((t, i) => (
        <p
          key={`${t.tool}-${i}`}
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-snug ${
            t.ok
              ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
              : "bg-rose-50 text-rose-900"
          }`}
        >
          {t.ok ? "✓ " : "✗ "}
          {t.message}
        </p>
      ))}
    </div>
  );
}

function PhotoConfirm({
  tool,
  date,
  busy,
  online,
  onDone,
  onFlash,
}: {
  tool: ToolResult;
  date: string;
  busy: boolean;
  online: boolean;
  onDone: (result: ToolResult, undo: UndoPayload) => void;
  onFlash: (msg: string) => void;
}) {
  const data = (tool.data ?? {}) as {
    pending?: boolean;
    imagePath?: string;
    drafts?: PhotoDraft[];
    date?: string;
  };
  const [pending, setPending] = useState(false);
  const [drafts, setDrafts] = useState<PhotoDraft[]>(() =>
    (data.drafts ?? []).map((d) => ({ ...d })),
  );

  if (!tool.ok) {
    return (
      <p className="mt-1.5 rounded-md bg-rose-50 px-1.5 py-1 text-[10px] font-medium text-rose-900">
        {tool.message || "Не удалось разобрать фото"}
      </p>
    );
  }
  if (!data.pending || !data.imagePath || !data.drafts?.length) return null;

  function updateDraft(index: number, patch: Partial<PhotoDraft>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  async function confirm() {
    setPending(true);
    try {
      const body = {
        kind: "photo" as const,
        // Always the day currently selected in the chat — not a stale
        // recognition payload date (UTC / yesterday from storage).
        date,
        imagePath: data.imagePath,
        drafts,
      };
      // Wave A6 — already recognized: queue apply offline (no LLM).
      if (!online) {
        enqueueAssistantApply("photo", body);
        onFlash("Офлайн — добавлю в рацион, когда появится сеть");
        return;
      }
      const resp = await fetch(withBasePath("/api/assistant/apply"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await resp.json().catch(() => null)) as {
        error?: string;
        result?: ToolResult;
      } | null;
      if (!resp.ok || !json?.result) throw new Error(json?.error || "Не удалось");
      const meals = (json.result.data as { meals?: Array<{ id: string }> } | undefined)?.meals ?? [];
      onDone(json.result, {
        ...emptyUndo(),
        mealIds: meals.map((m) => m.id).filter(Boolean),
      });
      onFlash("Добавил в рацион");
    } catch (err) {
      onFlash(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="confirm-family mt-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getImageUrl(data.imagePath, { w: 256 })}
        alt="Распознанное фото"
        className="confirm-family-hero"
      />
      <p className="confirm-family-skim">
        День {date} · проверь и подтверди — пока не в дневнике
      </p>
      <div className="space-y-2.5">
        {drafts.map((d, i) => {
          const tone =
            typeof d.confidence === "number"
              ? getConfidenceTone(d.confidence, DEFAULT_LOW_CONFIDENCE)
              : null;
          return (
            <div key={`${d.dishName}-${i}`} className="confirm-family-dish">
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="text"
                  value={d.dishName}
                  disabled={busy || pending}
                  onChange={(e) => updateDraft(i, { dishName: e.target.value })}
                  className="confirm-family-input min-w-0 flex-1 font-semibold"
                  aria-label="Название блюда"
                />
                {tone && d.confidence != null ? (
                  <span
                    className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${confidenceToneClasses(tone)}`}
                  >
                    {formatConfidencePercent(d.confidence)}
                  </span>
                ) : null}
              </div>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {(
                  [
                    ["calories", "ккал"],
                    ["protein", "Б"],
                    ["fat", "Ж"],
                    ["carbs", "У"],
                    ["fiber", "Клетч."],
                    ["sugar", "Сахар"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="confirm-family-label">
                    {label}
                    <input
                      type="number"
                      inputMode="decimal"
                      value={d[key] ?? ""}
                      disabled={busy || pending}
                      onChange={(e) => {
                        const n = e.target.value === "" ? undefined : Number(e.target.value);
                        updateDraft(i, {
                          [key]: n != null && Number.isFinite(n) ? n : undefined,
                        } as Partial<PhotoDraft>);
                      }}
                      className="confirm-family-input"
                    />
                  </label>
                ))}
              </div>
              <label className="confirm-family-label mt-1.5 inline-block">
                Порция, г
                <input
                  type="number"
                  inputMode="numeric"
                  value={d.portionGrams ?? ""}
                  disabled={busy || pending}
                  onChange={(e) => {
                    const n = e.target.value === "" ? undefined : Number(e.target.value);
                    updateDraft(i, {
                      portionGrams: n != null && Number.isFinite(n) ? n : undefined,
                    });
                  }}
                  className="confirm-family-input w-24"
                />
              </label>
            </div>
          );
        })}
      </div>
      <div className="confirm-family-actions">
        <button
          type="button"
          disabled={busy || pending}
          className="confirm-family-cta"
          onClick={() => void confirm()}
        >
          {pending ? "Пишу…" : online ? "Добавить в рацион" : "В очередь офлайн"}
        </button>
      </div>
    </div>
  );
}

function ActionCard({
  actions,
  date,
  streamDone,
  online,
  onFlash,
  onApplied,
}: {
  actions: AssistantActions;
  date: string;
  /** K/L: per-kind stream writes — gated kinds stay confirmable. */
  streamDone: {
    meals: boolean;
    routine: boolean;
    shopping: boolean;
    start: boolean;
    water: boolean;
  };
  online: boolean;
  onFlash: (msg: string) => void;
  onApplied: (undo: UndoPayload) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [localDone, setLocalDone] = useState({
    meals: false,
    routine: false,
    shopping: false,
    start: false,
    water: false,
  });

  const mealsDone = streamDone.meals || localDone.meals;
  const routineDone = streamDone.routine || localDone.routine;
  const shoppingDone = streamDone.shopping || localDone.shopping;
  const startDone = streamDone.start || localDone.start;
  const waterDone = streamDone.water || localDone.water;

  const needsMeals = Boolean(actions.meals?.length);
  const needsRoutine = Boolean(actions.workoutDays?.length);
  const needsShopping = Boolean(actions.shopping?.length);
  const needsStart = Boolean(actions.startWorkout);
  const needsWater = typeof actions.waterMl === "number" && actions.waterMl > 0;

  const alreadyApplied =
    (!needsMeals || mealsDone) &&
    (!needsRoutine || routineDone) &&
    (!needsShopping || shoppingDone) &&
    (!needsStart || startDone) &&
    (!needsWater || waterDone) &&
    (needsMeals || needsRoutine || needsShopping || needsStart || needsWater);

  async function apply(kind: "meals" | "routine" | "shopping" | "start" | "water") {
    setBusy(kind);
    try {
      const body = { kind, date, actions };
      if (!online) {
        enqueueAssistantApply(kind, body);
        setLocalDone((prev) => ({ ...prev, [kind]: true }));
        onFlash(
          kind === "meals"
            ? "Офлайн — запись в дневник в очереди"
            : kind === "routine"
              ? "Офлайн — план зала в очереди"
              : kind === "shopping"
                ? "Офлайн — покупки в очереди"
                : kind === "water"
                  ? "Офлайн — вода в очереди"
                  : "Офлайн — старт тренировки в очереди",
        );
        return;
      }
      const resp = await fetch(withBasePath("/api/assistant/apply"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await resp.json().catch(() => null)) as {
        error?: string;
        meals?: Array<{ id: string }>;
        routines?: Array<{ id: string }>;
        result?: { message?: string; data?: { waterId?: string } };
      } | null;
      if (!resp.ok) throw new Error(data?.error || "Не удалось");
      setLocalDone((prev) => ({ ...prev, [kind]: true }));
      if (kind === "meals") {
        onFlash(`В дневник: ${data?.meals?.length ?? 0}`);
        onApplied({
          ...emptyUndo(),
          mealIds: (data?.meals ?? []).map((m) => m.id).filter(Boolean),
        });
      } else if (kind === "routine") {
        onFlash("В план зала");
        onApplied({
          ...emptyUndo(),
          routineIds: (data?.routines ?? []).map((r) => r.id).filter(Boolean),
        });
      } else if (kind === "shopping") {
        onFlash(data?.result?.message ?? "В покупки");
        onApplied(emptyUndo());
      } else if (kind === "water") {
        const waterId = data?.result?.data?.waterId;
        onFlash(data?.result?.message ?? "Вода записана");
        onApplied({
          ...emptyUndo(),
          waterIds: waterId ? [waterId] : [],
        });
      } else {
        onFlash(data?.result?.message ?? "Тренировка начата");
        onApplied(emptyUndo());
      }
    } catch (err) {
      onFlash(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  const gymOnly =
    needsRoutine && !needsMeals && !needsShopping && !needsStart && !needsWater;
  const shoppingOnly =
    needsShopping && !needsMeals && !needsRoutine && !needsStart && !needsWater;
  const startOnly =
    needsStart && !needsMeals && !needsRoutine && !needsShopping && !needsWater;
  const waterOnly =
    needsWater && !needsMeals && !needsRoutine && !needsShopping && !needsStart;
  const skim = alreadyApplied
    ? gymOnly
      ? "План зала · уже записано"
      : shoppingOnly
        ? "Покупки · уже записано"
        : startOnly
          ? "Тренировка · уже записано"
          : waterOnly
            ? "Вода · уже записано"
            : `День ${date} · уже записано`
    : gymOnly
      ? "План зала · подтверди запись"
      : shoppingOnly
        ? "Покупки · подтверди запись"
        : startOnly
          ? "Тренировка · подтверди старт"
          : waterOnly
            ? "Вода · подтверди запись"
            : `День ${date} · подтверди запись`;

  return (
    <div className="confirm-family mt-2 text-[12px] leading-snug text-[var(--ink)]">
      <p className="confirm-family-skim">{skim}</p>
      {actions.summary ? (
        <p className="mb-1.5 font-display text-[13px] font-semibold text-[var(--accent-ink)]">
          {actions.summary}
        </p>
      ) : null}
      {actions.meals?.length ? (
        <ul className="confirm-family-dish space-y-1">
          {actions.meals.map((m) => (
            <li key={m.name}>
              <span className="font-semibold">{m.name}</span>
              {m.kcal != null ? ` — ${m.kcal} ккал` : ""}
              {m.protein != null || m.fat != null || m.carbs != null
                ? ` · Б${m.protein ?? "—"} Ж${m.fat ?? "—"} У${m.carbs ?? "—"}`
                : ""}
              {m.note ? ` · ${m.note}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {actions.workoutDays?.length ? (
        <ul className="confirm-family-dish mt-1.5 space-y-1">
          {actions.workoutDays.map((w) => (
            <li key={`${w.day}-${w.focus}`}>
              <span className="font-semibold">{w.day}</span>: {w.focus}
              {w.notes ? ` — ${w.notes}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {actions.shopping?.length ? (
        <ul className="confirm-family-dish mt-1.5 space-y-1">
          {actions.shopping.map((name) => (
            <li key={name}>
              <span className="font-semibold">{name}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {actions.startWorkout ? (
        <p className="mt-1.5 text-[12px] font-medium text-[var(--muted-strong)]">
          Старт сегодняшней тренировки по плану
        </p>
      ) : null}
      {needsWater ? (
        <p className="mt-1.5 text-[12px] font-medium text-[var(--muted-strong)]">
          Вода · {actions.waterMl} мл
        </p>
      ) : null}
      <div className="confirm-family-actions flex flex-wrap gap-1.5">
        {alreadyApplied ? (
          needsRoutine || needsStart ? (
            <Link href="/workouts" className="confirm-family-secondary">
              Открыть зал
            </Link>
          ) : null
        ) : (
          <>
            {needsMeals && !mealsDone ? (
              <button
                type="button"
                className="confirm-family-cta"
                disabled={busy === "meals"}
                onClick={() => void apply("meals")}
              >
                {busy === "meals" ? "…" : online ? "В дневник" : "В очередь"}
              </button>
            ) : null}
            {needsWater && !waterDone ? (
              <button
                type="button"
                className="confirm-family-cta"
                disabled={busy === "water"}
                onClick={() => void apply("water")}
              >
                {busy === "water" ? "…" : online ? "В воду" : "В очередь"}
              </button>
            ) : null}
            {needsRoutine && !routineDone ? (
              <>
                <button
                  type="button"
                  className="confirm-family-cta"
                  disabled={busy === "routine"}
                  onClick={() => void apply("routine")}
                >
                  {busy === "routine" ? "…" : online ? "В план зала" : "В очередь"}
                </button>
                <Link href="/workouts" className="confirm-family-secondary">
                  Зал
                </Link>
              </>
            ) : null}
            {needsShopping && !shoppingDone ? (
              <button
                type="button"
                className="confirm-family-cta"
                disabled={busy === "shopping"}
                onClick={() => void apply("shopping")}
              >
                {busy === "shopping" ? "…" : online ? "В покупки" : "В очередь"}
              </button>
            ) : null}
            {needsStart && !startDone ? (
              <>
                <button
                  type="button"
                  className="confirm-family-cta"
                  disabled={busy === "start"}
                  onClick={() => void apply("start")}
                >
                  {busy === "start" ? "…" : online ? "Начать тренировку" : "В очередь"}
                </button>
                <Link href="/workouts" className="confirm-family-secondary">
                  Зал
                </Link>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export function AssistantChat() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const userId = session?.user?.id;
  const [hydrated, setHydrated] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([welcomeTurn()]);
  // Local calendar day — never UTC via toISOString (writes landed on the wrong date).
  const [date, setDate] = useState(() => formatDateInput(new Date()));
  const [serverToday, setServerToday] = useState<string | null>(null);
  /** User (or ?date=) pinned a day — don't overwrite with server today. */
  const [datePinned, setDatePinned] = useState(false);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<AssistantMode>("all");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<AssistantContextSnapshot | null>(null);
  const [prefs, setPrefs] = useState<AssistantPrefs>({ likes: [], dislikes: [], notes: [] });
  const [undoStack, setUndoStack] = useState<UndoPayload[]>([]);
  const [online, setOnline] = useState(true);
  const [applyQueued, setApplyQueued] = useState(0);
  const [showOnboard, setShowOnboard] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [dislikeDraft, setDislikeDraft] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const flushingApply = useRef(false);

  useEffect(() => {
    const stored = loadStored(userId);
    if (stored) {
      setTurns(stored.turns);
      setMode(stored.mode);
      setUndoStack(stored.undoStack);
    }
    setShowOnboard(!loadOnboarded(userId));
    const modeParam = searchParams.get("mode");
    if (modeParam) setMode(parseAssistantMode(modeParam));
    const q = searchParams.get("q")?.trim();
    if (q) setDraft(q.slice(0, 6000));
    const urlDate = requireDateKey(searchParams.get("date"));
    const localToday = formatDateInput(new Date());
    if (urlDate) {
      setDate(urlDate);
      setDatePinned(true);
    } else {
      // Do not restore yesterday's stored date — default to local today.
      setDate(localToday);
      setDatePinned(false);
    }
    setHydrated(true);
  }, [userId, searchParams]);

  useEffect(() => {
    if (!hydrated) return;
    saveStored(userId, turns, date, mode, undoStack);
  }, [hydrated, userId, turns, date, mode, undoStack]);

  useEffect(() => subscribeConnectivity(setOnline), []);
  useEffect(
    () =>
      subscribeAssistantApplyQueue(() => setApplyQueued(countAssistantApplyQueue())),
    [],
  );
  useEffect(() => {
    setApplyQueued(countAssistantApplyQueue());
  }, []);

  const refreshSnapshot = useCallback(
    async (day: string) => {
      try {
        const resp = await fetch(withBasePath(`/api/assistant?date=${encodeURIComponent(day)}`));
        const data = (await resp.json().catch(() => null)) as {
          snapshot?: AssistantContextSnapshot;
          prefs?: AssistantPrefs;
          today?: string;
        } | null;
        if (resp.ok && data?.snapshot) setSnapshot(data.snapshot);
        if (resp.ok && data?.prefs) setPrefs(data.prefs);
        const today = requireDateKey(data?.today ?? null);
        if (today) {
          setServerToday(today);
          // Align to profile timezone "today" unless the user picked another day.
          if (!datePinned && day !== today) {
            setDate(today);
          }
        }
      } catch {
        // ignore
      }
    },
    [datePinned],
  );

  useEffect(() => {
    if (!hydrated) return;
    void refreshSnapshot(date);
  }, [hydrated, date, refreshSnapshot]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy, status]);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function showFlash(msg: string) {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2200);
  }

  /** Wave A6 — flush queued photo/meals/routine applies when online. */
  const flushApplyQueue = useCallback(async () => {
    if (!online || flushingApply.current) return;
    const items = listAssistantApplyQueue();
    if (items.length === 0) return;
    flushingApply.current = true;
    try {
      for (const item of items) {
        try {
          const resp = await fetch(withBasePath("/api/assistant/apply"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.body),
          });
          if (!resp.ok) continue;
          removeAssistantApply(item.id);
          showFlash(
            item.kind === "photo" || item.kind === "meals"
              ? "Офлайн-очередь: добавил в рацион"
              : "Офлайн-очередь: план зала",
          );
          void refreshSnapshot(date);
        } catch {
          // keep item for next online
        }
      }
    } finally {
      flushingApply.current = false;
      setApplyQueued(countAssistantApplyQueue());
    }
  }, [online, date, refreshSnapshot]);

  useEffect(() => {
    if (online) void flushApplyQueue();
  }, [online, flushApplyQueue]);

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function dismissOnboard() {
    saveOnboarded(userId);
    setShowOnboard(false);
  }

  function rememberUndo(undo: UndoPayload | null | undefined) {
    if (!undo || !undoHasItems(undo)) return;
    setUndoStack((prev) => pushUndoStack(prev, undo));
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

  async function confirmWeightOverwrite(tool: ToolResult) {
    const data =
      tool.data && typeof tool.data === "object" ? (tool.data as Record<string, unknown>) : null;
    if (!data?.needsConfirm || typeof data.weightKg !== "number") return;
    if (busy || !online) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch(withBasePath("/api/assistant/apply"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "weight",
          date: typeof data.date === "string" ? data.date : date,
          actions: {
            apply: true,
            weightKg: data.weightKg,
            targetDate: typeof data.date === "string" ? data.date : date,
            overwriteWeight: true,
          },
        }),
      });
      const payload = (await resp.json().catch(() => null)) as {
        error?: string;
        result?: ToolResult;
        tools?: ToolResult[];
      } | null;
      if (!resp.ok) throw new Error(payload?.error || "Не удалось заменить вес");
      const result = payload?.result ?? payload?.tools?.[0];
      if (result) {
        const rd =
          result.data && typeof result.data === "object"
            ? (result.data as Record<string, unknown>)
            : null;
        if (result.ok && typeof rd?.weightId === "string") {
          rememberUndo({
            ...emptyUndo(),
            weightIds: [rd.weightId],
          });
        }
        setTurns((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: result.message,
            tools: [result],
            wrote: result.ok,
          },
        ]);
        showFlash(result.ok ? "Вес обновлён" : result.message);
        if (result.ok) void refreshSnapshot(date);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function undoLast() {
    const { stack, popped } = popUndoStack(undoStack);
    if (!popped || !undoHasItems(popped) || busy || !online) return;
    setBusy(true);
    setUndoStack(stack);
    try {
      const resp = await fetch(withBasePath("/api/assistant/apply"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "undo", undo: popped }),
      });
      const data = (await resp.json().catch(() => null)) as {
        error?: string;
        result?: ToolResult;
      } | null;
      if (!resp.ok) throw new Error(data?.error || "Не удалось отменить");
      setTurns((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: data?.result?.message || "Отменил последнюю запись.",
          tools: data?.result ? [data.result] : [],
        },
      ]);
      void refreshSnapshot(date);
    } catch (err) {
      setUndoStack((prev) => pushUndoStack(prev, popped));
      setError(err instanceof Error ? err.message : "Ошибка отмены");
    } finally {
      setBusy(false);
    }
  }

  async function send(text: string) {
    if (!online) {
      setError("Нет сети — ассистент недоступен офлайн");
      return;
    }
    const hasPhoto = Boolean(photo);
    const content = text.trim() || (hasPhoto ? "Что на фото?" : "");
    if ((!content && !hasPhoto) || busy) return;

    dismissOnboard();

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
          // continue
        }
      }
    }

    setError(null);
    setDraft("");
    setStatus(hasPhoto ? "Готовлю фото…" : null);

    let imageBase64: string | undefined;
    let imageMime: string | undefined;
    const preview: string | null = photoPreview;
    if (photo) {
      try {
        const encoded = await prepareAssistantImage(photo);
        imageBase64 = encoded.base64;
        imageMime = encoded.mime;
      } catch (err) {
        setStatus(null);
        setError(err instanceof Error ? err.message : "Фото не прочиталось");
        return;
      }
    }

    const userTurn: ChatTurn = {
      id: newId(),
      role: "user",
      content,
      imagePreview: preview,
    };
    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);
    clearPhoto();
    setBusy(true);
    if (imageBase64) {
      setStatus("Смотрю фото — сейчас покажу, что увидел…");
    }

    const history = nextTurns
      .filter((t) => t.id !== "welcome")
      .map((t) => ({ role: t.role, content: t.content }));

    const assistantId = newId();
    setTurns((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    // Always preview photos first — user confirms via PhotoConfirm.
    const payload = {
      messages: history,
      date,
      mode,
      ...(imageBase64
        ? {
            imageBase64,
            imageMime,
            savePhoto: false,
          }
        : {}),
    };

    try {
      const resp = await fetch(withBasePath("/api/assistant/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok || !resp.body) {
        const fallback = await fetch(withBasePath("/api/assistant"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await fallback.json().catch(() => null)) as {
          reply?: string;
          actions?: AssistantActions | null;
          tools?: ToolResult[];
          undo?: UndoPayload;
          wrote?: boolean;
          snapshot?: AssistantContextSnapshot;
          prefs?: AssistantPrefs;
          error?: string;
        } | null;
        if (!fallback.ok) throw new Error(data?.error || "Не удалось получить ответ");
        if (data?.snapshot) setSnapshot(data.snapshot);
        if (data?.prefs) setPrefs(data.prefs);
        rememberUndo(data?.undo);
        setTurns((prev) =>
          prev.map((t) =>
            t.id === assistantId
              ? {
                  ...t,
                  content: data?.reply?.trim() || "…",
                  actions: data?.actions ?? null,
                  tools: data?.tools ?? [],
                  undo: data?.undo ?? null,
                  wrote: typeof data?.wrote === "boolean" ? data.wrote : null,
                }
              : t,
          ),
        );
        void refreshSnapshot(date);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      let sawDone = false;
      const liveTools: ToolResult[] = [];
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
          if (ev.event === "status" && typeof json.text === "string") {
            setStatus(json.text);
          }
          if (ev.event === "tool") {
            liveTools.push({
              ok: Boolean(json.ok),
              tool: String(json.tool || "tool"),
              message: String(json.message || ""),
              data: json.data,
            });
            setTurns((prev) =>
              prev.map((t) => (t.id === assistantId ? { ...t, tools: [...liveTools] } : t)),
            );
          }
          if (ev.event === "meta") {
            if (json.snapshot) setSnapshot(json.snapshot as AssistantContextSnapshot);
            if (json.prefs) setPrefs(json.prefs as AssistantPrefs);
          }
          if (ev.event === "done") {
            sawDone = true;
            if (json.snapshot) setSnapshot(json.snapshot as AssistantContextSnapshot);
            if (json.prefs) setPrefs(json.prefs as AssistantPrefs);
            const undo = (json.undo as UndoPayload | undefined) ?? null;
            rememberUndo(undo);
            const wrote = typeof json.wrote === "boolean" ? json.wrote : null;
            setTurns((prev) =>
              prev.map((t) =>
                t.id === assistantId
                  ? {
                      ...t,
                      content: String(json.reply || acc).trim() || "…",
                      actions: (json.actions as AssistantActions | null) ?? null,
                      tools: (json.tools as ToolResult[] | undefined) ?? liveTools,
                      undo,
                      wrote,
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
      if (!sawDone && !acc.trim() && liveTools.length === 0) {
        throw new Error(
          imageBase64
            ? "Распознавание фото прервалось. Попробуй ещё раз — лучше при хорошей связи."
            : "Ответ ассистента прервался. Попробуй ещё раз.",
        );
      }
      if (!sawDone && liveTools.length > 0) {
        setTurns((prev) =>
          prev.map((t) =>
            t.id === assistantId
              ? {
                  ...t,
                  content: acc.trim() || t.content || "Распознал фото — подтверди ниже.",
                  tools: liveTools,
                }
              : t,
          ),
        );
      }
      void refreshSnapshot(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
      setTurns((prev) => prev.filter((t) => t.id !== assistantId || t.content || t.tools?.length));
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  async function retryWrite(assistantTurnId: string) {
    const userText = lastUserContentBefore(turns, assistantTurnId);
    if (!userText || busy || !online) return;
    await send(userText);
  }

  const remainLabel =
    snapshot?.remainingCalories != null && snapshot.targetCalories != null
      ? `остаток ${snapshot.remainingCalories} ккал`
      : snapshot
        ? `${snapshot.calories} ккал`
        : null;

  const canUndo = undoStack.some((u) => undoHasItems(u));
  const todayKey = serverToday ?? formatDateInput(new Date());
  const dayVoice = buildAssistantDayVoice({
    hour: new Date().getHours(),
    isToday: date === todayKey,
    snapshot,
  });
  const prefsSummary = summarizeAssistantPrefsForHeader(prefs);

  return (
    <section className="assistant-scene flex flex-col gap-2.5 text-[14px] leading-snug">
      {!online ? (
        <div className="offline-chrome offline-chrome-pad assistant-offline-glass" role="status">
          <p className="font-semibold">Нет сети</p>
          <p className="mt-0.5 text-[11px] text-[var(--offline-glass-muted)]">
            Чат с AI недоступен. Уже распознанные карточки можно поставить в очередь — доедут
            сами.
            {applyQueued > 0 ? ` В очереди: ${applyQueued}.` : ""}
          </p>
        </div>
      ) : applyQueued > 0 ? (
        <p className="rounded-lg border border-[var(--accent)]/25 bg-[var(--accent-soft)]/90 px-2.5 py-1.5 text-[12px] font-medium text-[var(--accent-ink)]">
          Офлайн-очередь: {applyQueued} — отправляю…
        </p>
      ) : null}

      {showOnboard ? (
        <div className="rounded-xl border border-[var(--border-quiet)] bg-white/70 px-3 py-2.5 text-[13px] text-[var(--ink)]">
          <p className="font-display text-[13px] font-semibold tracking-wide text-[var(--accent-ink)]">
            Коротко про AI
          </p>
          <p className="mt-1 text-[12px] leading-snug text-[var(--muted-strong)]">
            Пиши обычным языком — я сам добавлю в рацион или план зала. Фото сначала покажу на
            подтверждение. Можно отменить последнюю запись.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {ASSISTANT_ONBOARD_STARTERS.map((s) => (
              <button
                key={s.label}
                type="button"
                className="rounded-full border border-[var(--accent-ink)]/25 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--accent-ink)] disabled:opacity-50"
                disabled={busy || !online}
                onClick={() => {
                  if (s.label === "Фото") {
                    dismissOnboard();
                    fileRef.current?.click();
                    return;
                  }
                  void send(s.text);
                }}
              >
                {s.label}
              </button>
            ))}
            <button
              type="button"
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-ink)] underline-offset-2 hover:underline"
              onClick={dismissOnboard}
            >
              Понятно
            </button>
          </div>
        </div>
      ) : null}

      <div className="assistant-scene-toolbar">
        <label className="text-[12px] font-semibold text-[var(--muted-strong)]">
          День{" "}
          <input
            type="date"
            value={date}
            onChange={(e) => {
              const next = e.target.value;
              setDate(next);
              setDatePinned(true);
            }}
            className="ml-1 rounded-md border border-[var(--line)] bg-white px-1.5 py-0.5 text-[13px]"
            disabled={busy}
          />
        </label>
        {serverToday && date !== serverToday ? (
          <button
            type="button"
            className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950"
            disabled={busy}
            onClick={() => {
              setDate(serverToday);
              setDatePinned(false);
            }}
          >
            Сегодня {serverToday.slice(5)}
          </button>
        ) : null}
        {remainLabel ? (
          <span className="rounded-full border border-[var(--line)] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-strong)]">
            {remainLabel}
          </span>
        ) : null}
        {canUndo ? (
          <button
            type="button"
            className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-950 disabled:opacity-50"
            disabled={busy || !online}
            onClick={() => void undoLast()}
          >
            Отменить запись{undoStack.length > 1 ? ` (${undoStack.length})` : ""}
          </button>
        ) : null}
        <button
          type="button"
          className="ml-auto text-[10px] font-semibold text-[var(--muted)] underline-offset-2 hover:underline"
          disabled={busy}
          onClick={() => {
            setTurns([welcomeTurn()]);
            setUndoStack([]);
            setError(null);
          }}
        >
          Очистить
        </button>
      </div>

      {/* Wave A5 — honest memory chip (empty = nothing claimed) */}
      <div className="assistant-memory-row">
        <button
          type="button"
          className="assistant-memory-chip"
          onClick={() => setPrefsOpen((v) => !v)}
          aria-expanded={prefsOpen}
        >
          {prefsSummary
            ? `Что я о тебе знаю: ${prefsSummary}`
            : "Что я о тебе знаю — пока пусто · нажми"}
        </button>
        {prefsOpen ? (
          <div className="assistant-memory-panel">
            <p className="text-[11px] text-[var(--muted-strong)]">
              Только то, что ты сказал(а). Без догадок.
            </p>
            {prefs.dislikes.length ? (
              <p className="mt-1 text-[12px]">
                <span className="font-semibold">Не предлагаю:</span>{" "}
                {prefs.dislikes.join(", ")}
              </p>
            ) : null}
            {prefs.likes.length ? (
              <p className="mt-1 text-[12px]">
                <span className="font-semibold">Ок:</span> {prefs.likes.join(", ")}
              </p>
            ) : null}
            <form
              className="mt-2 flex flex-wrap items-end gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                const item = dislikeDraft.trim().slice(0, 80);
                if (!item) return;
                const next = {
                  ...prefs,
                  dislikes: [
                    ...prefs.dislikes.filter((d) => d.toLowerCase() !== item.toLowerCase()),
                    item,
                  ].slice(0, 24),
                };
                setDislikeDraft("");
                void savePrefs(next);
              }}
            >
              <label className="confirm-family-label grow">
                Не предлагай
                <input
                  value={dislikeDraft}
                  onChange={(e) => setDislikeDraft(e.target.value)}
                  className="confirm-family-input"
                  placeholder="например: творог"
                  disabled={busy || !online}
                />
              </label>
              <button
                type="submit"
                className="confirm-family-secondary"
                disabled={busy || !online || !dislikeDraft.trim()}
              >
                Сохранить
              </button>
            </form>
          </div>
        ) : null}
      </div>

      {/* Wave A4 — one next step from day context */}
      {dayVoice && !showOnboard ? (
        <div className="assistant-day-voice">
          <p className="min-w-0 text-[12px] font-medium text-[var(--ink)]">{dayVoice.label}</p>
          <button
            type="button"
            className="confirm-family-cta shrink-0 !min-h-8 !px-2.5 !text-[11px]"
            disabled={busy || (!online && !dayVoice.openPhoto)}
            onClick={() => {
              if (dayVoice.openPhoto) {
                fileRef.current?.click();
                return;
              }
              if (dayVoice.href && !dayVoice.draft) {
                window.location.assign(withBasePath(dayVoice.href));
                return;
              }
              if (dayVoice.draft) {
                if (online) void send(dayVoice.draft);
                else setDraft(dayVoice.draft);
              }
            }}
          >
            {dayVoice.actionLabel}
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Режим ассистента">
        {ASSISTANT_MODE_PILLS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={mode === p.id}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold disabled:opacity-50 ${
              mode === p.id
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--line)] bg-white text-[var(--muted-strong)]"
            }`}
            disabled={busy}
            onClick={() => setMode(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="assistant-scene-thread flex flex-1 flex-col gap-2 overflow-y-auto p-0.5 sm:p-1">
        {turns.map((turn) => {
          const toolOk = (sub: string) =>
            Boolean(
              turn.tools?.some(
                (t) => t.ok && t.tool !== "recognize_meal_preview" && t.tool.includes(sub),
              ),
            );
          const streamDone = {
            meals: toolOk("save") || toolOk("photo"),
            routine: toolOk("plan") || toolOk("routine"),
            shopping: toolOk("shopping"),
            start: toolOk("start"),
            water: toolOk("water"),
          };
          const weightConfirm = turn.tools?.find(
            (t) =>
              t.tool === "log_weight" &&
              !t.ok &&
              Boolean(
                t.data &&
                  typeof t.data === "object" &&
                  (t.data as { needsConfirm?: unknown }).needsConfirm,
              ),
          );
          const photoPreviewTool = turn.tools?.find(
            (t) => t.tool === "recognize_meal_preview",
          );
          const prevUser = lastUserContentBefore(turns, turn.id) || "";
          const offerRetry =
            turn.role === "assistant" &&
            shouldOfferWriteRetry({
              wrote: turn.wrote,
              wantsWrite: userWantsWrite(prevUser) || userWantsStartWorkout(prevUser),
            });
          return (
            <div
              key={turn.id}
              className={`max-w-[96%] ${
                turn.role === "user"
                  ? "assistant-scene-bubble-user ml-auto"
                  : "assistant-scene-bubble-assistant mr-auto"
              }`}
            >
              {turn.imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={turn.imagePreview}
                  alt="Фото"
                  className="mb-1.5 max-h-32 rounded-md object-cover"
                />
              ) : null}
              <div className="whitespace-pre-wrap">{turn.content || (busy ? "…" : "")}</div>
              {turn.role === "assistant" && turn.tools?.length ? (
                <ToolChips tools={turn.tools} />
              ) : null}
              {offerRetry ? (
                <div className="mt-1.5 space-y-1">
                  <p className="text-[10px] font-medium text-amber-900">
                    В чате ответил, но в дневник/план не записал.
                  </p>
                  <button
                    type="button"
                    className="rounded-md border border-amber-400 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-950 disabled:opacity-50"
                    disabled={busy || !online}
                    onClick={() => void retryWrite(turn.id)}
                  >
                    Повторить запись
                  </button>
                </div>
              ) : null}
              {weightConfirm ? (
                <div className="mt-1.5 space-y-1">
                  <p className="text-[10px] font-medium text-amber-900">{weightConfirm.message}</p>
                  <button
                    type="button"
                    className="rounded-md border border-amber-400 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-950 disabled:opacity-50"
                    disabled={busy || !online}
                    onClick={() => void confirmWeightOverwrite(weightConfirm)}
                  >
                    Заменить вес
                  </button>
                </div>
              ) : null}
              {turn.role === "assistant" && photoPreviewTool ? (
                <PhotoConfirm
                  tool={photoPreviewTool}
                  date={date}
                  busy={busy}
                  online={online}
                  onFlash={showFlash}
                  onDone={(result, undo) => {
                    rememberUndo(undo);
                    setTurns((prev) =>
                      prev.map((t) =>
                        t.id === turn.id
                          ? {
                              ...t,
                              tools: [
                                ...(t.tools ?? []).filter((x) => x.tool !== "recognize_meal_preview"),
                                result,
                              ],
                              undo,
                              wrote: true,
                            }
                          : t,
                      ),
                    );
                    void refreshSnapshot(date);
                  }}
                />
              ) : null}
              {turn.role === "assistant" && turn.actions ? (
                <ActionCard
                  actions={turn.actions}
                  date={date}
                  streamDone={streamDone}
                  online={online}
                  onFlash={showFlash}
                  onApplied={(undo) => rememberUndo(undo)}
                />
              ) : null}
            </div>
          );
        })}
        {busy ? (
          <p className="mr-auto text-[11px] font-medium text-[var(--muted)]">
            {status || "Думаю…"}
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {flash ? (
        <p className="assistant-apply-flash text-[12px] font-medium text-[var(--accent-ink)]">{flash}</p>
      ) : null}
      {error ? <p className="text-[12px] text-red-600">{error}</p> : null}

      {!busy && !showOnboard && turns.length <= 2 ? (
        <div className="flex flex-wrap gap-1">
          {STARTERS.map((hint) => (
            <button
              key={hint}
              type="button"
              className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--muted-strong)] hover:bg-[var(--surface-mist)] disabled:opacity-50"
              disabled={busy || !online}
              onClick={() => void send(hint)}
            >
              {hint}
            </button>
          ))}
        </div>
      ) : null}

      {photoPreview ? (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-2 py-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoPreview} alt="Превью" className="h-10 w-10 rounded-md object-cover" />
          <span className="flex-1 text-[11px] text-[var(--muted-strong)]">
            Нажми → — распознаю и покажу карточку для подтверждения
          </span>
          <button
            type="button"
            className="text-[11px] font-semibold text-[var(--muted)] underline"
            onClick={clearPhoto}
            disabled={busy}
          >
            Убрать
          </button>
        </div>
      ) : null}

      <form
        className="assistant-scene-composer flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            if (!file) return;
            if (photoPreview) URL.revokeObjectURL(photoPreview);
            setPhoto(file);
            setPhotoPreview(URL.createObjectURL(file));
          }}
        />
        <button
          type="button"
          className="btn btn-secondary min-h-[4.5rem] self-stretch px-2.5 text-[11px]"
          disabled={busy || !online}
          title="Фото еды"
          onClick={() => fileRef.current?.click()}
        >
          Фото
        </button>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            online
              ? "План, рацион, вода, вес, «начни тренировку»…"
              : "Нет сети — отправка отключена"
          }
          className="input min-h-[4.5rem] flex-1 resize-y py-2.5 text-[13px] leading-snug"
          disabled={busy || !online}
          maxLength={6000}
          rows={4}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
        />
        <button
          type="submit"
          className="btn btn-primary min-h-[4.5rem] self-stretch px-3 text-[12px]"
          disabled={busy || !online || (!draft.trim() && !photo)}
        >
          →
        </button>
      </form>
    </section>
  );
}
