"use client";

import { useState } from "react";
import { leavesCount } from "@/lib/russian-text";
import { withBasePath } from "@/lib/paths";

export type CollectionCell = {
  key: string;
  title: string | null;
  rarity: "common" | "rare" | "epic" | "legendary";
  owned: boolean;
  unseen: boolean;
  equipped: boolean;
};

export type CollectionSetView = {
  key: string;
  title: string;
  filled: number;
  total: number;
  dust: number;
  items: CollectionCell[];
  completion: CollectionCell | null;
};

export type CollectionModel = {
  odds: string;
  dustCost: number;
  season: {
    title: string;
    start: string;
    end: string;
    active: boolean;
    items: CollectionCell[];
  };
  sets: CollectionSetView[];
  wardrobe: CollectionCell[];
};

const RARITY_NAME = {
  common: "Обычный",
  rare: "Редкий",
  epic: "Эпический",
  legendary: "Легендарный",
} as const;

export function CollectionBoard({
  model,
  onExchange,
}: {
  model: CollectionModel;
  onExchange?: (setKey: string, rewardKey: string) => void;
}) {
  const [setKey, setSetKey] = useState(model.sets[0]?.key ?? "fruits");
  const current = model.sets.find((set) => set.key === setKey) ?? model.sets[0];
  if (!current) return null;
  const empty = current.items.filter((cell) => !cell.owned);

  return (
    <div className="collection-board">
      <p className="collection-odds">{model.odds}</p>
      <div className="collection-sets">
        {model.sets.map((set) => (
          <button
            key={set.key}
            type="button"
            className={`collection-set${set.key === current.key ? " is-on" : ""}`}
            onClick={() => setSetKey(set.key)}
          >
            <b>{set.title}</b>
            <span>
              {set.filled} из {set.total}
            </span>
            <i style={{ width: `${Math.round((set.filled / set.total) * 100)}%` }} />
            <small className="collection-leaves" title={`Листики набора «${set.title}»`}>
              <MiniLeaf />
              {leavesCount(set.dust)}
            </small>
          </button>
        ))}
      </div>
      <section className="collection-grid" aria-label={current.title}>
        {current.items.map((cell) => (
          <article key={cell.key} className={`collection-cell collection-cell--${cell.rarity}${cell.owned ? " is-owned" : ""}`}>
            {cell.owned ? <Glyph itemKey={cell.key} /> : <span className="collection-silhouette" aria-hidden="true" />}
            <b>{cell.owned ? cell.title : RARITY_NAME[cell.rarity]}</b>
            {cell.unseen ? <em>новое</em> : null}
            {cell.equipped ? <em className="is-worn">на вас</em> : null}
          </article>
        ))}
      </section>
      {current.completion ? (
        <p className="collection-prize">
          Награда набора: {current.completion.owned ? current.completion.title : "ещё закрыта"}
          {current.completion.equipped ? " · на вас" : ""}
        </p>
      ) : null}
      {empty.length > 0 ? (
        <button
          type="button"
          className="leaf-sheet-open"
          disabled={current.dust < model.dustCost}
          onClick={() => onExchange?.(current.key, empty[0]!.key)}
        >
          {current.dust >= model.dustCost
            ? `Открыть пустую ячейку за ${leavesCount(model.dustCost)}`
            : `Нужно ${leavesCount(model.dustCost)} набора «${current.title}»`}
        </button>
      ) : null}
      <section className="collection-season">
        <h2>
          {model.season.title} · {model.season.start} — {model.season.end}
        </h2>
        <p>{model.season.active ? "Сезон идёт. Эти вещи могут выпасть." : "Сезон ещё не начался. Вещи не обязательны для набора."}</p>
        <div className="collection-grid">
          {model.season.items.map((cell) => (
            <article key={cell.key} className={`collection-cell collection-cell--${cell.rarity}${cell.owned ? " is-owned" : ""}`}>
              {cell.owned ? <Glyph itemKey={cell.key} /> : <span className="collection-silhouette" />}
              <b>{cell.owned ? cell.title : RARITY_NAME[cell.rarity]}</b>
            </article>
          ))}
        </div>
      </section>
      {model.wardrobe.length > 0 ? (
        <section>
          <h2 className="collection-prize">Уже было</h2>
          <div className="collection-grid">
            {model.wardrobe.map((cell) => (
              <article key={cell.key} className={`collection-cell is-owned collection-cell--${cell.rarity}`}>
                <b>{cell.title}</b>
                <small>{RARITY_NAME[cell.rarity]}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function MiniLeaf() {
  return (
    <svg className="collection-mini-leaf" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M13.2 2.2 18.2 7.6 19.4 13.8 14.6 18.2 11.4 17.2 7.2 12.8 8.4 6.2Z"
        fill="currentColor"
      />
      <path d="M12.2 17.4 9.2 22.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12.4 16.2 14.2 4.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function Glyph({ itemKey }: { itemKey: string }) {
  const fruit = itemKey.startsWith("fruit");
  const sport = itemKey.startsWith("sport");
  return (
    <svg className="collection-glyph" viewBox="0 0 48 48" aria-hidden="true">
      {fruit ? (
        <circle cx="24" cy="26" r="12" />
      ) : sport ? (
        <rect x="14" y="16" width="20" height="16" rx="4" />
      ) : (
        <path d="M8 32 24 10l16 22Z" />
      )}
    </svg>
  );
}

export async function exchangeCollection(setKey: string, rewardKey: string) {
  const resp = await fetch(withBasePath("/api/collection"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "exchange", setKey, rewardKey }),
  });
  return resp;
}
