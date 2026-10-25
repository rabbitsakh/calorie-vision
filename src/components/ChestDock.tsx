"use client";

import { useCallback, useEffect, useState } from "react";
import { FullscreenCelebration } from "@/components/FullscreenCelebration";
import { LootRevealCard } from "@/components/LootRevealCard";
import {
  flushPendingMetaChests,
  openChest,
  presentChestGrant,
  type ChestRewardPayload,
} from "@/lib/chest-client";
import type { ChestMeterModel } from "@/lib/chest-progress";
import { withBasePath } from "@/lib/paths";
import type { RewardRarity } from "@/lib/rewards";
import {
  isSoftCelebrationQuietBlocked,
  isSoftCelebrationsMutedToday,
} from "@/lib/soft-celebration";
import { toDateKey } from "@/lib/dates";

type ChestDockProps = {
  selectedDate: string;
  today: string;
  refreshKey: number;
  onOpened?: () => void;
};

/**
 * Chests 2.0 — primary ration surface under DayHero.
 * Filling meter or ready «Открыть» CTA (open is explicit, not buried in «Ещё»).
 */
export function ChestDock({
  selectedDate,
  today,
  refreshKey,
  onOpened,
}: ChestDockProps) {
  const [meter, setMeter] = useState<ChestMeterModel | null>(null);
  const [busy, setBusy] = useState(false);
  const [quietLoot, setQuietLoot] = useState<ChestRewardPayload | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [loot, setLoot] = useState<{
    key?: string;
    title: string;
    description: string;
    rarity?: RewardRarity;
    rarityLabel?: string;
  } | null>(null);
  const todayKey = toDateKey(new Date());

  const reload = useCallback(async () => {
    if (selectedDate !== today) {
      setMeter(null);
      return;
    }
    try {
      const resp = await fetch(withBasePath("/api/rewards"), { cache: "no-store" });
      if (!resp.ok) return;
      const data = (await resp.json()) as { chest?: ChestMeterModel };
      if (data.chest) setMeter(data.chest);
    } catch {
      setMeter(null);
    }
  }, [selectedDate, today]);

  useEffect(() => {
    void reload();
  }, [reload, refreshKey]);

  async function handleOpen() {
    if (busy || selectedDate !== today) return;
    setBusy(true);
    try {
      const muted = isSoftCelebrationsMutedToday(todayKey);
      const quiet = isSoftCelebrationQuietBlocked();
      const result = await openChest({ source: "quest", action: "open", date: today });
      if (!result) return;

      if (result.chest) setMeter(result.chest);
      else void reload();

      if (result.reward) {
        presentChestGrant(result.reward, {
          quiet,
          muted,
          fallbackTitle: "Сундук открыт",
          fallbackSubtitle: "Награда в коллекции",
          onFullscreen: (reward) => {
            setLoot({
              key: reward.key,
              title: reward.title,
              description: reward.description,
              rarity: reward.rarity,
              rarityLabel: reward.rarityLabel,
            });
            setCelebrate(true);
          },
        });
        // Quiet path: show in-dock reveal (stronger than inbox alone).
        if (quiet && !muted) {
          setQuietLoot(result.reward);
          window.setTimeout(() => setQuietLoot(null), 5200);
        }
      } else {
        flushPendingMetaChests();
      }
      onOpened?.();
    } finally {
      setBusy(false);
    }
  }

  if (!meter || selectedDate !== today) return null;

  const pct =
    meter.per > 0 ? Math.min(100, Math.round((meter.filled / meter.per) * 100)) : 0;
  const ready = meter.state === "ready";

  return (
    <>
      <section
        className={`chest-dock ${ready ? "chest-dock--ready" : ""}`}
        aria-label="Прогресс сундука"
      >
        <div className="chest-dock-main">
          <div className="chest-dock-icon" aria-hidden>
            <ChestGlyph ready={ready} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="chest-dock-label">{meter.label}</p>
            <p className="chest-dock-detail">{meter.detail}</p>
            {meter.metaLabel ? (
              <p className="chest-dock-meta">{meter.metaLabel}</p>
            ) : null}
            {!ready ? (
              <div className="chest-dock-bar" aria-hidden>
                <span style={{ width: `${pct}%` }} />
              </div>
            ) : null}
            <p className="sr-only">
              {ready
                ? "Сундук готов к открытию"
                : `${meter.filled} из ${meter.per} дней к сундуку`}
            </p>
          </div>
          {ready ? (
            <button
              type="button"
              className="chest-dock-cta"
              disabled={busy}
              onClick={() => void handleOpen()}
            >
              {busy ? "…" : "Открыть"}
            </button>
          ) : null}
        </div>
        {quietLoot ? (
          <div className="chest-dock-quiet">
            <LootRevealCard
              rewardKey={quietLoot.key}
              title={quietLoot.title}
              description={quietLoot.description}
              rarity={quietLoot.rarity}
              rarityLabel={quietLoot.rarityLabel}
              size="toast"
            />
          </div>
        ) : null}
      </section>

      {celebrate && loot ? (
        <FullscreenCelebration
          open
          variant="chest"
          pose="cheer"
          title={loot.title}
          subtitle={loot.description}
          lootKey={loot.key}
          lootRarity={loot.rarity}
          lootRarityLabel={loot.rarityLabel}
          badge="✦"
          durationMs={0}
          ctaLabel="Надеть"
          onClose={() => {
            setCelebrate(false);
            setLoot(null);
            flushPendingMetaChests();
            void reload();
          }}
        />
      ) : null}
    </>
  );
}

function ChestGlyph({ ready }: { ready: boolean }) {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden>
      <rect
        x="6"
        y="14"
        width="24"
        height="16"
        rx="3"
        fill={ready ? "#0d7377" : "#99f6e4"}
        stroke="#134e4a"
        strokeWidth="1.4"
      />
      <path
        d="M6 18 H30"
        stroke="#134e4a"
        strokeWidth="1.4"
        opacity="0.55"
      />
      <rect
        x="8"
        y="8"
        width="20"
        height="8"
        rx="2"
        fill={ready ? "#14b8a6" : "#ccfbf1"}
        stroke="#134e4a"
        strokeWidth="1.3"
      />
      <circle cx="18" cy="20" r="2.2" fill={ready ? "#fde68a" : "#0d7377"} />
    </svg>
  );
}
