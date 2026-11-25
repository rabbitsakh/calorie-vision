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

function LeafMark({ state }: { state: "on" | "wait" | "empty" }) {
  const filled = state === "on";
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M13.2 2.2 18.2 7.6 19.4 13.8 14.6 18.2 11.4 17.2 7.2 12.8 8.4 6.2Z"
        fill={filled ? "#0d7377" : "none"}
        stroke={filled ? "none" : "#0d7377"}
        strokeWidth={filled ? undefined : 1.6}
        strokeLinejoin="round"
      />
      <path
        d="M12.2 17.4 9.2 22.6"
        fill="none"
        stroke={filled ? "#e8f7f4" : "#0d7377"}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12.4 16.2 14.2 4.2"
        fill="none"
        stroke={filled ? "#d5f3ee" : "#0d7377"}
        strokeWidth={filled ? 1.5 : 1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

function MiniChest({ look }: { look: LeafRarity }) {
  return (
    <span className={`leaf-mini leaf-mini--${look}`} aria-hidden="true">
      <i className="leaf-mini-lid" />
      <i className="leaf-mini-box" />
      <i className="leaf-mini-gem" />
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
        <h2 id="leaf-sheet-title" className="leaf-sheet-title">
          {view.ready ? "Сундук твой" : "Три листка"}
        </h2>
        <div className="leaf-sheet-leaves">
          {view.slots.map((slot, index) => (
            <span key={`${slot.state}-${index}`} className={`leaf-slot leaf-slot--${slot.state}`}>
              <LeafMark state={slot.state} />
              {slot.label ? <small>{slot.label}</small> : null}
            </span>
          ))}
        </div>
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
            <span className="leaf-stage-box" />
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
        onClick={() => {
          setError(null);
          setSheet(true);
        }}
      >
        <MiniChest look={view.ready && view.rarity ? view.rarity : view.chestLook} />
        <span className="leaf-strip-copy">
          <p>{view.line}</p>
          <span className="leaf-strip-leaves">
            {view.slots.map((slot, index) => (
              <span key={`${slot.state}-${index}`} className={`leaf-slot leaf-slot--${slot.state}`}>
                <LeafMark state={slot.state} />
                {slot.label ? <small>{slot.label}</small> : null}
              </span>
            ))}
          </span>
        </span>
        <span className="leaf-strip-chev" aria-hidden="true">
          ›
        </span>
      </button>
      {mounted && sheetNode ? createPortal(sheetNode, document.body) : null}
      {mounted && ceremonyNode ? createPortal(ceremonyNode, document.body) : null}
    </>
  );
}
