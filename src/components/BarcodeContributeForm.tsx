"use client";

import { useState } from "react";
import { SceneBusy } from "@/components/SceneSkeleton";
import { compressImageFileForUpload } from "@/lib/client-image-compress";
import { per100DraftFromRecognition } from "@/lib/barcode-product";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { humanizeClientFetchError, readApiJson } from "@/lib/read-api-json";
import { withBasePath } from "@/lib/paths";

type BarcodeContributeFormProps = {
  barcode: string;
  disabled?: boolean;
  onCreated: (recognition: FoodRecognitionResult, imagePath?: string) => void;
};

export function BarcodeContributeForm({ barcode, disabled, onCreated }: BarcodeContributeFormProps) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [pack, setPack] = useState("");
  const [labelImagePath, setLabelImagePath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [readingLabel, setReadingLabel] = useState(false);

  async function readLabel(file: File) {
    setError(null);
    setReadingLabel(true);
    try {
      const upload = await compressImageFileForUpload(file);
      const form = new FormData();
      form.append("photo", upload, upload.name || "label.jpg");
      form.append("context", "label");
      const response = await fetch(withBasePath("/api/recognize"), { method: "POST", body: form });
      const data = await readApiJson<{
        recognition?: FoodRecognitionResult;
        imagePath?: string;
        error?: string;
      }>(response);
      if (!response.ok || !data.recognition) {
        throw new Error(data.error ?? "Не удалось прочитать этикетку");
      }
      if (data.imagePath) setLabelImagePath(data.imagePath);
      const draft = per100DraftFromRecognition(data.recognition);
      if (!draft) {
        if (data.recognition.dishName) setName(data.recognition.dishName);
        setError("На этикетке не нашлось КБЖУ на 100 г — введите цифры вручную.");
        return;
      }
      setName(draft.name);
      setBrand(draft.brand);
      setKcal(String(draft.kcalPer100));
      setProtein(String(draft.proteinPer100));
      setFat(String(draft.fatPer100));
      setCarbs(String(draft.carbsPer100));
      if (draft.packGrams) setPack(draft.packGrams);
    } catch (err) {
      setError(humanizeClientFetchError(err, "Не удалось распознать этикетку. Проверьте интернет."));
    } finally {
      setReadingLabel(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(withBasePath("/api/food/barcode/contribute"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode,
          name,
          brand,
          kcalPer100: kcal,
          proteinPer100: protein,
          fatPer100: fat,
          carbsPer100: carbs,
          packGrams: pack,
        }),
      });
      const data = await readApiJson<{
        recognition?: FoodRecognitionResult;
        imagePath?: string;
        error?: string;
      }>(response);
      if (!response.ok || !data.recognition) {
        throw new Error(data.error ?? "Не удалось сохранить продукт");
      }
      onCreated(data.recognition, labelImagePath || data.imagePath);
    } catch (err) {
      setError(humanizeClientFetchError(err, "Не удалось сохранить продукт. Проверьте интернет."));
    } finally {
      setSaving(false);
    }
  }

  const busy = disabled || saving || readingLabel;

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div>
        <p className="text-sm font-semibold text-amber-950">По коду {barcode} продукта нет в базе</p>
        <p className="mt-1 text-xs text-amber-900">
          Добавьте название и КБЖУ на 100 г — запись попадёт в общую базу и поможет другим.
        </p>
      </div>
      <label className="btn btn-secondary text-sm">
        {readingLabel ? "Читаем этикетку…" : "Сфотографировать этикетку"}
        <input
          type="file"
          accept="image/*,.heic,.heif"
          capture="environment"
          className="hidden"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void readLabel(file);
          }}
        />
      </label>
      <div className="field">
        <label htmlFor="barcode-product-name">Название</label>
        <input
          id="barcode-product-name"
          value={name}
          required
          disabled={busy}
          placeholder="Творог 5%"
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="barcode-product-brand">Бренд</label>
        <input
          id="barcode-product-brand"
          value={brand}
          disabled={busy}
          placeholder="Необязательно"
          onChange={(event) => setBrand(event.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="field">
          <label htmlFor="barcode-kcal">Ккал / 100 г</label>
          <input
            id="barcode-kcal"
            inputMode="decimal"
            value={kcal}
            required
            disabled={busy}
            onChange={(event) => setKcal(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="barcode-protein">Белки</label>
          <input
            id="barcode-protein"
            inputMode="decimal"
            value={protein}
            required
            disabled={busy}
            onChange={(event) => setProtein(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="barcode-fat">Жиры</label>
          <input
            id="barcode-fat"
            inputMode="decimal"
            value={fat}
            required
            disabled={busy}
            onChange={(event) => setFat(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="barcode-carbs">Углеводы</label>
          <input
            id="barcode-carbs"
            inputMode="decimal"
            value={carbs}
            required
            disabled={busy}
            onChange={(event) => setCarbs(event.target.value)}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="barcode-pack">Вес упаковки, г</label>
        <input
          id="barcode-pack"
          inputMode="numeric"
          value={pack}
          disabled={busy}
          placeholder="Необязательно — порция по умолчанию 100 г"
          onChange={(event) => setPack(event.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button type="submit" className="btn btn-primary inline-flex items-center gap-2" disabled={busy}>
        {saving ? (
          <>
            <SceneBusy /> Сохраняем…
          </>
        ) : (
          "Сохранить и выбрать порцию"
        )}
      </button>
    </form>
  );
}
