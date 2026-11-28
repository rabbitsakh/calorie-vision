"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CollectionBoard, type CollectionModel, type CollectionCell } from "@/components/CollectionBoard";
import { COLLECTION_ITEMS, COLLECTION_SETS, WINTER_SEASON, baseItems, publicRarity } from "@/lib/collection-sets";
import "../today-hero-preview/preview.css";

function cell(key: string, owned: boolean, unseen = false, equipped = false): CollectionCell {
  const entry = COLLECTION_ITEMS.find((item) => item.key === key);
  return {
    key,
    title: owned ? entry?.title ?? key : null,
    rarity: publicRarity(entry?.rarity ?? "rare"),
    owned,
    unseen,
    equipped,
  };
}

function model(mode: string): CollectionModel {
  const owned = new Set<string>();
  if (mode === "full" || mode === "prize") {
    for (const item of baseItems("fruits")) owned.add(item.key);
    owned.add("cheer_fruit_set");
  }
  if (mode === "dust") {
    for (const item of baseItems("fruits").slice(0, 6)) owned.add(item.key);
  }
  if (mode === "silhouettes" || mode === "new" || mode === "cycle") {
    owned.add("fruit_apple");
    owned.add("fruit_pear");
  }
  if (mode === "new") owned.add("sakh_star");
  const dust = mode === "dust" ? 12 : mode === "prize" ? 0 : 4;
  return {
    odds: "Обычный день: 70% обычный, 18% редкий, 7% эпический, 5% легендарный. Еда и зал в один день: 55% редкий, 25% эпический, 20% легендарный.",
    dustCost: 10,
    season: {
      title: WINTER_SEASON.title,
      start: WINTER_SEASON.start,
      end: WINTER_SEASON.end,
      active: false,
      items: COLLECTION_ITEMS.filter((item) => item.seasonal).map((item) => cell(item.key, mode === "season" && item.key === "winter_snow")),
    },
    sets: COLLECTION_SETS.map((set) => ({
      key: set.key,
      title: set.title,
      filled: baseItems(set.key).filter((item) => owned.has(item.key)).length,
      total: 8,
      dust: set.key === "fruits" ? dust : 0,
      items: baseItems(set.key).map((item) =>
        cell(
          item.key,
          owned.has(item.key),
          mode === "new" && item.key === "fruit_apple",
          owned.has(item.key) && item.key === "fruit_pear",
        ),
      ),
      completion: cell(set.completionKey, owned.has(set.completionKey), false, set.key === "fruits" && mode === "prize"),
    })),
    wardrobe: mode === "old" ? [cell("sticker_sprout", true), { key: "cheer_festive", title: "Праздничный настрой", rarity: "legendary", owned: true, unseen: false, equipped: false }] : [],
  };
}

function Preview() {
  const params = useSearchParams();
  const mode = params.get("mode") ?? "silhouettes";
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (mode !== "cycle") return;
    const timers = [900, 2200, 3600, 5200].map((ms, index) => window.setTimeout(() => setStep(index + 1), ms));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [mode]);
  const view = mode === "cycle" ? (step < 2 ? "new" : "dust") : mode;
  return (
    <div className="today-shot today-hero-force-dark" style={{ minHeight: "100vh", padding: 12 }}>
      {mode === "cycle" && step < 2 ? (
        <p className="collection-prize">{step === 0 ? "Сундук открыт" : "Новый предмет"}</p>
      ) : null}
      {mode === "cycle" && step >= 2 ? <p className="collection-prize">Повторка: +1 листик набора «Фрукты»</p> : null}
      <CollectionBoard model={model(view)} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Preview />
    </Suspense>
  );
}
