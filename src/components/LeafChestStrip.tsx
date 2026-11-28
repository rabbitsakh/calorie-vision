"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { openChest } from "@/lib/chest-client";
import { playChestCue, stopChestAudio } from "@/lib/chest-sfx";
import { CHEST_ODDS_LINE, type LeafPublic, type LeafRarity } from "@/lib/leaf-chest";
import { lootGlyph } from "@/lib/rewards";
import { CurrencyLeaf } from "@/components/CurrencyLeaf";
import { leavesCount } from "@/lib/russian-text";
import { OPEN_CHEST_QUICK_EVENT } from "@/lib/open-chest-quick";
import { withBasePath } from "@/lib/paths";

/** Visual only. `epic` is not granted by the server. */
export type ChestLook = LeafRarity | "epic";

const TAP_LOCK_MS = 720;
const OPEN_BURST_MS = 1900;
const OPEN_REDUCED_MS = 480;

type ChestPaint = {
  bodyA: string;
  bodyB: string;
  side: string;
  metalA: string;
  metalB: string;
  lidA: string;
  lidB: string;
  gem: string;
  gem2: string;
};

const CHEST_PAINT: Record<ChestLook, ChestPaint> = {
  common: {
    bodyA: "#d7a15a",
    bodyB: "#6d4124",
    side: "#4a2c16",
    metalA: "#f2f3f5",
    metalB: "#7e868f",
    lidA: "#f0c27a",
    lidB: "#a56a34",
    gem: "#d5dbe3",
    gem2: "#b7c0ca",
  },
  rare: {
    bodyA: "#4c8fe0",
    bodyB: "#1a3f86",
    side: "#102a58",
    metalA: "#f7fbff",
    metalB: "#a9b6c6",
    lidA: "#9ec8f8",
    lidB: "#2a62b4",
    gem: "#e7f2ff",
    gem2: "#9ec4ff",
  },
  epic: {
    bodyA: "#8b5cf6",
    bodyB: "#43158a",
    side: "#2a0d58",
    metalA: "#f6edff",
    metalB: "#c4b0e0",
    lidA: "#c4a6ff",
    lidB: "#6d3cc4",
    gem: "#f0e4ff",
    gem2: "#d7b8ff",
  },
  gold: {
    bodyA: "#ffd56a",
    bodyB: "#c48412",
    side: "#8a5608",
    metalA: "#fff8dc",
    metalB: "#e2b84a",
    lidA: "#ffe7a3",
    lidB: "#e0a820",
    gem: "#ff4d6d",
    gem2: "#7ee7ff",
  },
};

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
  /** Screenshot stand: frozen beat or an automatic tap script. */
  previewPhase?: "ask" | "burst" | "card" | "play";
};

type OpenedReward = {
  key?: string;
  title: string;
  description: string;
  rarityLabel: string;
  look: ChestLook;
  leaves?: boolean;
};

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function rarityHeading(look: ChestLook, fallback: string): string {
  if (look === "gold") return "Легендарный";
  if (look === "epic") return "Эпический";
  if (look === "rare") return "Редкий";
  if (look === "common") return "Обычный";
  return fallback;
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
  const paint = CHEST_PAINT[look];
  const id = `cv-${look}`;
  return (
    <svg className={`leaf-chest-svg leaf-chest-svg--${look}`} viewBox="0 0 120 108" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={paint.bodyA} />
          <stop offset="1" stopColor={paint.bodyB} />
        </linearGradient>
        <linearGradient id={`${id}-lid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={paint.lidA} />
          <stop offset="1" stopColor={paint.lidB} />
        </linearGradient>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={paint.metalA} />
          <stop offset="0.45" stopColor={paint.metalB} />
          <stop offset="1" stopColor={paint.metalA} />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={paint.bodyB} />
          <stop offset="1" stopColor={paint.side} />
        </linearGradient>
      </defs>
      <ellipse cx="54" cy="100" rx="36" ry="5" fill="#000" opacity="0.35" />
      <path d="M78 40 104 32v40L78 82Z" fill={`url(#${id}-side)`} />
      <path d="M78 40 104 32 98 24 72 31Z" fill={paint.bodyA} opacity="0.85" />
      <g className="leaf-chest-lid">
        <path d="M14 40 72 31 98 24 28 32Z" fill={paint.lidA} />
        <path d="M14 40h64v12c0 2-1.6 3.4-3.4 3.4H17.4A3.4 3.4 0 0 1 14 52Z" fill={`url(#${id}-lid)`} stroke="#1a120c" strokeWidth="1.2" />
        <path d="M30 38h5v17h-5Z" fill={`url(#${id}-metal)`} />
        <path d="M62 36h5v19h-5Z" fill={`url(#${id}-metal)`} />
        <path d="M46 20 54 26.5 46 33 38 26.5Z" fill={paint.gem} stroke="#1a120c" strokeWidth="0.6" />
        {look === "gold" ? (
          <>
            <circle cx="34" cy="27" r="2.2" fill={paint.gem2} />
            <circle cx="58" cy="25" r="2.2" fill="#fff" />
          </>
        ) : null}
        <circle cx="22" cy="46" r="1.7" fill={paint.metalA} />
        <circle cx="70" cy="46" r="1.7" fill={paint.metalA} />
      </g>
      <path d="M14 52h64v28c0 3.2-2.6 5.6-5.6 5.6H19.6A5.6 5.6 0 0 1 14 80Z" fill={`url(#${id}-body)`} stroke="#1a120c" strokeWidth="1.4" />
      <path d="M20 66h52" stroke="rgba(255,255,255,0.28)" strokeWidth="1.4" />
      <path d="M30 52h5.2v33.6H30Z" fill={`url(#${id}-metal)`} />
      <path d="M62 52h5.2v33.6H62Z" fill={`url(#${id}-metal)`} />
      <rect x="40" y="60" width="16" height="18" rx="3" fill={paint.side} stroke={paint.metalA} strokeWidth="1" />
      <circle cx="48" cy="67" r="2" fill="none" stroke={paint.metalA} strokeWidth="1.3" />
      <path d="M48 69v3.2" stroke={paint.metalA} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="22" cy="58" r="1.8" fill={paint.metalA} />
      <circle cx="70" cy="58" r="1.8" fill={paint.metalA} />
      <circle cx="22" cy="80" r="1.8" fill={paint.metalA} />
      <circle cx="70" cy="80" r="1.8" fill={paint.metalA} />
      <path className="leaf-seam" d="M18 52h56" />
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
  previewPhase = "ask",
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
  const [taps, setTaps] = useState(0);
  const [tapLock, setTapLock] = useState(false);
  const timers = useRef<number[]>([]);
  const chestReloadImmediate = useRef(true);
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
      const chestResp = await fetch(withBasePath("/api/leaf-chest"), { cache: "no-store" });
      if (!chestResp.ok) return;
      const data = (await chestResp.json()) as LeafPublic;
      setView(data);
    } catch {
      setView(null);
    }
  }, [fixture, selectedDate, today]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (fixture || chestReloadImmediate.current) {
      chestReloadImmediate.current = false;
      void reload();
      return;
    }
    const id = window.setTimeout(() => {
      void reload();
    }, 300);
    return () => window.clearTimeout(id);
  }, [reload, refreshKey]);

  useEffect(() => {
    if (!sheet || fixture) return;
    let cancelled = false;
    void (async () => {
      try {
        const legacyResp = await fetch(withBasePath("/api/rewards"), { cache: "no-store" });
        if (!legacyResp.ok || cancelled) return;
        const legacy = (await legacyResp.json()) as { chest?: { readyCount?: number } };
        setLegacyReady(legacy.chest?.readyCount ?? 0);
      } catch {
        // Шторка открывается и без счётчика старых сундуков.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sheet, fixture]);

  useEffect(() => {
    const openSheet = () => setSheet(true);
    window.addEventListener(OPEN_CHEST_QUICK_EVENT, openSheet);
    return () => window.removeEventListener(OPEN_CHEST_QUICK_EVENT, openSheet);
  }, []);

  useEffect(() => {
    if (!previewReward) return;
    const reduced = previewMotion === "full" ? false : previewMotion === "reduce" ? true : prefersReducedMotion();
    setReward(previewReward);
    setRevealed(previewRevealed);
    setReduceMotion(reduced);
    setShowCeremony(true);
    setSheet(false);
    if (previewPhase === "burst") setTaps(3);
    else if (previewRevealed || previewPhase === "card") setTaps(3);
    else setTaps(0);
    if (previewPhase === "play" && !reduced && !previewRevealed) {
      const script = [
        window.setTimeout(() => setTaps(1), 700),
        window.setTimeout(() => setTaps(2), 1700),
        window.setTimeout(() => setTaps(3), 2700),
        window.setTimeout(() => setRevealed(true), 4800),
      ];
      return () => script.forEach((id) => window.clearTimeout(id));
    }
    if (reduced && !previewRevealed && previewPhase !== "burst") {
      const timer = window.setTimeout(() => setRevealed(true), OPEN_REDUCED_MS);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [previewReward, previewRevealed, previewMotion, previewPhase]);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
      stopChestAudio();
    },
    [],
  );

  const beginCeremony = (next: OpenedReward) => {
    const reduced = prefersReducedMotion();
    setReduceMotion(reduced);
    setSheet(false);
    setRevealed(false);
    setTaps(0);
    setTapLock(false);
    setReward(next);
    setShowCeremony(true);
    if (reduced) {
      const id = window.setTimeout(() => setRevealed(true), OPEN_REDUCED_MS);
      timers.current.push(id);
    }
  };

  const onChestTap = () => {
    if (reduceMotion || revealed || tapLock || taps >= 3) return;
    const next = taps + 1;
    setTaps(next);
    setTapLock(true);
    const unlock = window.setTimeout(() => setTapLock(false), TAP_LOCK_MS);
    timers.current.push(unlock);
    if (next === 1) playChestCue("tap");
    else if (next === 2) playChestCue("rise");
    else {
      playChestCue("open");
      const done = window.setTimeout(() => {
        setRevealed(true);
        playChestCue("reward");
      }, OPEN_BURST_MS);
      timers.current.push(done);
    }
  };

  const revealNow = () => {
    setTaps(3);
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
        reward?: { key?: string; title: string; description: string } | null;
        rarity?: LeafRarity | null;
        rarityLabel?: string | null;
        dust?: { setTitle: string; amount: number } | null;
      };
      if (!resp.ok || !data.opened || !data.reward) {
        setError(data.error ?? "Сундук пока не открывается");
        if (data.view) setView(data.view);
        return;
      }
      if (data.view) setView(data.view);
      beginCeremony({
        title: data.dust ? `+${leavesCount(data.dust.amount)}` : data.reward.title,
        description: data.dust
          ? `Уже есть. Листики набора «${data.dust.setTitle}».`
          : data.reward.description,
        rarityLabel: data.rarityLabel ?? "Обычный",
        key: data.reward.key,
        look: data.rarity ?? "common",
        leaves: Boolean(data.dust),
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
        <p className="leaf-sheet-fine">{CHEST_ODDS_LINE}</p>
      </div>
    </div>
  ) : null;

  const closeCeremony = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    stopChestAudio();
    setShowCeremony(false);
    setReward(null);
    setRevealed(false);
    setTaps(0);
    void reload();
  };

  const ceremonyNode = showCeremony && reward ? (
    <div
      className={`leaf-open leaf-open--${reward.look}${revealed ? " leaf-open--done" : " leaf-open--play"} leaf-open--t${taps}${reduceMotion ? " leaf-open--reduce" : ""}`}
      role="dialog"
      aria-label="Открытие сундука"
    >
      {revealed ? (
        <div className={`leaf-open-card leaf-open-card--${reward.look}`}>
          {reduceMotion ? null : (
            <span className="leaf-confetti" aria-hidden="true">
              {Array.from({ length: 18 }, (_, index) => (
                <i key={index} />
              ))}
            </span>
          )}
          <p className="leaf-open-rarity">{rarityHeading(reward.look, reward.rarityLabel)}</p>
          <p className="leaf-open-glyph" aria-hidden="true">
            {reward.leaves ? (
              <span className={reduceMotion ? "collection-leaf-still" : "collection-leaf-gain"}>
                <CurrencyLeaf />
              </span>
            ) : (
              lootGlyph(reward.key)
            )}
          </p>
          <h2>{reward.title}</h2>
          <p>{reward.description}</p>
          <button type="button" className="leaf-sheet-open leaf-claim" onClick={closeCeremony}>
            Забрать
          </button>
        </div>
      ) : (
        <>
          <span className="leaf-rays" aria-hidden="true" />
          <span className="leaf-flash" aria-hidden="true" />
          {taps >= 3 && !reduceMotion ? (
            <span className="leaf-burst" aria-hidden="true">
              {Array.from({ length: 16 }, (_, index) => (
                <i key={index} className={index % 3 === 0 ? "is-coin" : "is-spark"} />
              ))}
            </span>
          ) : null}
          <button type="button" className="leaf-stage" onClick={onChestTap}>
            <span className="leaf-chest-bob">
              <ChestArt look={reward.look} />
            </span>
          </button>
          <p className="leaf-tap-hint">{taps >= 3 ? "Открывается…" : "Тапни, чтобы открыть"}</p>
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
