"use client";

import { useState } from "react";
import { saveExportFile, type ExportSaveResult } from "@/lib/export/download-client";
import { exportDownloadName, exportQueryPath, type ExportKind } from "@/lib/export/paths";
import { withBasePath } from "@/lib/paths";

const OPTIONS: Array<{
  kind: ExportKind;
  title: string;
  hint: string;
  csvHint: string;
  pdfHint: string;
}> = [
  {
    kind: "ration",
    title: "Рацион",
    hint: "Дневник питания",
    csvHint: "Таблица для Excel",
    pdfHint: "Документ с временем",
  },
  {
    kind: "workouts",
    title: "Тренировки",
    hint: "Подходы, вес, повторы",
    csvHint: "Таблица для Excel",
    pdfHint: "Краткая выгрузка зала",
  },
  {
    kind: "weight",
    title: "Вес",
    hint: "Замеры веса",
    csvHint: "Таблица для Excel",
    pdfHint: "Документ с временем",
  },
  {
    kind: "all",
    title: "Всё вместе",
    hint: "Рацион, тренировки и вес",
    csvHint: "ZIP с тремя CSV",
    pdfHint: "Один PDF, три раздела",
  },
];

function statusText(result: ExportSaveResult): string | null {
  if (result === "cancelled") return null;
  if (result === "shared") return "Файл в меню «Поделиться» — сохраните его или отправьте.";
  return "Файл скачивается.";
}

export function ExportSettings() {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [noteIsError, setNoteIsError] = useState(false);

  async function onDownload(kind: ExportKind, format: "csv" | "pdf") {
    const key = `${kind}-${format}`;
    setBusyKey(key);
    setNote(null);
    setNoteIsError(false);
    try {
      const result = await saveExportFile(
        withBasePath(exportQueryPath(kind, format)),
        exportDownloadName(kind, format),
      );
      setNote(statusText(result));
    } catch (error) {
      setNoteIsError(true);
      setNote(error instanceof Error ? error.message : "Не удалось выгрузить файл");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--muted)]">
        За всё время. Время в файлах — часовой пояс профиля, если он не задан — Москва. CSV в
        кодировке UTF-8, его открывает Excel.
      </p>
      {OPTIONS.map((option) => (
        <div key={option.kind} className="profile-settings__export-group">
          <div className="px-4 pb-1 pt-3">
            <p className="font-semibold text-[var(--foreground)]">{option.title}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{option.hint}</p>
          </div>
          <button
            type="button"
            className="profile-settings__door"
            aria-label={`${option.title}, CSV`}
            disabled={busyKey === `${option.kind}-csv`}
            onClick={() => void onDownload(option.kind, "csv")}
          >
            <span className="min-w-0">
              <span className="block font-semibold text-[var(--foreground)]">CSV</span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                {busyKey === `${option.kind}-csv` ? "Готовим…" : option.csvHint}
              </span>
            </span>
            <span className="shrink-0 text-[var(--muted)]" aria-hidden>
              ↓
            </span>
          </button>
          <button
            type="button"
            className="profile-settings__door"
            aria-label={`${option.title}, PDF`}
            disabled={busyKey === `${option.kind}-pdf`}
            onClick={() => void onDownload(option.kind, "pdf")}
          >
            <span className="min-w-0">
              <span className="block font-semibold text-[var(--foreground)]">PDF</span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                {busyKey === `${option.kind}-pdf` ? "Готовим…" : option.pdfHint}
              </span>
            </span>
            <span className="shrink-0 text-[var(--muted)]" aria-hidden>
              ↓
            </span>
          </button>
        </div>
      ))}
      {note ? (
        <p className={`text-sm ${noteIsError ? "text-red-600" : "text-[var(--accent)]"}`} role="status">
          {note}
        </p>
      ) : null}
    </div>
  );
}
