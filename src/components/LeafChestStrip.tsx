"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { openChest } from "@/lib/chest-client";
import { playCelebrationChime } from "@/lib/celebration-chime";
import type { LeafPublic, LeafRarity } from "@/lib/leaf-chest";
import { isGamificationQuiet } from "@/lib/gamification-quiet";
import { lootGlyph } from "@/lib/rewards";
import { OPEN_CHEST_QUICK_EVENT } from "@/lib/open-chest-quick";
import { withBasePath } from "@/lib/paths";
import { isSoftCelebrationsMutedToday } from "@/lib/soft-celebration";
import { toDateKey } from "@/lib/dates";

/** Visual only. `epic` is not granted by the server. */
export type ChestLook = LeafRarity | "epic";

const OPEN_MS = 2100;
const OPEN_REDUCED_MS = 480;

type LeafChestStripProps = {
  selectedDate: string;
  today: string;
  refreshKey: number;
  /** Screenshot stand only. The ration page never passes this. */
  fixture?: LeafPublic;
  initialSheet?: boolean;
  previewReward?: OpenedReward | null;
  previewRevealed?: boolean;
  /** Screenshot stand: force the full open or the reduced one. */
  previewMotion?: "auto" | "full" | "reduce";
};

type OpenedReward = {
  key?: string;
  title: string;
  description: string;
  rarityLabel: string;
  look: ChestLook;
};

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function playChestFeedback(reduced: boolean) {
  if (isGamificationQuiet() || isSoftCelebrationsMutedToday(toDateKey(new Date()))) return;
  playCelebrationChime(reduced ? "soft" : "chest");
}

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

export function ChestArt({ look }: { look: ChestLook }) {
  return (
    <svg className={`leaf-chest-svg leaf-chest-svg--${look}`} viewBox="0 0 88 80" aria-hidden="true">
      <ellipse className="leaf-chest-shadow" cx="42" cy="74" rx="28" ry="4" />
      <path className="leaf-chest-side" d="M62 34 78 28v32L62 66Z" />
      <path className="leaf-chest-side-edge" d="M62 34 78 28 73 22 57 27.2Z" />
      <g className="leaf-chest-lid">
        <path className="leaf-chest-lid-top" d="M10 34 57 27.2 73 22 22 28Z" />
        <path className="leaf-chest-lid-front" d="M10 34h52v9.2c0 1.5-1.2 2.7-2.7 2.7H12.7A2.7 2.7 0 0 1 10 43.2Z" />
        <path className="leaf-chest-band" d="M24 32.2h3.4V46H24Z" />
        <path className="leaf-chest-band" d="M47 30.4h3.4V46H47Z" />
        <path className="leaf-chest-gem" d="M36 16.8 43 22.2 36 27.6 29 22.2Z" />
        <circle className="leaf-chest-rivet" cx="16" cy="39" r="1.35" />
        <circle className="leaf-chest-rivet" cx="56" cy="39" r="1.35" />
      </g>
      <path className="leaf-chest-body" d="M10 43.2h52V66c0 2.6-2.1 4.7-4.7 4.7H14.7C12.1 70.7 10 68.6 10 66Z" />
      <path className="leaf-chest-plank" d="M16 54h40" />
      <path className="leaf-chest-band" d="M24 43.2h3.6V70.7H24Z" />
      <path className="leaf-chest-band" d="M47 43.2h3.6V70.7H47Z" />
      <rect className="leaf-chest-lock" x="31" y="49" width="14" height="16" rx="2.5" />
      <circle className="leaf-chest-keyhole" cx="38" cy="55" r="1.8" />
      <path className="leaf-chest-keyhole" d="M38 56.8v3.4" />
      <circle className="leaf-chest-rivet" cx="16" cy="48" r="1.35" />
      <circle className="leaf-chest-rivet" cx="56" cy="48" r="1.35" />
      <circle className="leaf-chest-rivet" cx="16" cy="66" r="1.35" />
      <circle className="leaf-chest-rivet" cx="56" cy="66" r="1.35" />
    </svg>
  );
}

function ChestFrame({ look, children }: { look: ChestLook; children: ReactNode }) {
  return <span className={`leaf-chest-frame leaf-chest-frame--${look}`}>{children}</span>;
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
  previewReward = null,
  previewRevealed = false,
  previewMotion = "auto",
}: LeafChestStripProps) {
  const [view, setView] = useState<LeafPublic | null>(fixture ?? null);
  const [sheet, setSheet] = useState(initialSheet);
  const [legacyReady, setLegacyReady] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reward, setReward] = useState<OpenedReward | null>(previewReward);
  const [revealed, setRevealed] = useState(previewRevealed);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [showCeremony, setShowCeremony] = useState(Boolean(previewReward));
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
    if (!previewReward) return;
    setReward(previewReward);
    setRevealed(previewRevealed);
    setReduceMotion(
      previewMotion === "full" ? false : previewMotion === "reduce" ? true : prefersReducedMotion(),
    );
    setShowCeremony(true);
    setSheet(false);
  }, [previewReward, previewRevealed, previewMotion]);

  useEffect(() => {
    if (!showCeremony || revealed) return;
    const timer = window.setTimeout(
      () => setRevealed(true),
      reduceMotion ? OPEN_REDUCED_MS : OPEN_MS,
    );
    return () => window.clearTimeout(timer);
  }, [showCeremony, revealed, reduceMotion]);

  const beginCeremony = (next: OpenedReward, sound = true) => {
    const reduced = prefersReducedMotion();
    setReduceMotion(reduced);
    setSheet(false);
    setRevealed(false);
    setReward(next);
    setShowCeremony(true);
    if (sound) playChestFeedback(reduced);
  };

  const revealNow = () => setRevealed(true);

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
        reward?: { key?: string; title: string; description: string } | null;
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
        key: data.reward.key,
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
          <ChestFrame look={view.ready && view.rarity ? view.rarity : view.chestLook}>
            <ChestArt look={view.ready && view.rarity ? view.rarity : view.chestLook} />
          </ChestFrame>
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
    <div
      className={`leaf-open${revealed ? " leaf-open--done" : " leaf-open--play"}${reduceMotion ? " leaf-open--reduce" : ""}`}
      role="dialog"
      aria-label="Открытие сундука"
    >
      {revealed ? (
        <div className={`leaf-open-card leaf-open-card--${reward.look}`}>
          {reduceMotion ? null : (
            <span className="leaf-confetti" aria-hidden="true">
              {Array.from({ length: 14 }, (_, index) => (
                <i key={index} />
              ))}
            </span>
          )}
          <ChestFrame look={reward.look}>
            <ChestArt look={reward.look} />
          </ChestFrame>
          <p className="leaf-open-rarity">{reward.rarityLabel}</p>
          <p className="leaf-open-glyph" aria-hidden="true">
            {lootGlyph(reward.key)}
          </p>
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
            Забрать
          </button>
        </div>
      ) : (
        <>
          <span className="leaf-rays" aria-hidden="true" />
          <span className="leaf-flash" aria-hidden="true" />
          <div className={`leaf-stage leaf-stage--${reward.look}`}>
            <ChestArt look={reward.look} />
          </div>
          <p className="leaf-loot-fly">
            <span aria-hidden="true">{lootGlyph(reward.key)}</span> {reward.title}
          </p>
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
        <ChestFrame look={view.ready && view.rarity ? view.rarity : view.chestLook}>
          <ChestArt look={view.ready && view.rarity ? view.rarity : view.chestLook} />
        </ChestFrame>
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
