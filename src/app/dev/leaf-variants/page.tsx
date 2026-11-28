"use client";

import { CurrencyLeaf, type CurrencyLeafKind } from "@/components/CurrencyLeaf";
import "../today-hero-preview/preview.css";

const VARIANTS: { kind: CurrencyLeafKind; title: string; note: string }[] = [
  { kind: "mascot", title: "Маскот", note: "основной" },
  { kind: "gloss", title: "Блик", note: "без лица" },
  { kind: "wink", title: "Подмиг", note: "румянец" },
];

export default function Page() {
  return (
    <div className="today-shot today-hero-force-dark leaf-variants">
      <h1>Варианты листика</h1>
      <div className="leaf-variants-grid">
        {VARIANTS.map((item) => (
          <article key={item.kind} className="leaf-variant-card">
            <b>{item.title}</b>
            <small>{item.note}</small>
            <CurrencyLeaf kind={item.kind} className="collection-mini-leaf leaf-variant-big" />
            <span className="leaf-variant-real">
              <CurrencyLeaf kind={item.kind} />
              20 px
            </span>
            <span className="leaf-variant-real leaf-variant-16">
              <CurrencyLeaf kind={item.kind} />
              16 px
            </span>
          </article>
        ))}
      </div>
      <article className="leaf-variant-card leaf-variant-gain">
        <b>Получение</b>
        <small>прыжок основного</small>
        <span className="collection-leaf-peak">
          <CurrencyLeaf />
        </span>
        <span className="leaf-variant-real">+1 листик</span>
      </article>
    </div>
  );
}
