"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { openChest } from "@/lib/chest-client";
import type { LeafPublic, LeafRarity } from "@/lib/leaf-chest";
import { OPEN_CHEST_QUICK_EVENT } from "@/lib/open-chest-quick";
import { withBasePath } from "@/lib/paths";
import { isSoftCelebrationsMutedToday } from "@/lib/soft-celebration";
import { toDateKey } from "@/lib/dates";

type LeafChestStripProps = {
  selectedDate: string;
  today: string;
  refreshKey: number;
  /** Screenshot stand only. The ration page never passes this. */
  fixture?: LeafPublic;
  initialSheet?: boolean;
};

type OpenedReward = {
  title: string;
  description: string;
  rarityLabel: string;
  look: LeafRarity;
};

function LeafMark({ filled }: { filled: boolean }) {
  return (
    <svg className="leaf-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M13.2 2.2 18.2 7.6 19.4 13.8 14.6 18.2 11.4 17.2 7.2 12.8 8.4 6.2Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? 0.6 : 1.6}
        strokeLinejoin="round"
      />
      <path
        d="M12.2 17.4 9.2 22.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12.4 16.2 14.2 4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChestArt({ look }: { look: LeafRarity }) {
  return (
    <svg className={`leaf-chest-svg leaf-chest-svg--${look}`} viewBox="0 0 72 64" aria-hidden="true">
      <ellipse className="leaf-chest-shadow" cx="34" cy="60" rx="22" ry="3.2" />
      <path className="leaf-chest-side" d="M50 26.2 63 21.6V49.2L50 54Z" />
      <g className="leaf-chest-lid">
        <path className="leaf-chest-lid-top" d="M8 26.2 46 20.2 58 16.4 16 21.6Z" />
        <path className="leaf-chest-lid-front" d="M8 26.2h42v7.4c0 1.2-1 2.2-2.2 2.2H10.2A2.2 2.2 0 0 1 8 33.6Z" />
        <path className="leaf-chest-band" d="M20 25.4 22.4 24.6V35.6L20 35.8Z" />
        <path className="leaf-chest-band" d="M38 23.6 40.4 22.8V35.6L38 35.8Z" />
        <path className="leaf-chest-gem" d="M29.5 14.6 34.2 18.4 29.5 22.2 24.8 18.4Z" />
      </g>
      <path className="leaf-chest-body" d="M8 33.2h42V52c0 2.2-1.8 4-4 4H12c-2.2 0-4-1.8-4-4Z" />
      <path className="leaf-chest-band" d="M20 33.2h3.4V56H20Z" />
      <path className="leaf-chest-band" d="M38 33.2h3.4V56H38Z" />
      <rect className="leaf-chest-lock" x="24.2" y="38" width="12" height="13.5" rx="2.2" />
      <circle className="leaf-chest-keyhole" cx="30.2" cy="43.2" r="1.7" />
      <path className="leaf-chest-keyhole" d="M30.2 44.8v3.1" />
    </svg>
  );
}

function LeafMeter({ slots, large = false }: { slots: LeafPublic["slots"]; large?: boolean }) {
  return (
    <span className={`leaf-meter${large ? " leaf-meter--large" : ""}`} aria-hidden="true">
      {slots.map((slot, index) => (
        <span key={`${slot.state}-${index}`} className={`leaf-meter-slot leaf-meter-slot--${slot.state}`}>
          <LeafMark filled={slot.state === "on"} />
        </span>
      ))}
    </span>
  );
}

export function LeafChestStrip({
  selectedDate,
  today,
  refreshKey,
  fixture,
  initialSheet = false,
}: LeafChestStripProps) {
  const [view, setView] = useState<LeafPublic | null>(fixture ?? null);
  const [sheet, setSheet] = useState(initialSheet);
  const [legacyReady, setLegacyReady] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reward, setReward] = useState<OpenedReward | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [beat, setBeat] = useState(0);
  const [showCeremony, setShowCeremony] = useState(false);
  const [mounted, setMounted] = useState(false);

  const reload = useCallback(async () => {
    if (fixture) {
      setView(fixture);
      return;
    }
    if (selectedDate !== today) {
      setView(null);
      return;
    }
    try {
      const [chestResp, legacyResp] = await Promise.all([
        fetch(withBasePath("/api/leaf-chest"), { cache: "no-store" }),
        fetch(withBasePath("/api/rewards"), { cache: "no-store" }),
      ]);
      if (!chestResp.ok) return;
      const data = (await chestResp.json()) as LeafPublic;
      setView(data);
      if (legacyResp.ok) {
        const legacy = (await legacyResp.json()) as { chest?: { readyCount?: number } };
        setLegacyReady(legacy.chest?.readyCount ?? 0);
      }
    } catch {
      setView(null);
    }
  }, [fixture, selectedDate, today]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  useEffect(() => {
    const openSheet = () => setSheet(true);
    window.addEventListener(OPEN_CHEST_QUICK_EVENT, openSheet);
    return () => window.removeEventListener(OPEN_CHEST_QUICK_EVENT, openSheet);
  }, []);

  useEffect(() => {
    if (!showCeremony || revealed) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const muted = isSoftCelebrationsMutedToday(toDateKey(new Date()));
    if (reduce || muted) {
      setRevealed(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setBeat((value) => {
        if (value >= 3) {
          setRevealed(true);
          return value;
        }
        return value + 1;
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [showCeremony, revealed, beat]);

  const beginCeremony = (next: OpenedReward) => {
    setSheet(false);
    setBeat(0);
    setRevealed(false);
    setReward(next);
    setShowCeremony(true);
  };

  const revealNow = () => {
    setBeat(3);
    setRevealed(true);
  };

  const openReady = async () => {
    if (busy || !view?.ready) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch(withBasePath("/api/leaf-chest"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open" }),
      });
      const data = (await resp.json()) as {
        error?: string;
        opened?: boolean;
        view?: LeafPublic;
        reward?: { title: string; description: string } | null;
        rarity?: LeafRarity | null;
        rarityLabel?: string | null;
      };
      if (!resp.ok || !data.opened || !data.reward) {
        setError(data.error ?? "Сундук пока не открывается");
        if (data.view) setView(data.view);
        return;
      }
      if (data.view) setView(data.view);
      beginCeremony({
        title: data.reward.title,
        description: data.reward.description,
        rarityLabel: data.rarityLabel ?? "Обычный",
        look: data.rarity ?? "common",
      });
    } catch {
      setError("Нет связи. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  const spendSpare = async () => {
    if (busy || !view?.canSpendSpare) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch(withBasePath("/api/leaf-chest"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "spare" }),
      });
      const data = (await resp.json()) as LeafPublic & { error?: string };
      if (!resp.ok) {
        setError(data.error ?? "Листок не встал");
        return;
      }
      setView(data);
    } catch {
      setError("Нет связи. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  const openLegacy = async () => {
    if (busy || legacyReady <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await openChest({ source: "next", action: "open", date: today });
      if (!result?.reward) {
        setError("Прежний сундук уже открыт");
        setLegacyReady(0);
        return;
      }
      const label =
        result.reward.rarity === "festive"
          ? "Золотой"
          : result.reward.rarity === "rare"
            ? "Редкий"
            : "Обычный";
      setLegacyReady(result.chest?.readyCount ?? Math.max(0, legacyReady - 1));
      beginCeremony({
        title: result.reward.title,
        description: result.reward.description,
        rarityLabel: label,
        look: result.reward.rarity === "festive" ? "gold" : result.reward.rarity === "rare" ? "rare" : "common",
      });
    } catch {
      setError("Нет связи. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  if (selectedDate !== today || !view) return null;

  const sheetNode = sheet ? (
    <div className="leaf-sheet-root" role="presentation">
      <button type="button" className="leaf-sheet-backdrop" aria-label="Закрыть" onClick={() => setSheet(false)} />
      <div className="leaf-sheet" role="dialog" aria-labelledby="leaf-sheet-title">
        <div className="leaf-sheet-grab" />
        <div className="leaf-sheet-hero">
          <ChestArt look={view.ready && view.rarity ? view.rarity : view.chestLook} />
          <div>
            <h2 id="leaf-sheet-title" className="leaf-sheet-title">
              {view.ready ? "Сундук твой" : "Сундук"}
            </h2>
            <p className="leaf-sheet-count">{view.filled} из 3 листков</p>
          </div>
        </div>
        <LeafMeter slots={view.slots} large />
        <p className="leaf-sheet-line">{view.line}</p>
        {view.sheetHint !== view.line ? <p className="leaf-sheet-hint">{view.sheetHint}</p> : null}
        {view.ready && view.rarityLabel ? (
          <p className="leaf-sheet-rarity">{view.rarityLabel}</p>
        ) : null}
        {view.pendingNote ? <p className="leaf-sheet-pending">{view.pendingNote}</p> : null}
        {error ? <p className="leaf-sheet-error">{error}</p> : null}
        {view.ready ? (
          <button type="button" className="leaf-sheet-open" disabled={busy} onClick={() => void openReady()}>
            Открыть сундук
          </button>
        ) : null}
        {view.canSpendSpare ? (
          <button type="button" className="leaf-sheet-spare" disabled={busy} onClick={() => void spendSpare()}>
            Поставить листок на вчера
          </button>
        ) : null}
        {legacyReady > 0 ? (
          <button type="button" className="leaf-sheet-spare" disabled={busy} onClick={() => void openLegacy()}>
            {legacyReady > 1 ? `Есть ещё ${legacyReady} прежних сундука` : "Есть прежний сундук"}
          </button>
        ) : null}
        <p className="leaf-sheet-fine">{view.finePrint}</p>
      </div>
    </div>
  ) : null;

  const ceremonyNode = showCeremony && reward ? (
    <div className="leaf-open" role="dialog" aria-label="Открытие сундука">
      {revealed ? (
        <div className="leaf-open-card">
          <p className="leaf-open-rarity">{reward.rarityLabel}</p>
          <h2>{reward.title}</h2>
          <p>{reward.description}</p>
          <button
            type="button"
            className="leaf-sheet-open"
            onClick={() => {
              setShowCeremony(false);
              setReward(null);
              setRevealed(false);
              void reload();
            }}
          >
            Хорошо
          </button>
        </div>
      ) : (
        <>
          <div className={`leaf-stage leaf-stage--${reward.look} leaf-stage--beat-${beat}`}>
            <ChestArt look={reward.look} />
          </div>
          <button type="button" className="leaf-open-skip" onClick={revealNow}>
            Хватит, покажи подарок
          </button>
        </>
      )}
    </div>
  ) : null;

  return (
    <>
      <button
        id="chest-dock"
        type="button"
        className={`leaf-strip${view.ready ? " leaf-strip--ready" : ""}`}
        aria-label={`Сундук, ${view.filled} из 3. ${view.line}`}
        onClick={() => {
          setError(null);
          setSheet(true);
        }}
      >
        <ChestArt look={view.ready && view.rarity ? view.rarity : view.chestLook} />
        <span className="leaf-strip-copy">
          <span className="leaf-strip-head">
            <span className="leaf-strip-title">Сундук</span>
            <span className="leaf-strip-count">{view.filled} из 3</span>
          </span>
          <LeafMeter slots={view.slots} />
          <p>{view.line}</p>
        </span>
      </button>
      {mounted && sheetNode ? createPortal(sheetNode, document.body) : null}
      {mounted && ceremonyNode ? createPortal(ceremonyNode, document.body) : null}
    </>
  );
}
