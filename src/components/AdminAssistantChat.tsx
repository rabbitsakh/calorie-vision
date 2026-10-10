"use client";

import { useEffect, useRef, useState } from "react";
import { withBasePath } from "@/lib/paths";

type ChatRole = "user" | "assistant";

type ChatTurn = {
  id: string;
  role: ChatRole;
  content: string;
};

const STARTERS = [
  "Что ещё съесть сегодня по остатку КБЖУ?",
  "Собери рацион на завтра под мою цель",
  "Какую тренировку сделать завтра с учётом недавних?",
  "План зала на неделю: 3 дня",
];

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AdminAssistantChat() {
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Привет. У меня доступ к твоему рациону и залу. Спроси про остаток калорий, рацион на день или план тренировок.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

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
        body: JSON.stringify({ messages: history }),
      });
      const data = (await resp.json().catch(() => null)) as {
        reply?: string;
        error?: string;
      } | null;
      if (!resp.ok) {
        throw new Error(data?.error || "Не удалось получить ответ");
      }
      const reply = data?.reply?.trim();
      if (!reply) throw new Error("Пустой ответ");
      setTurns((prev) => [...prev, { id: newId(), role: "assistant", content: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex min-h-[70vh] flex-col gap-3">
      <p className="text-sm text-[var(--muted)]">
        Только для админа. Контекст подтягивается с сервера перед каждым ответом.
      </p>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 sm:p-4">
        {turns.map((turn) => (
          <div
            key={turn.id}
            className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
              turn.role === "user"
                ? "ml-auto bg-[var(--accent)] text-white"
                : "mr-auto bg-[var(--surface-mist)] text-[var(--ink)]"
            }`}
          >
            {turn.content}
          </div>
        ))}
        {busy ? (
          <p className="mr-auto text-xs font-medium text-[var(--muted)]">Думаю…</p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-1.5">
        {STARTERS.map((hint) => (
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
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Вопрос про еду или зал…"
          className="input min-h-11 flex-1"
          disabled={busy}
          maxLength={4000}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary min-h-11 px-4" disabled={busy || !draft.trim()}>
          Отправить
        </button>
      </form>
    </section>
  );
}
