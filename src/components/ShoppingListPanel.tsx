"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  allergenLabel,
  matchAllergensInText,
  parseAllergensJson,
  type AllergenId,
} from "@/lib/allergens";
import {
  addItemsFromDishNames,
  clearAll,
  clearChecked,
  loadList,
  normalizeShoppingName,
  removeItem,
  saveList,
  toggleItem,
  type ShoppingListItem,
} from "@/lib/shopping-list";
import { withBasePath } from "@/lib/paths";
import { shiftDateKeyUtc, weekStartMonday } from "@/lib/streak-utils";
import type { MealEntry } from "@/types";

type ShoppingListPanelProps = {
  selectedDate: string;
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ShoppingListPanel({ selectedDate }: ShoppingListPanelProps) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [userAllergens, setUserAllergens] = useState<AllergenId[]>([]);

  const opts = useCallback(() => ({ userId }), [userId]);

  useEffect(() => {
    if (!userId) {
      setUserAllergens([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/account"), { cache: "no-store" });
        if (!resp.ok) return;
        const data = (await resp.json()) as { allergens?: unknown };
        if (!cancelled) setUserAllergens(parseAllergensJson(data.allergens));
      } catch {
        // soft hint only
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const syncToServer = useCallback(
    async (next: ShoppingListItem[]) => {
      if (!userId) return;
      try {
        await fetch(withBasePath("/api/shopping-list"), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: next }),
        });
      } catch {
        // keep local copy
      }
    },
    [userId],
  );

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const local = loadList(opts());
      setItems(local);
      if (!userId) return;
      try {
        const resp = await fetch(withBasePath("/api/shopping-list"), { cache: "no-store" });
        if (!resp.ok) return;
        const data = (await resp.json()) as { items?: ShoppingListItem[] };
        const remote = Array.isArray(data.items) ? data.items : [];
        if (cancelled) return;
        if (remote.length === 0 && local.length > 0) {
          await fetch(withBasePath("/api/shopping-list"), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: local }),
          });
          return;
        }
        if (remote.length > 0) {
          saveList(remote, opts());
          setItems(remote);
        }
      } catch {
        // offline — local list is enough
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [opts, userId]);

  async function fetchDishNamesForDate(dateKey: string): Promise<string[]> {
    const resp = await fetch(withBasePath(`/api/meals?date=${dateKey}`), {
      cache: "no-store",
    });
    if (!resp.ok) {
      throw new Error("load-failed");
    }
    const data = (await resp.json()) as { entries?: MealEntry[] };
    return (data.entries ?? [])
      .map((e) => e.dishName)
      .filter((name): name is string => typeof name === "string" && name.trim().length > 0);
  }

  function dedupeNames(names: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of names) {
      const name = raw.trim().replace(/\s+/g, " ");
      if (!name) continue;
      const key = normalizeShoppingName(name);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
    return out;
  }

  async function collectFromRation(scope: "day" | "week") {
    setBusy(true);
    setMessage(null);
    try {
      let names: string[];
      let sourceDate = selectedDate;
      if (scope === "week") {
        const start = weekStartMonday(selectedDate);
        const dates = Array.from({ length: 7 }, (_, i) => shiftDateKeyUtc(start, i));
        const batches = await Promise.all(dates.map((d) => fetchDishNamesForDate(d)));
        names = dedupeNames(batches.flat());
        sourceDate = start;
      } else {
        names = dedupeNames(await fetchDishNamesForDate(selectedDate));
      }
      if (names.length === 0) {
        setMessage(
          scope === "week"
            ? "В рационе за эту неделю нет блюд"
            : "В рационе за этот день нет блюд",
        );
        return;
      }
      const before = loadList(opts()).length;
      const next = addItemsFromDishNames(names, sourceDate, opts());
      const added = next.length - before;
      setItems(next);
      void syncToServer(next);
      setOpen(true);
      setMessage(
        added > 0
          ? `Добавлено: ${added}`
          : "Все блюда уже есть в списке",
      );
    } catch {
      setMessage("Не удалось загрузить рацион");
    } finally {
      setBusy(false);
    }
  }

  function handleToggle(id: string) {
    const next = toggleItem(id, opts());
    setItems(next);
    void syncToServer(next);
  }

  function handleRemove(id: string) {
    const next = removeItem(id, opts());
    setItems(next);
    void syncToServer(next);
  }

  function handleClearChecked() {
    const next = clearChecked(opts());
    setItems(next);
    setMessage(null);
    void syncToServer(next);
  }

  function handleClearAll() {
    const next = clearAll(opts());
    setItems(next);
    setMessage(null);
    void syncToServer(next);
  }

  function handleManualAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = manual.trim();
    if (!name) return;
    const next = addItemsFromDishNames([name], undefined, opts());
    setItems(next);
    void syncToServer(next);
    setManual("");
    setMessage(null);
    setOpen(true);
  }

  const unchecked = items.filter((i) => !i.checked).length;
  const checked = items.length - unchecked;
  const summary =
    items.length === 0
      ? "пусто"
      : checked > 0
        ? `${unchecked} из ${items.length}`
        : `${items.length}`;

  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left md:px-5"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">Список покупок</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Из рациона или вручную · {summary}
          </p>
        </div>
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 md:px-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary min-h-10 px-3 text-sm"
              disabled={busy}
              onClick={() => void collectFromRation("week")}
            >
              {busy ? "Собираю…" : "Собрать за неделю"}
            </button>
            <button
              type="button"
              className="btn-quiet min-h-10 px-3 text-sm font-semibold"
              disabled={busy}
              onClick={() => void collectFromRation("day")}
            >
              За день
            </button>
            {checked > 0 ? (
              <button
                type="button"
                className="btn-quiet min-h-10 text-sm"
                onClick={handleClearChecked}
              >
                Убрать отмеченные
              </button>
            ) : null}
            {items.length > 0 ? (
              <button
                type="button"
                className="btn-quiet min-h-10 text-sm text-rose-700"
                onClick={handleClearAll}
              >
                Очистить всё
              </button>
            ) : null}
          </div>

          {message ? <p className="text-xs text-slate-500">{message}</p> : null}

          <form className="flex gap-2" onSubmit={handleManualAdd}>
            <input
              type="text"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Добавить продукт…"
              className="min-h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
              aria-label="Новый пункт списка"
            />
            <button
              type="submit"
              className="btn-quiet min-h-10 shrink-0 px-3 text-sm font-semibold"
              disabled={!manual.trim()}
            >
              Добавить
            </button>
          </form>

          {items.length === 0 ? (
            <p className="text-sm text-slate-500">
              Список пуст. Соберите блюда за неделю или за день, либо добавьте вручную.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {items.map((item) => {
                const allergenHits = matchAllergensInText(item.name, userAllergens);
                return (
                  <li
                    key={item.id}
                    className="flex items-start gap-2 rounded-xl px-1 py-1 hover:bg-slate-50"
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => handleToggle(item.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
                      />
                      <span className="min-w-0">
                        <span
                          className={`block truncate text-sm ${
                            item.checked ? "text-slate-400 line-through" : "text-slate-800"
                          }`}
                        >
                          {item.name}
                        </span>
                        {allergenHits.length > 0 && !item.checked ? (
                          <span className="mt-0.5 block text-[11px] leading-snug text-amber-800">
                            Возможно: {allergenHits.map((id) => allergenLabel(id)).join(", ")}
                          </span>
                        ) : null}
                      </span>
                    </label>
                    <button
                      type="button"
                      className="btn-quiet shrink-0 px-2 text-xs text-slate-400 hover:text-rose-600"
                      aria-label={`Удалить ${item.name}`}
                      onClick={() => handleRemove(item.id)}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-[11px] text-slate-400">
            Синхронизируется между устройствами при входе.
          </p>
        </div>
      ) : null}
    </section>
  );
}
