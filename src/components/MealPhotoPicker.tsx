"use client";

import { useEffect, useState } from "react";
import { getImageUrl, withBasePath } from "@/lib/paths";

export type MealPhotoCandidate = {
  url: string;
  source: string;
  label?: string;
};

type MealPhotoPickerProps = {
  mealId: string;
  dishName: string;
  imagePath?: string | null;
  onApplied: (imagePath: string | null) => void;
  onClose: () => void;
};

const SOURCE_LABEL: Record<string, string> = {
  openfoodfacts: "OFF",
  wikipedia: "Wiki",
  commons: "Commons",
};

/** Search web food photos and apply one to a meal entry. */
export function MealPhotoPicker({
  mealId,
  dishName,
  imagePath,
  onApplied,
  onClose,
}: MealPhotoPickerProps) {
  const [query, setQuery] = useState(dishName);
  const [candidates, setCandidates] = useState<MealPhotoCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(nextQuery: string) {
    const trimmed = nextQuery.trim();
    if (trimmed.length < 2) {
      setError("Введите хотя бы 2 символа");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(withBasePath("/api/food/images"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      const data = (await resp.json()) as { candidates?: MealPhotoCandidate[]; error?: string };
      if (!resp.ok) {
        throw new Error(data.error ?? "Ошибка поиска");
      }
      setCandidates(data.candidates ?? []);
      if (!(data.candidates ?? []).length) {
        setError("Ничего не нашли — попробуйте короче или иначе");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка поиска");
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void runSearch(dishName);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial search for current dish only
  }, [dishName, mealId]);

  async function applyUrl(imageUrl: string) {
    setApplying(imageUrl);
    setError(null);
    try {
      const resp = await fetch(withBasePath(`/api/meals/${mealId}/image`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const data = (await resp.json()) as { imagePath?: string | null; error?: string };
      if (!resp.ok) {
        throw new Error(data.error ?? "Не удалось сохранить");
      }
      onApplied(data.imagePath ?? null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setApplying(null);
    }
  }

  async function clearPhoto() {
    setApplying("clear");
    setError(null);
    try {
      const resp = await fetch(withBasePath(`/api/meals/${mealId}/image`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true }),
      });
      const data = (await resp.json()) as { error?: string };
      if (!resp.ok) {
        throw new Error(data.error ?? "Не удалось удалить");
      }
      onApplied(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить");
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="rounded-2xl border border-teal-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Фото из интернета</p>
          <p className="mt-0.5 text-sm text-slate-600">Выберите картинку для «{dishName}»</p>
        </div>
        <button type="button" className="btn-quiet text-xs text-slate-500" onClick={onClose}>
          Закрыть
        </button>
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch(query);
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Запрос для поиска"
          aria-label="Поиск фото"
        />
        <button type="submit" className="btn btn-secondary text-sm" disabled={loading}>
          {loading ? "…" : "Найти"}
        </button>
      </form>

      {imagePath ? (
        <div className="mt-3 flex items-center gap-3">
          <div className="h-14 w-14 overflow-hidden rounded-xl bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getImageUrl(imagePath)} alt="" className="h-full w-full object-cover" />
          </div>
          <button
            type="button"
            className="text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
            disabled={Boolean(applying)}
            onClick={() => void clearPhoto()}
          >
            Убрать текущее фото
          </button>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      {loading && candidates.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Ищем фото…</p>
      ) : null}

      {candidates.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {candidates.map((item) => {
            const busy = applying === item.url;
            return (
              <button
                key={item.url}
                type="button"
                disabled={Boolean(applying)}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left transition hover:border-teal-400 disabled:opacity-60"
                onClick={() => void applyUrl(item.url)}
                title={item.label ?? item.source}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.label ?? "Вариант фото"}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute bottom-0 left-0 right-0 bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {busy ? "…" : SOURCE_LABEL[item.source] ?? item.source}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
