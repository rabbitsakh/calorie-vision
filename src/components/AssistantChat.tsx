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
import type { AssistantPrefs } from "@/lib/assistant-prefs";
import { withBasePath } from "@/lib/paths";

type ChatRole = "user" | "assistant";

type ToolResult = {
  ok: boolean;
  tool: string;
  message: string;
  data?: unknown;
};

type UndoPayload = {
  mealIds: string[];
  routineIds: string[];
  waterIds: string[];
  weightIds: string[];
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
};

const STORAGE_KEY = "cv-assistant-chat-v5";

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
      "Привет! Могу сам записать рацион, план зала, воду, вес — или стартовать тренировку. Кинь фото еды: сначала покажу, что увидел, ты подтвердишь.",
  };
}

function emptyUndo(): UndoPayload {
  return { mealIds: [], routineIds: [], waterIds: [], weightIds: [] };
}

function undoHasItems(u: UndoPayload | null | undefined): boolean {
  if (!u) return false;
  return u.mealIds.length + u.routineIds.length + u.waterIds.length + u.weightIds.length > 0;
}

function loadStored(userId: string | undefined) {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { turns?: ChatTurn[]; date?: string };
    if (!Array.isArray(parsed.turns) || parsed.turns.length === 0) return null;
    return {
      turns: parsed.turns.slice(-80).map((t) => ({
        ...t,
        imagePreview: undefined,
      })),
      date: typeof parsed.date === "string" ? parsed.date : null,
    };
  } catch {
    return null;
  }
}

function saveStored(userId: string | undefined, turns: ChatTurn[], date: string) {
  if (typeof window === "undefined" || !userId) return;
  try {
    const slim = turns.slice(-80).map(({ imagePreview: _p, ...rest }) => rest);
    localStorage.setItem(
      `${STORAGE_KEY}:${userId}`,
      JSON.stringify({ turns: slim, date, savedAt: Date.now() }),
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

function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const m = /^data:([^;]+);base64,(.+)$/.exec(result);
      if (!m) {
        reject(new Error("Не удалось прочитать фото"));
        return;
      }
      resolve({ mime: m[1]!, base64: m[2]! });
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать фото"));
    reader.readAsDataURL(file);
  });
}

function ToolChips({ tools }: { tools: ToolResult[] }) {
  if (!tools.length) return null;
  return (
    <div className="mt-1.5 space-y-0.5">
      {tools.map((t, i) => (
        <p
          key={`${t.tool}-${i}`}
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-snug ${
            t.ok ? "bg-teal-100 text-teal-950" : "bg-rose-50 text-rose-900"
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
  onDone,
  onFlash,
}: {
  tool: ToolResult;
  date: string;
  busy: boolean;
  onDone: (result: ToolResult, undo: UndoPayload) => void;
  onFlash: (msg: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const data = (tool.data ?? {}) as {
    pending?: boolean;
    imagePath?: string;
    drafts?: PhotoDraft[];
    date?: string;
  };
  if (!data.pending || !data.imagePath || !data.drafts?.length) return null;

  async function confirm() {
    setPending(true);
    try {
      const resp = await fetch(withBasePath("/api/assistant/apply"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "photo",
          date: data.date || date,
          imagePath: data.imagePath,
          drafts: data.drafts,
        }),
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
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      <button
        type="button"
        disabled={busy || pending}
        className="rounded-md bg-teal-700 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
        onClick={() => void confirm()}
      >
        {pending ? "Пишу…" : "Добавить в рацион"}
      </button>
    </div>
  );
}

function ActionCard({
  actions,
  date,
  alreadyApplied,
  onFlash,
  onApplied,
}: {
  actions: AssistantActions;
  date: string;
  alreadyApplied: boolean;
  onFlash: (msg: string) => void;
  onApplied: (undo: UndoPayload) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function apply(kind: "meals" | "routine") {
    setBusy(kind);
    try {
      const resp = await fetch(withBasePath("/api/assistant/apply"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, date, actions }),
      });
      const data = (await resp.json().catch(() => null)) as {
        error?: string;
        meals?: Array<{ id: string }>;
        routines?: Array<{ id: string }>;
      } | null;
      if (!resp.ok) throw new Error(data?.error || "Не удалось");
      if (kind === "meals") {
        onFlash(`В дневник: ${data?.meals?.length ?? 0}`);
        onApplied({
          ...emptyUndo(),
          mealIds: (data?.meals ?? []).map((m) => m.id).filter(Boolean),
        });
      } else {
        onFlash("В план зала");
        onApplied({
          ...emptyUndo(),
          routineIds: (data?.routines ?? []).map((r) => r.id).filter(Boolean),
        });
      }
    } catch (err) {
      onFlash(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-1.5 space-y-1 rounded-lg border border-teal-200 bg-teal-50/80 px-2 py-1.5 text-[11px] leading-snug text-teal-950">
      {actions.summary ? <p className="font-semibold">{actions.summary}</p> : null}
      {actions.meals?.length ? (
        <ul className="space-y-0.5">
          {actions.meals.map((m) => (
            <li key={m.name}>
              • {m.name}
              {m.kcal != null ? ` — ${m.kcal} ккал` : ""}
              {m.protein != null || m.fat != null || m.carbs != null
                ? ` (Б${m.protein ?? "—"} Ж${m.fat ?? "—"} У${m.carbs ?? "—"})`
                : ""}
              {m.note ? ` · ${m.note}` : ""}
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
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {alreadyApplied ? (
          actions.workoutDays?.length ? (
            <Link
              href="/workouts"
              className="rounded-md border border-teal-700/40 bg-white px-2 py-0.5 text-[10px] font-semibold text-teal-900"
            >
              Открыть зал
            </Link>
          ) : null
        ) : (
          <>
            {actions.meals?.length ? (
              <button
                type="button"
                className="rounded-md border border-teal-700/40 bg-white px-2 py-0.5 text-[10px] font-semibold text-teal-900 disabled:opacity-50"
                disabled={busy === "meals"}
                onClick={() => void apply("meals")}
              >
                {busy === "meals" ? "…" : "В дневник"}
              </button>
            ) : null}
            {actions.workoutDays?.length ? (
              <>
                <button
                  type="button"
                  className="rounded-md border border-teal-700/40 bg-white px-2 py-0.5 text-[10px] font-semibold text-teal-900 disabled:opacity-50"
                  disabled={busy === "routine"}
                  onClick={() => void apply("routine")}
                >
                  {busy === "routine" ? "…" : "В план зала"}
                </button>
                <Link
                  href="/workouts"
                  className="rounded-md border border-teal-700/40 bg-white px-2 py-0.5 text-[10px] font-semibold text-teal-900"
                >
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
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<AssistantMode>("all");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<AssistantContextSnapshot | null>(null);
  const [prefs, setPrefs] = useState<AssistantPrefs>({ likes: [], dislikes: [], notes: [] });
  const [lastUndo, setLastUndo] = useState<UndoPayload | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = loadStored(userId);
    if (stored) {
      setTurns(stored.turns);
      if (stored.date) setDate(stored.date);
    }
    const modeParam = searchParams.get("mode");
    if (modeParam) setMode(parseAssistantMode(modeParam));
    const q = searchParams.get("q")?.trim();
    if (q) setDraft(q.slice(0, 6000));
    setHydrated(true);
  }, [userId, searchParams]);

  useEffect(() => {
    if (!hydrated) return;
    saveStored(userId, turns, date);
  }, [hydrated, userId, turns, date]);

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

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
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

  async function undoLast() {
    if (!lastUndo || !undoHasItems(lastUndo) || busy) return;
    setBusy(true);
    try {
      const resp = await fetch(withBasePath("/api/assistant/apply"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "undo", undo: lastUndo }),
      });
      const data = (await resp.json().catch(() => null)) as {
        error?: string;
        result?: ToolResult;
      } | null;
      if (!resp.ok) throw new Error(data?.error || "Не удалось отменить");
      setLastUndo(null);
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
      setError(err instanceof Error ? err.message : "Ошибка отмены");
    } finally {
      setBusy(false);
    }
  }

  async function send(text: string, opts?: { savePhoto?: boolean }) {
    const hasPhoto = Boolean(photo);
    const content =
      text.trim() ||
      (hasPhoto ? (opts?.savePhoto ? "Добавь фото в рацион" : "Что на фото?") : "");
    if ((!content && !hasPhoto) || busy) return;

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
    setStatus(null);

    let imageBase64: string | undefined;
    let imageMime: string | undefined;
    const preview: string | null = photoPreview;
    if (photo) {
      try {
        const encoded = await fileToBase64(photo);
        imageBase64 = encoded.base64;
        imageMime = encoded.mime;
      } catch (err) {
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

    const history = nextTurns
      .filter((t) => t.id !== "welcome")
      .map((t) => ({ role: t.role, content: t.content }));

    const assistantId = newId();
    setTurns((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    const writePhoto =
      opts?.savePhoto === true ||
      (/добав|сохран|запиш|в\s*рацион/i.test(content) && content !== "Что на фото?");
    const payload = {
      messages: history,
      date,
      mode,
      ...(imageBase64
        ? {
            imageBase64,
            imageMime,
            // Default preview; save if user explicitly asks to add.
            savePhoto: writePhoto,
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
          snapshot?: AssistantContextSnapshot;
          prefs?: AssistantPrefs;
          error?: string;
        } | null;
        if (!fallback.ok) throw new Error(data?.error || "Не удалось получить ответ");
        if (data?.snapshot) setSnapshot(data.snapshot);
        if (data?.prefs) setPrefs(data.prefs);
        if (data?.undo && undoHasItems(data.undo)) setLastUndo(data.undo);
        setTurns((prev) =>
          prev.map((t) =>
            t.id === assistantId
              ? {
                  ...t,
                  content: data?.reply?.trim() || "…",
                  actions: data?.actions ?? null,
                  tools: data?.tools ?? [],
                  undo: data?.undo ?? null,
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
            if (json.snapshot) setSnapshot(json.snapshot as AssistantContextSnapshot);
            if (json.prefs) setPrefs(json.prefs as AssistantPrefs);
            const undo = (json.undo as UndoPayload | undefined) ?? null;
            if (undo && undoHasItems(undo)) setLastUndo(undo);
            setTurns((prev) =>
              prev.map((t) =>
                t.id === assistantId
                  ? {
                      ...t,
                      content: String(json.reply || acc).trim() || "…",
                      actions: (json.actions as AssistantActions | null) ?? null,
                      tools: (json.tools as ToolResult[] | undefined) ?? liveTools,
                      undo,
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
      void refreshSnapshot(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
      setTurns((prev) => prev.filter((t) => t.id !== assistantId || t.content || t.tools?.length));
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  const remainLabel =
    snapshot?.remainingCalories != null && snapshot.targetCalories != null
      ? `остаток ${snapshot.remainingCalories} ккал`
      : snapshot
        ? `${snapshot.calories} ккал`
        : null;

  return (
    <section className="flex min-h-[75vh] flex-col gap-2 text-[13px] leading-snug">
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="text-[11px] font-medium text-[var(--muted-strong)]">
          День{" "}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ml-1 rounded-md border border-[var(--line)] bg-white px-1.5 py-0.5 text-[12px]"
            disabled={busy}
          />
        </label>
        {remainLabel ? (
          <span className="rounded-full border border-[var(--line)] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-strong)]">
            {remainLabel}
          </span>
        ) : null}
        {undoHasItems(lastUndo) ? (
          <button
            type="button"
            className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-950 disabled:opacity-50"
            disabled={busy}
            onClick={() => void undoLast()}
          >
            Отменить запись
          </button>
        ) : null}
        <button
          type="button"
          className="ml-auto text-[10px] font-semibold text-[var(--muted)] underline-offset-2 hover:underline"
          disabled={busy}
          onClick={() => {
            setTurns([welcomeTurn()]);
            setLastUndo(null);
            setError(null);
          }}
        >
          Очистить
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 sm:p-2.5">
        {turns.map((turn) => {
          const applied = Boolean(
            turn.tools?.some(
              (t) =>
                t.ok &&
                t.tool !== "recognize_meal_preview" &&
                (t.tool.includes("save") ||
                  t.tool.includes("plan") ||
                  t.tool.includes("shopping") ||
                  t.tool.includes("water") ||
                  t.tool.includes("weight") ||
                  t.tool.includes("start") ||
                  t.tool.includes("photo")),
            ),
          );
          const photoPreviewTool = turn.tools?.find(
            (t) => t.tool === "recognize_meal_preview" && t.ok,
          );
          return (
            <div
              key={turn.id}
              className={`max-w-[96%] rounded-xl px-2.5 py-1.5 text-[12px] leading-snug ${
                turn.role === "user"
                  ? "ml-auto bg-[var(--accent)] text-white"
                  : "mr-auto bg-[var(--surface-mist)] text-[var(--ink)]"
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
              {turn.role === "assistant" && photoPreviewTool ? (
                <PhotoConfirm
                  tool={photoPreviewTool}
                  date={date}
                  busy={busy}
                  onFlash={showFlash}
                  onDone={(result, undo) => {
                    setLastUndo(undo);
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
                  alreadyApplied={applied}
                  onFlash={showFlash}
                  onApplied={(undo) => {
                    if (undoHasItems(undo)) setLastUndo(undo);
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

      {flash ? <p className="text-[12px] font-medium text-teal-800">{flash}</p> : null}
      {error ? <p className="text-[12px] text-red-600">{error}</p> : null}

      {!busy && turns.length <= 2 ? (
        <div className="flex flex-wrap gap-1">
          {STARTERS.map((hint) => (
            <button
              key={hint}
              type="button"
              className="rounded-full border border-[var(--line)] bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--muted-strong)] hover:bg-[var(--surface-mist)] disabled:opacity-50"
              disabled={busy}
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
            Сначала распознаю — потом подтвердишь запись
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
        className="flex gap-1.5"
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
          disabled={busy}
          title="Фото еды"
          onClick={() => fileRef.current?.click()}
        >
          Фото
        </button>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="План, рацион, вода, вес, «начни тренировку»…"
          className="input min-h-[4.5rem] flex-1 resize-y py-2.5 text-[13px] leading-snug"
          disabled={busy}
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
          disabled={busy || (!draft.trim() && !photo)}
        >
          →
        </button>
      </form>
    </section>
  );
}
