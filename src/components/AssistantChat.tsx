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
import { buildAssistantHistory, parseAssistantMode } from "@/lib/admin-assistant";
import {
  ASSISTANT_MODE_PILLS,
  ASSISTANT_ONBOARD_KEY,
  ASSISTANT_ONBOARD_STARTERS,
  emptyUndo,
  friendlyAssistantError,
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
import {
  clearOfflineQueueFlushError,
  markOfflineQueueFlushError,
} from "@/lib/offline-queue-flush-errors";
import {
  userWantsGymEdit,
  userWantsRepeatWorkout,
  userWantsStartWorkout,
  userWantsWrite,
} from "@/lib/assistant-intent";
import { prepareAssistantImage } from "@/lib/assistant-image-client";
import { subscribeConnectivity } from "@/lib/connectivity";
import { resolveAssistantDate } from "@/lib/assistant-date";
import { formatDateInput, isDateKey, requireDateKey } from "@/lib/dates";
import { notifyFoodSaved } from "@/lib/open-food-camera";
import { notifyWaterLogged } from "@/lib/open-water-quick";
import { getImageUrl, withBasePath } from "@/lib/paths";
import { explainWhyTheseCalories } from "@/lib/confirm-why-explanation";
import type { PhotoKind } from "@/lib/food-types";
import {
  formatConfidencePercent,
  getConfidenceTone,
  confidenceToneClasses,
} from "@/lib/recognition-confidence-ui";
import { DEFAULT_LOW_CONFIDENCE } from "@/lib/confirm-card-draft";
import { scalePhotoDraftPortion } from "@/lib/assistant-meal-patch";
import type { MealTypeKey } from "@/lib/assistant-meal-time";

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
  mealType?: MealTypeKey;
  confidence?: number;
  photoKind?: string;
  barcode?: string;
  brand?: string;
  recognitionSource?: string;
};

const PHOTO_MEAL_SLOTS: Array<{ key: MealTypeKey; label: string }> = [
  { key: "BREAKFAST", label: "Завтрак" },
  { key: "LUNCH", label: "Обед" },
  { key: "DINNER", label: "Ужин" },
  { key: "SNACK", label: "Перекус" },
];

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

function PhotoDraftWhy({ draft }: { draft: PhotoDraft }) {
  const photoKind =
    draft.photoKind === "meal" ||
    draft.photoKind === "package" ||
    draft.photoKind === "label" ||
    draft.photoKind === "barcode"
      ? (draft.photoKind as PhotoKind)
      : undefined;
  const why = explainWhyTheseCalories({
    dishName: draft.dishName,
    brand: draft.brand,
    portionGrams: draft.portionGrams,
    calories: draft.calories,
    photoKind,
    source: draft.recognitionSource,
    confidence: typeof draft.confidence === "number" ? draft.confidence : 1,
  });
  return (
    <details className="confirm-why-so mt-1.5 group">
      <summary className="cursor-pointer list-none text-[10px] font-semibold text-[var(--muted-strong)] underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
        Почему так
      </summary>
      <p className="mt-1 text-[10px] leading-snug text-[var(--muted)]">{why.summary}</p>
      {why.detail ? (
        <p className="mt-0.5 text-[10px] leading-snug text-[var(--muted)]">{why.detail}</p>
      ) : null}
    </details>
  );
}

function ToolChips({ tools }: { tools: ToolResult[] }) {
  // Preview has its own PhotoConfirm CTA — hide duplicate chip.
  const visible = tools.filter((t) => t.tool !== "recognize_meal_preview");
  if (!visible.length) return null;
  return (
    <div className="mt-1.5 space-y-0.5">
      {visible.map((t, i) => (
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
  const [mealType, setMealType] = useState<MealTypeKey | undefined>(undefined);
  const [drafts, setDrafts] = useState<PhotoDraft[]>(() =>
    (data.drafts ?? []).map((d) => ({ ...d })),
  );
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (!tool.ok) {
    return (
      <p className="mt-1.5 rounded-md bg-rose-50 px-1.5 py-1 text-[10px] font-medium text-rose-900">
        {tool.message || "Не удалось разобрать фото"}
      </p>
    );
  }
  if (!data.pending || !data.imagePath || !data.drafts?.length) {
    return (
      <p className="mt-1.5 rounded-md bg-amber-50 px-1.5 py-1 text-[10px] font-medium text-amber-950">
        {tool.message || "Фото разобрано, но карточка пустая — попробуй ещё раз"}
      </p>
    );
  }

  function updateDraft(index: number, patch: Partial<PhotoDraft>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function updateDraftPortion(index: number, raw: string) {
    const n = raw === "" ? undefined : Number(raw);
    if (n == null || !Number.isFinite(n)) {
      updateDraft(index, { portionGrams: undefined });
      return;
    }
    setDrafts((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        const scaled = scalePhotoDraftPortion(
          {
            dishName: d.dishName,
            calories: d.calories,
            protein: d.protein ?? null,
            fat: d.fat ?? null,
            carbs: d.carbs ?? null,
            fiber: d.fiber ?? null,
            sugar: d.sugar ?? null,
            portionGrams: d.portionGrams ?? null,
            mealType: d.mealType ?? null,
          },
          n,
        );
        return {
          ...d,
          portionGrams: scaled.portionGrams ?? n,
          calories: scaled.calories,
          protein: scaled.protein ?? undefined,
          fat: scaled.fat ?? undefined,
          carbs: scaled.carbs ?? undefined,
          fiber: scaled.fiber ?? undefined,
          sugar: scaled.sugar ?? undefined,
        };
      }),
    );
  }

  function addDraft() {
    setDrafts((prev) => {
      const last = prev[prev.length - 1];
      return [
        ...prev,
        {
          dishName: last?.dishName ? `${last.dishName}` : "Блюдо",
          calories: last?.calories ?? 200,
          protein: last?.protein,
          fat: last?.fat,
          carbs: last?.carbs,
          fiber: last?.fiber,
          sugar: last?.sugar,
          portionGrams: last?.portionGrams,
          confidence: last?.confidence,
        },
      ].slice(0, 8);
    });
  }

  function removeDraft(index: number) {
    setDrafts((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function confirm() {
    setPending(true);
    try {
      const draftsWithSlot = drafts.map((d) => ({
        ...d,
        ...(mealType ? { mealType } : {}),
      }));
      const body = {
        kind: "photo" as const,
        // Always the day currently selected in the chat — not a stale
        // recognition payload date (UTC / yesterday from storage).
        date,
        imagePath: data.imagePath,
        drafts: draftsWithSlot,
        ...(mealType ? { mealType } : {}),
      };
      // Wave A6 — already recognized: queue apply offline (no LLM).
      if (!online) {
        enqueueAssistantApply("photo", body);
        onFlash("Офлайн — добавлю в рацион, когда появится сеть");
        setDismissed(true);
        onDone(
          {
            ok: true,
            tool: "save_photo_drafts",
            message: "В очереди офлайн",
            data: { queued: true },
          },
          emptyUndo(),
        );
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
      const resultData = (json.result.data ?? {}) as {
        meals?: Array<{ id: string }>;
        partial?: boolean;
        saved?: number;
        skipped?: number;
      };
      const meals = resultData.meals ?? [];
      if (!meals.length && !resultData.partial) {
        throw new Error(json.result.message || "Не удалось сохранить блюда");
      }
      setDismissed(true);
      notifyFoodSaved();
      onDone(json.result, {
        ...emptyUndo(),
        mealIds: meals.map((m) => m.id).filter(Boolean),
      });
      if (resultData.partial && resultData.saved != null && resultData.skipped) {
        onFlash(`Сохранено ${resultData.saved} из ${resultData.saved + resultData.skipped}`);
      } else {
        onFlash(json.result.message?.startsWith("Сохранено") ? json.result.message : "Добавил в рацион");
      }
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
      <div className="mb-2 flex flex-wrap gap-1">
        {PHOTO_MEAL_SLOTS.map((slot) => (
          <button
            key={slot.key}
            type="button"
            disabled={busy || pending}
            className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
              mealType === slot.key
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                : "border-[var(--border)] text-[var(--muted-strong)]"
            }`}
            onClick={() => setMealType((prev) => (prev === slot.key ? undefined : slot.key))}
          >
            {slot.label}
          </button>
        ))}
      </div>
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
              <div className="mt-1.5 flex flex-wrap items-end gap-2">
                <label className="confirm-family-label inline-block">
                  Порция, г
                  <input
                    type="number"
                    inputMode="numeric"
                    value={d.portionGrams ?? ""}
                    disabled={busy || pending}
                    onChange={(e) => updateDraftPortion(i, e.target.value)}
                    className="confirm-family-input w-24"
                  />
                </label>
                {drafts.length > 1 ? (
                  <button
                    type="button"
                    className="text-[10px] font-semibold text-[var(--muted)] underline-offset-2 hover:underline"
                    disabled={busy || pending}
                    onClick={() => removeDraft(i)}
                  >
                    Убрать
                  </button>
                ) : null}
              </div>
              <PhotoDraftWhy draft={d} />
            </div>
          );
        })}
      </div>
      <div className="confirm-family-actions flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={busy || pending}
          className="confirm-family-cta"
          onClick={() => void confirm()}
        >
          {pending
            ? "Пишу…"
            : online
              ? drafts.length > 1
                ? `Добавить все (${drafts.length})`
                : "Добавить в рацион"
              : "В очередь офлайн"}
        </button>
        {drafts.length < 8 ? (
          <button
            type="button"
            disabled={busy || pending}
            className="confirm-family-secondary"
            onClick={addDraft}
          >
            + ещё блюдо
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ActionCard({
  actions,
  date,
  today,
  streamDone,
  online,
  onFlash,
  onApplied,
}: {
  actions: AssistantActions;
  date: string;
  /** Profile timezone "today" — base for relative targetDate (вчера/завтра). */
  today: string;
  /** K–N: per-kind stream writes — gated kinds stay confirmable. */
  streamDone: {
    meals: boolean;
    routine: boolean;
    shopping: boolean;
    start: boolean;
    startEmpty: boolean;
    repeat: boolean;
    patchWorkout: boolean;
    water: boolean;
    weight: boolean;
    deleteMeals: boolean;
    patchMeals: boolean;
  };
  online: boolean;
  onFlash: (msg: string) => void;
  onApplied: (undo: UndoPayload) => void;
}) {
  const applyDate =
    resolveAssistantDate(actions.targetDate, today) ??
    (actions.targetDate && isDateKey(actions.targetDate) ? actions.targetDate : null) ??
    date;
  const [busy, setBusy] = useState<string | null>(null);
  const [localDone, setLocalDone] = useState({
    meals: false,
    routine: false,
    shopping: false,
    start: false,
    startEmpty: false,
    repeat: false,
    patchWorkout: false,
    water: false,
    weight: false,
    deleteMeals: false,
    patchMeals: false,
  });
  /** After start fails with no plan — offer empty / repeat without hiding CTAs. */
  const [startFallback, setStartFallback] = useState<{
    empty: boolean;
    repeat: boolean;
    message: string;
  } | null>(null);
  /** Durable card note — survives flash fade (soft-fail reason / what was written). */
  const [cardNote, setCardNote] = useState<{
    tone: "soft" | "ok" | "err";
    text: string;
  } | null>(null);
  const [lastOkMessage, setLastOkMessage] = useState<string | null>(null);

  const mealsDone = streamDone.meals || localDone.meals;
  const routineDone = streamDone.routine || localDone.routine;
  const shoppingDone = streamDone.shopping || localDone.shopping;
  const startDone = streamDone.start || localDone.start;
  const startEmptyDone = streamDone.startEmpty || localDone.startEmpty;
  const repeatDone = streamDone.repeat || localDone.repeat;
  const patchWorkoutDone = streamDone.patchWorkout || localDone.patchWorkout;
  const waterDone = streamDone.water || localDone.water;
  const weightDone = streamDone.weight || localDone.weight;
  const deleteDone = streamDone.deleteMeals || localDone.deleteMeals;
  const patchDone = streamDone.patchMeals || localDone.patchMeals;

  const needsMeals = Boolean(actions.meals?.length);
  const needsRoutine = Boolean(actions.workoutDays?.length);
  const needsShopping = Boolean(actions.shopping?.length);
  const needsStart = Boolean(actions.startWorkout);
  const needsStartEmpty =
    Boolean(actions.startEmptyWorkout) || Boolean(startFallback?.empty);
  const needsRepeat =
    Boolean(actions.repeatWorkout) || Boolean(startFallback?.repeat);
  const needsPatchWorkout = Boolean(
    actions.patchWorkout?.addExercises?.length ||
      actions.patchWorkout?.logSets?.length,
  );
  const needsWater = typeof actions.waterMl === "number" && actions.waterMl > 0;
  const needsWeight = typeof actions.weightKg === "number" && actions.weightKg > 0;
  const needsDelete = Boolean(actions.deleteMeals?.length);
  const needsPatch = Boolean(actions.patchMeals?.length);

  const alreadyApplied =
    (!needsMeals || mealsDone) &&
    (!needsRoutine || routineDone) &&
    (!needsShopping || shoppingDone) &&
    (!needsStart || startDone || Boolean(startFallback)) &&
    (!needsStartEmpty || startEmptyDone) &&
    (!needsRepeat || repeatDone) &&
    (!needsPatchWorkout || patchWorkoutDone) &&
    (!needsWater || waterDone) &&
    (!needsWeight || weightDone) &&
    (!needsDelete || deleteDone) &&
    (!needsPatch || patchDone) &&
    (needsMeals ||
      needsRoutine ||
      needsShopping ||
      needsStart ||
      needsStartEmpty ||
      needsRepeat ||
      needsPatchWorkout ||
      needsWater ||
      needsWeight ||
      needsDelete ||
      needsPatch);

  type ApplyKind =
    | "meals"
    | "routine"
    | "shopping"
    | "start"
    | "startEmpty"
    | "repeat"
    | "patchWorkout"
    | "water"
    | "weight"
    | "deleteMeals"
    | "patchMeals";

  async function apply(kind: ApplyKind): Promise<"ok" | "soft" | "err"> {
    setBusy(kind);
    try {
      const body = {
        kind,
        date: applyDate,
        actions: { ...actions, targetDate: applyDate },
      };
      if (!online) {
        enqueueAssistantApply(kind, body);
        setLocalDone((prev) => ({ ...prev, [kind]: true }));
        const offlineMsg =
          kind === "meals"
            ? "Офлайн — запись в дневник в очереди"
            : kind === "routine"
              ? "Офлайн — план зала в очереди"
              : kind === "shopping"
                ? "Офлайн — покупки в очереди"
                : kind === "water"
                  ? "Офлайн — вода в очереди"
                  : kind === "weight"
                    ? "Офлайн — вес в очереди"
                    : kind === "deleteMeals"
                      ? "Офлайн — удаление в очереди"
                      : kind === "patchMeals"
                        ? "Офлайн — правка в очереди"
                        : kind === "repeat"
                          ? "Офлайн — повтор тренировки в очереди"
                          : kind === "patchWorkout"
                            ? "Офлайн — правка зала в очереди"
                            : kind === "startEmpty"
                              ? "Офлайн — пустая тренировка в очереди"
                              : "Офлайн — старт тренировки в очереди";
        setLastOkMessage(offlineMsg);
        setCardNote({ tone: "ok", text: offlineMsg });
        onFlash(offlineMsg);
        return "ok";
      }
      const resp = await fetch(withBasePath("/api/assistant/apply"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await resp.json().catch(() => null)) as {
        error?: string;
        ok?: boolean;
        suggestEmpty?: boolean;
        suggestRepeat?: boolean;
        meals?: Array<{ id: string }>;
        routines?: Array<{ id: string }>;
        tools?: Array<{
          ok?: boolean;
          tool?: string;
          message?: string;
          data?: {
            meals?: Array<{ id: string }>;
            waterId?: string;
            weightId?: string;
          };
        }>;
        result?: {
          message?: string;
          data?: {
            meals?: Array<{ id: string }>;
            waterId?: string;
            weightId?: string;
            mealIds?: string[];
          };
        };
      } | null;
      if (!resp.ok) throw new Error(data?.error || "Не удалось");
      if (kind === "start" && data?.ok === false && (data.suggestEmpty || data.suggestRepeat)) {
        const softMsg =
          data.result?.message ?? "В плане пусто — выбери пустую или повтор";
        setStartFallback({
          empty: Boolean(data.suggestEmpty),
          repeat: Boolean(data.suggestRepeat),
          message: softMsg,
        });
        setCardNote({ tone: "soft", text: softMsg });
        onFlash(softMsg);
        return "soft";
      }
      const toolResult =
        data?.result ??
        data?.tools?.find((t) => t.ok) ??
        data?.tools?.[0] ??
        null;
      const mealsSaved =
        data?.meals ??
        toolResult?.data?.meals ??
        [];
      const markOk = (msg: string) => {
        setLastOkMessage(msg);
        setCardNote({ tone: "ok", text: msg });
        onFlash(msg);
      };
      if (kind === "meals") {
        if (!mealsSaved.length) {
          throw new Error(toolResult?.message || data?.error || "Нет блюд для записи");
        }
        setLocalDone((prev) => ({ ...prev, [kind]: true }));
        notifyFoodSaved();
        markOk(toolResult?.message ?? `В дневник: ${mealsSaved.length}`);
        onApplied({
          ...emptyUndo(),
          mealIds: mealsSaved.map((m) => m.id).filter(Boolean),
        });
      } else if (kind === "routine") {
        setLocalDone((prev) => ({ ...prev, [kind]: true }));
        markOk(toolResult?.message ?? data?.result?.message ?? "В план зала");
        onApplied({
          ...emptyUndo(),
          routineIds: (data?.routines ?? []).map((r) => r.id).filter(Boolean),
        });
      } else if (kind === "shopping") {
        setLocalDone((prev) => ({ ...prev, [kind]: true }));
        markOk(toolResult?.message ?? data?.result?.message ?? "В покупки");
        onApplied(emptyUndo());
      } else if (kind === "water") {
        setLocalDone((prev) => ({ ...prev, [kind]: true }));
        const waterId = toolResult?.data?.waterId ?? data?.result?.data?.waterId;
        notifyWaterLogged();
        markOk(toolResult?.message ?? data?.result?.message ?? "Вода записана");
        onApplied({
          ...emptyUndo(),
          waterIds: waterId ? [waterId] : [],
        });
      } else if (kind === "weight") {
        setLocalDone((prev) => ({ ...prev, [kind]: true }));
        const weightId = toolResult?.data?.weightId ?? data?.result?.data?.weightId;
        markOk(toolResult?.message ?? data?.result?.message ?? "Вес записан");
        onApplied({
          ...emptyUndo(),
          weightIds: weightId ? [weightId] : [],
        });
      } else if (kind === "deleteMeals") {
        setLocalDone((prev) => ({ ...prev, [kind]: true }));
        notifyFoodSaved();
        markOk(toolResult?.message ?? data?.result?.message ?? "Удалил из рациона");
        onApplied(emptyUndo());
      } else if (kind === "patchMeals") {
        setLocalDone((prev) => ({ ...prev, [kind]: true }));
        notifyFoodSaved();
        markOk(toolResult?.message ?? data?.result?.message ?? "Обновил в рационе");
        onApplied(emptyUndo());
      } else if (kind === "repeat") {
        setLocalDone((prev) => ({ ...prev, [kind]: true }));
        setStartFallback(null);
        markOk(toolResult?.message ?? data?.result?.message ?? "Тренировка повторена");
        onApplied(emptyUndo());
      } else if (kind === "patchWorkout") {
        setLocalDone((prev) => ({ ...prev, [kind]: true }));
        markOk(toolResult?.message ?? data?.result?.message ?? "Зал обновлён");
        onApplied(emptyUndo());
      } else if (kind === "startEmpty") {
        setLocalDone((prev) => ({ ...prev, startEmpty: true, start: true }));
        setStartFallback(null);
        markOk(
          toolResult?.message ??
            data?.result?.message ??
            `Пустая тренировка · ${applyDate}`,
        );
        onApplied(emptyUndo());
      } else {
        setLocalDone((prev) => ({ ...prev, [kind]: true }));
        setStartFallback(null);
        markOk(
          toolResult?.message ?? data?.result?.message ?? `Тренировка начата · ${applyDate}`,
        );
        onApplied(emptyUndo());
      }
      return "ok";
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка";
      setCardNote({ tone: "err", text: msg });
      onFlash(msg);
      return "err";
    } finally {
      setBusy(null);
    }
  }

  function pendingKinds(): ApplyKind[] {
    const kinds: ApplyKind[] = [];
    if (needsMeals && !mealsDone) kinds.push("meals");
    if (needsWater && !waterDone) kinds.push("water");
    if (needsWeight && !weightDone) kinds.push("weight");
    if (needsDelete && !deleteDone) kinds.push("deleteMeals");
    if (needsPatch && !patchDone) kinds.push("patchMeals");
    if (needsShopping && !shoppingDone) kinds.push("shopping");
    if (needsRoutine && !routineDone) kinds.push("routine");
    if (needsStart && !startDone && !startFallback) kinds.push("start");
    if (needsStartEmpty && !startEmptyDone) kinds.push("startEmpty");
    if (needsRepeat && !repeatDone) kinds.push("repeat");
    if (needsPatchWorkout && !patchWorkoutDone) kinds.push("patchWorkout");
    return kinds;
  }

  async function applyAll() {
    const kinds = pendingKinds();
    if (kinds.length < 2) return;
    let okCount = 0;
    let stopped: "soft" | "err" | null = null;
    for (const kind of kinds) {
      const status = await apply(kind);
      if (status !== "ok") {
        stopped = status;
        break;
      }
      okCount += 1;
    }
    if (okCount > 0 && (stopped || okCount < kinds.length)) {
      const partial = `Записал ${okCount} из ${kinds.length}${
        stopped === "soft" ? " — дальше выбери пустую или повтор" : ""
      }`;
      setCardNote({ tone: stopped === "soft" ? "soft" : "ok", text: partial });
      onFlash(partial);
    }
  }

  const alone = (flag: boolean, ...rest: boolean[]) => flag && rest.every((x) => !x);
  const shoppingOnly = alone(
    needsShopping,
    needsMeals,
    needsRoutine,
    needsStart,
    needsRepeat,
    needsWater,
    needsWeight,
    needsDelete,
    needsPatch,
  );
  const startOnly = alone(
    needsStart,
    needsMeals,
    needsRoutine,
    needsShopping,
    needsRepeat,
    needsWater,
    needsWeight,
    needsDelete,
    needsPatch,
  );
  const repeatOnly = alone(
    needsRepeat,
    needsMeals,
    needsRoutine,
    needsShopping,
    needsStart,
    needsWater,
    needsWeight,
    needsDelete,
    needsPatch,
  );
  const waterOnly = alone(
    needsWater,
    needsMeals,
    needsRoutine,
    needsShopping,
    needsStart,
    needsRepeat,
    needsWeight,
    needsDelete,
    needsPatch,
  );
  const weightOnly = alone(
    needsWeight,
    needsMeals,
    needsRoutine,
    needsShopping,
    needsStart,
    needsRepeat,
    needsWater,
    needsDelete,
    needsPatch,
  );
  const deleteOnly = alone(
    needsDelete,
    needsMeals,
    needsRoutine,
    needsShopping,
    needsStart,
    needsRepeat,
    needsWater,
    needsWeight,
    needsPatch,
  );
  const patchOnly = alone(
    needsPatch,
    needsMeals,
    needsRoutine,
    needsShopping,
    needsStart,
    needsRepeat,
    needsWater,
    needsWeight,
    needsDelete,
  );
  const planOnly = alone(
    needsRoutine,
    needsMeals,
    needsShopping,
    needsStart,
    needsRepeat,
    needsWater,
    needsWeight,
    needsDelete,
    needsPatch,
  );
  const skim = startFallback
    ? "План пуст · выбери дальше"
    : alreadyApplied
      ? lastOkMessage
        ? "Записано"
        : planOnly
          ? "План зала · уже записано"
          : shoppingOnly
            ? "Покупки · уже записано"
            : startOnly
              ? "Тренировка · уже записано"
              : repeatOnly
                ? "Повтор · уже записано"
                : waterOnly
                  ? "Вода · уже записано"
                  : weightOnly
                    ? "Вес · уже записано"
                    : deleteOnly
                      ? "Удаление · уже записано"
                      : patchOnly
                        ? "Правка · уже записано"
                        : `День ${applyDate} · уже записано`
      : planOnly
        ? "План зала · подтверди запись"
        : shoppingOnly
          ? "Покупки · подтверди запись"
          : startOnly
            ? "Тренировка · подтверди старт"
            : repeatOnly
              ? "Повтор · подтверди"
              : waterOnly
                ? "Вода · подтверди запись"
                : weightOnly
                  ? "Вес · подтверди запись"
                  : deleteOnly
                    ? "Удаление · подтверди"
                    : patchOnly
                      ? "Правка · подтверди"
                      : `День ${applyDate} · подтверди запись`;

  return (
    <div className="confirm-family mt-2 text-[12px] leading-snug text-[var(--ink)]">
      <p className="confirm-family-skim">{skim}</p>
      {cardNote ? (
        <p
          className={
            cardNote.tone === "soft"
              ? "confirm-family-note confirm-family-note--soft"
              : cardNote.tone === "err"
                ? "confirm-family-note confirm-family-note--err"
                : "confirm-family-note confirm-family-note--ok"
          }
          role="status"
        >
          {cardNote.text}
        </p>
      ) : null}
      {actions.summary ? (
        <p className="mb-1.5 font-display text-[13px] font-semibold text-[var(--accent-ink)]">
          {actions.summary}
        </p>
      ) : null}
      {actions.meals?.length ? (
        <>
          <ul className="confirm-family-dish space-y-1">
            {actions.meals.map((m) => (
              <li key={m.name}>
                <span className="font-semibold">{m.name}</span>
                {m.kcal != null ? ` — ${m.kcal} ккал` : ""}
                {m.protein != null || m.fat != null || m.carbs != null
                  ? ` · Б${m.protein ?? "—"} Ж${m.fat ?? "—"} У${m.carbs ?? "—"}`
                  : ""}
                {m.note ? ` · ${m.note}` : ""}
                {m.time ? ` · ${m.time}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] leading-snug text-[var(--muted)]">
            Оценка ассистента · проверь ккал перед записью
          </p>
        </>
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
          Старт тренировки по плану · {applyDate}
        </p>
      ) : null}
      {actions.repeatWorkout || startFallback?.repeat ? (
        <p className="mt-1.5 text-[12px] font-medium text-[var(--muted-strong)]">
          Повторить последнюю завершённую · на {applyDate}
        </p>
      ) : null}
      {actions.startEmptyWorkout || startFallback?.empty ? (
        <p className="mt-1.5 text-[12px] font-medium text-[var(--muted-strong)]">
          Пустая тренировка · {applyDate}
        </p>
      ) : null}
      {needsPatchWorkout ? (
        <ul className="confirm-family-dish mt-1.5 space-y-1">
          {(actions.patchWorkout?.addExercises ?? []).map((ex) => (
            <li key={`add-${ex.name}`}>
              <span className="font-semibold">+</span> {ex.name}
              {ex.sets?.length
                ? ` · ${ex.sets
                    .map((s) => `${s.weightKg ?? "—"}×${s.reps ?? "—"}`)
                    .join(", ")}`
                : ""}
            </li>
          ))}
          {(actions.patchWorkout?.logSets ?? []).map((s) => (
            <li key={`log-${s.match}-${s.weightKg}-${s.reps}`}>
              <span className="font-semibold">Подход</span>: {s.match}
              {s.weightKg != null || s.reps != null
                ? ` · ${s.weightKg ?? "—"}×${s.reps ?? "—"}`
                : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {needsWater ? (
        <p className="mt-1.5 text-[12px] font-medium text-[var(--muted-strong)]">
          Вода · {actions.waterMl} мл
        </p>
      ) : null}
      {needsWeight ? (
        <p className="mt-1.5 text-[12px] font-medium text-[var(--muted-strong)]">
          Вес · {actions.weightKg} кг
        </p>
      ) : null}
      {needsDelete ? (
        <ul className="confirm-family-dish mt-1.5 space-y-1">
          {actions.deleteMeals!.map((d) => (
            <li key={`del-${d.match}-${d.mealType ?? ""}`}>
              <span className="font-semibold">Удалить</span>:{" "}
              {d.mealType ? `весь ${d.match}` : d.match}
            </li>
          ))}
        </ul>
      ) : null}
      {needsPatch ? (
        <ul className="confirm-family-dish mt-1.5 space-y-1">
          {actions.patchMeals!.map((p) => (
            <li
              key={`patch-${p.match}-${p.mealType ?? ""}-${p.toMealType ?? ""}-${p.time ?? ""}-${p.portionGrams ?? ""}`}
            >
              <span className="font-semibold">Правка</span>:{" "}
              {p.mealType ? `весь ${p.match}` : p.match}
              {p.toMealType
                ? ` → ${
                    p.toMealType === "BREAKFAST"
                      ? "завтрак"
                      : p.toMealType === "LUNCH"
                        ? "обед"
                        : p.toMealType === "DINNER"
                          ? "ужин"
                          : "перекус"
                  }`
                : ""}
              {p.time ? ` · ${p.time}` : ""}
              {p.portionGrams != null ? ` · ${p.portionGrams} г` : ""}
              {p.kcal != null ? ` · ${p.kcal} ккал` : ""}
              {p.protein != null || p.fat != null || p.carbs != null
                ? ` · Б${p.protein ?? "—"} Ж${p.fat ?? "—"} У${p.carbs ?? "—"}`
                : ""}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="confirm-family-actions flex flex-wrap gap-1.5">
        {alreadyApplied ? (
          needsRoutine ||
          needsStart ||
          needsStartEmpty ||
          needsRepeat ||
          needsPatchWorkout ? (
            <Link href="/workouts" className="confirm-family-secondary">
              Открыть зал
            </Link>
          ) : null
        ) : (
          <>
            {pendingKinds().length >= 2 ? (
              <button
                type="button"
                className="confirm-family-cta"
                disabled={busy != null}
                onClick={() => void applyAll()}
              >
                {busy ? "…" : online ? "Подтвердить всё" : "Всё в очередь"}
              </button>
            ) : null}
            {needsMeals && !mealsDone ? (
              <button
                type="button"
                className="confirm-family-cta"
                disabled={busy != null}
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
            {needsWeight && !weightDone ? (
              <button
                type="button"
                className="confirm-family-cta"
                disabled={busy === "weight"}
                onClick={() => void apply("weight")}
              >
                {busy === "weight" ? "…" : online ? "В вес" : "В очередь"}
              </button>
            ) : null}
            {needsDelete && !deleteDone ? (
              <button
                type="button"
                className="confirm-family-cta"
                disabled={busy === "deleteMeals"}
                onClick={() => void apply("deleteMeals")}
              >
                {busy === "deleteMeals" ? "…" : online ? "Удалить" : "В очередь"}
              </button>
            ) : null}
            {needsPatch && !patchDone ? (
              <button
                type="button"
                className="confirm-family-cta"
                disabled={busy === "patchMeals"}
                onClick={() => void apply("patchMeals")}
              >
                {busy === "patchMeals" ? "…" : online ? "Исправить" : "В очередь"}
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
            {needsStart && !startDone && !startFallback ? (
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
            {needsStartEmpty && !startEmptyDone ? (
              <>
                <button
                  type="button"
                  className="confirm-family-cta"
                  disabled={busy === "startEmpty"}
                  onClick={() => void apply("startEmpty")}
                >
                  {busy === "startEmpty" ? "…" : online ? "Начать пустую" : "В очередь"}
                </button>
                <Link href="/workouts" className="confirm-family-secondary">
                  Зал
                </Link>
              </>
            ) : null}
            {needsRepeat && !repeatDone ? (
              <>
                <button
                  type="button"
                  className="confirm-family-cta"
                  disabled={busy === "repeat"}
                  onClick={() => void apply("repeat")}
                >
                  {busy === "repeat" ? "…" : online ? "Повторить тренировку" : "В очередь"}
                </button>
                <Link href="/workouts" className="confirm-family-secondary">
                  Зал
                </Link>
              </>
            ) : null}
            {needsPatchWorkout && !patchWorkoutDone ? (
              <>
                <button
                  type="button"
                  className="confirm-family-cta"
                  disabled={busy === "patchWorkout"}
                  onClick={() => void apply("patchWorkout")}
                >
                  {busy === "patchWorkout" ? "…" : online ? "В зал" : "В очередь"}
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
  /** Sync guard — iOS can double-fire send before React re-renders busy. */
  const busyRef = useRef(false);
  const turnsRef = useRef(turns);
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

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
          if (!resp.ok) {
            // T8 — surface «Ошибка» in OfflineQueueSheet instead of silent stall.
            markOfflineQueueFlushError(item.id);
            continue;
          }
          clearOfflineQueueFlushError(item.id);
          removeAssistantApply(item.id);
          if (
            item.kind === "photo" ||
            item.kind === "meals" ||
            item.kind === "patchMeals" ||
            item.kind === "deleteMeals"
          ) {
            notifyFoodSaved();
          }
          if (item.kind === "water") notifyWaterLogged();
          showFlash(
            item.kind === "photo" || item.kind === "meals"
              ? "Офлайн-очередь: добавил в рацион"
              : item.kind === "water"
                ? "Офлайн-очередь: вода записана"
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
    if ((!content && !hasPhoto) || busy || busyRef.current) return;

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
    const nextTurns = [...turnsRef.current, userTurn];
    setTurns(nextTurns);
    turnsRef.current = nextTurns;
    clearPhoto();
    busyRef.current = true;
    setBusy(true);
    if (imageBase64) {
      setStatus("Смотрю фото — сейчас покажу, что увидел…");
    }

    // Truncate long local history so iOS/Android never hit messages 400.
    const history = buildAssistantHistory(nextTurns);

    const assistantId = newId();
    setTurns((prev) => {
      const withShell = [...prev, { id: assistantId, role: "assistant" as const, content: "" }];
      turnsRef.current = withShell;
      return withShell;
    });

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
        // Prefer stream body error when present; else non-stream fallback.
        let streamErr: string | null = null;
        try {
          const streamData = (await resp.json()) as { error?: string } | null;
          streamErr = streamData?.error ?? null;
        } catch {
          // no json body
        }
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
        if (!fallback.ok) {
          throw new Error(friendlyAssistantError(data?.error || streamErr || "Не удалось получить ответ"));
        }
        if (data?.snapshot) setSnapshot(data.snapshot);
        if (data?.prefs) setPrefs(data.prefs);
        rememberUndo(data?.undo);
        setTurns((prev) => {
          const next = prev.map((t) =>
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
          );
          turnsRef.current = next;
          return next;
        });
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
            setTurns((prev) => {
              const next = prev.map((t) =>
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
              );
              turnsRef.current = next;
              return next;
            });
          }
          if (ev.event === "error") {
            throw new Error(friendlyAssistantError(String(json.error || "Ошибка стрима")));
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
        setTurns((prev) => {
          const next = prev.map((t) =>
            t.id === assistantId
              ? {
                  ...t,
                  content: acc.trim() || t.content || "Распознал фото — подтверди ниже.",
                  tools: liveTools,
                }
              : t,
          );
          turnsRef.current = next;
          return next;
        });
      }
      void refreshSnapshot(date);
    } catch (err) {
      setError(friendlyAssistantError(err instanceof Error ? err.message : "Ошибка"));
      // Drop empty assistant shells (even with tools) so next send stays valid.
      setTurns((prev) => {
        const next = prev.filter((t) => {
          if (t.id !== assistantId) return true;
          return Boolean(String(t.content ?? "").trim());
        });
        turnsRef.current = next;
        return next;
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
      setStatus(null);
    }
  }

  async function retryWrite(assistantTurnId: string) {
    const userText = lastUserContentBefore(turnsRef.current, assistantTurnId);
    if (!userText || busy || busyRef.current || !online) return;
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
        <div className="rounded-xl border border-[var(--border-quiet)] bg-[var(--surface-mist)]/60 px-3 py-2.5 text-[13px] text-[var(--ink)]">
          <p className="font-display text-[13px] font-semibold tracking-wide text-[var(--accent-ink)]">
            Коротко про AI
          </p>
          <p className="mt-1 text-[12px] leading-snug text-[var(--muted-strong)]">
            Пиши обычным языком — я сам добавлю в рацион или план зала. Фото сначала покажу на
            подтверждение. Можно отменить последнюю запись.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ASSISTANT_ONBOARD_STARTERS.map((s) => (
              <button
                key={s.label}
                type="button"
                className="assistant-scene-chip disabled:opacity-50"
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
              className="px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-ink)] underline-offset-2 hover:underline"
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
          <span className="assistant-scene-chip">{remainLabel}</span>
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
            className={`assistant-scene-chip disabled:opacity-50 ${
              mode === p.id ? "!bg-[var(--accent)] !text-white !border-[var(--accent)]" : ""
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
            start: toolOk("start_routine") || toolOk("start"),
            startEmpty: toolOk("start_empty"),
            repeat: toolOk("repeat_workout") || toolOk("repeat"),
            patchWorkout: toolOk("patch_workout"),
            water: toolOk("water"),
            weight: toolOk("weight") || toolOk("log_weight"),
            deleteMeals: toolOk("delete"),
            patchMeals: toolOk("patch"),
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
              wantsWrite:
                userWantsWrite(prevUser) ||
                userWantsStartWorkout(prevUser) ||
                userWantsRepeatWorkout(prevUser) ||
                userWantsGymEdit(prevUser),
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
                  today={todayKey}
                  streamDone={streamDone}
                  online={online}
                  onFlash={showFlash}
                  onApplied={(undo) => {
                    rememberUndo(undo);
                    void refreshSnapshot(date);
                  }}
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
              className="assistant-scene-chip hover:bg-[var(--accent-soft)] disabled:opacity-50"
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
