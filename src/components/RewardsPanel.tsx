"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CHEST_SOURCE_LABELS,
  REWARD_GROUP_LABELS,
  RARITY_LABELS,
  frameAvatarClass,
  isCheerReward,
  isFrameReward,
  isStickerReward,
  cheerPhrase,
  lootGlyph,
  nextMetaProgress,
  rewardDef,
  type ChestSource,
  type RewardGroup,
  type RewardRarity,
} from "@/lib/rewards";
import { DiarySticker } from "@/components/DiarySticker";
import { StickerArt } from "@/components/StickerArt";
import { withBasePath } from "@/lib/paths";
import {
  getEquippedFrameKey,
  hydrateEquippedFrameFromAccount,
  persistEquippedFrameKey,
  subscribeEquippedFrame,
} from "@/lib/equipped-frame";
import {
  getEquippedStickerKey,
  hydrateEquippedStickerFromAccount,
  persistEquippedStickerKey,
  subscribeEquippedSticker,
} from "@/lib/equipped-sticker";
import {
  getEquippedCheerKey,
  hydrateEquippedCheerFromAccount,
  persistEquippedCheerKey,
  subscribeEquippedCheer,
} from "@/lib/equipped-cheer";
import { trackFrameEquippedGoal } from "@/lib/metrika-funnel";
import { shareStickerCard } from "@/lib/share-sticker";

type RewardItem = {
  key: string;
  title: string;
  description: string;
  rarity: RewardRarity;
  group: RewardGroup;
  rarityLabel: string;
  unlocked: boolean;
  unlockedAt: string | null;
  metaOnly?: boolean;
};

type FilterId = "all" | "owned" | "locked" | RewardRarity | RewardGroup;

const GROUP_ORDER: RewardGroup[] = ["sticker", "cheer", "frame"];

const CHEST_SOURCE_ORDER: ChestSource[] = [
  "quest",
  "challenge",
  "streak",
  "week",
  "meta",
  "referral",
];

const RARITY_TONE: Record<RewardRarity, string> = {
  common: "border-[var(--border-hairline)] bg-[var(--surface-mist)] text-[var(--muted-strong)]",
  rare: "border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent-ink)]",
  festive: "border-amber-200 bg-amber-50 text-amber-950",
};

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "owned", label: "Открытые" },
  { id: "locked", label: "Закрытые" },
  { id: "common", label: RARITY_LABELS.common },
  { id: "rare", label: RARITY_LABELS.rare },
  { id: "festive", label: RARITY_LABELS.festive },
  { id: "sticker", label: REWARD_GROUP_LABELS.sticker },
  { id: "cheer", label: REWARD_GROUP_LABELS.cheer },
  { id: "frame", label: REWARD_GROUP_LABELS.frame },
];

/**
 * Profile collection of chest cosmetics (waves 2 + 7–8).
 */
export function RewardsPanel() {
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [ownedCount, setOwnedCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<FilterId>("all");
  const [equipped, setEquipped] = useState<string | null>(null);
  const [equippedSticker, setEquippedSticker] = useState<string | null>(null);
  const [equippedCheer, setEquippedCheer] = useState<string | null>(null);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setEquipped(getEquippedFrameKey());
    setEquippedSticker(getEquippedStickerKey());
    setEquippedCheer(getEquippedCheerKey());
    void (async () => {
      const [frame, sticker, cheer] = await Promise.all([
        hydrateEquippedFrameFromAccount(),
        hydrateEquippedStickerFromAccount(),
        hydrateEquippedCheerFromAccount(),
      ]);
      setEquipped(frame);
      setEquippedSticker(sticker);
      setEquippedCheer(cheer);
    })();
    const unsubFrame = subscribeEquippedFrame(setEquipped);
    const unsubSticker = subscribeEquippedSticker(setEquippedSticker);
    const unsubCheer = subscribeEquippedCheer(setEquippedCheer);
    return () => {
      unsubFrame();
      unsubSticker();
      unsubCheer();
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const resp = await fetch(withBasePath("/api/rewards"));
      if (!resp.ok) {
        setLoaded(true);
        return;
      }
      const data = (await resp.json()) as {
        rewards: RewardItem[];
        ownedCount: number;
        total: number;
      };
      setRewards(data.rewards);
      setOwnedCount(data.ownedCount);
      setTotal(data.total);
    } catch {
      // non-critical
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!shareHint) return;
    const timer = window.setTimeout(() => setShareHint(null), 2800);
    return () => window.clearTimeout(timer);
  }, [shareHint]);

  async function onShareSticker(key: string) {
    const result = await shareStickerCard(key);
    setShareHint(
      result === "shared"
        ? "Наклейка отправлена"
        : result === "downloaded"
          ? "Картинка скачана"
          : "Не удалось поделиться",
    );
  }

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return rewards.filter((r) => {
      if (filter === "all") return true;
      if (filter === "owned") return r.unlocked;
      if (filter === "locked") return !r.unlocked;
      if (filter === "common" || filter === "rare" || filter === "festive") {
        return r.rarity === filter;
      }
      return r.group === filter;
    });
  }, [rewards, filter]);

  const grouped = useMemo(() => {
    return GROUP_ORDER.map((id) => ({
      id,
      label: REWARD_GROUP_LABELS[id],
      items: filtered.filter((r) => r.group === id),
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  function toggleEquip(key: string) {
    if (isFrameReward(key)) {
      const next = equipped === key ? null : key;
      void persistEquippedFrameKey(next);
      setEquipped(next);
      if (next) trackFrameEquippedGoal();
      return;
    }
    if (isStickerReward(key)) {
      const next = equippedSticker === key ? null : key;
      void persistEquippedStickerKey(next);
      setEquippedSticker(next);
      return;
    }
    if (isCheerReward(key)) {
      const next = equippedCheer === key ? null : key;
      void persistEquippedCheerKey(next);
      setEquippedCheer(next);
    }
  }

  const wearingSticker = equippedSticker
    ? rewardDef(equippedSticker)?.title ?? null
    : null;
  const wearingCheer = equippedCheer ? cheerPhrase(equippedCheer) : null;
  const wearingFrame = equipped ? rewardDef(equipped)?.title ?? null : null;
  const hasWear = Boolean(wearingSticker || wearingCheer || wearingFrame);
  const hasUnlockedWearable = rewards.some(
    (r) => r.unlocked && (r.group === "sticker" || r.group === "cheer" || r.group === "frame"),
  );

  if (!loaded) return null;
  if (rewards.length === 0) {
    // Soft empty scene — door into the day, not a dead end.
    return (
      <div
        id="rewards"
        className="rounded-2xl border border-dashed border-[var(--border-quiet)] bg-[var(--accent-soft)]/40 p-5"
      >
        <h2 className="font-display text-lg font-bold text-[var(--foreground)]">Коллекция</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted-strong)]">
          Пока пусто. Закройте день или недельный челлендж — первая награда из сундука появится
          здесь.
        </p>
        <ul className="mt-3 space-y-1 text-xs text-[var(--muted-strong)]">
          {CHEST_SOURCE_ORDER.map((source) => (
            <li key={source}>· {CHEST_SOURCE_LABELS[source]}</li>
          ))}
        </ul>
        <a
          href={withBasePath("/ration")}
          className="mt-3 inline-flex rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]"
        >
          Открыть рацион
        </a>
      </div>
    );
  }

  const metaHint = nextMetaProgress(ownedCount);
  const metaPct = metaHint
    ? Math.min(100, Math.round(metaHint.ratio * 100))
    : 0;

  return (
    <div id="rewards" className="rounded-2xl border border-[var(--border-quiet)] bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-[var(--foreground)]">Коллекция</h2>
        <span className="text-xs text-[var(--muted)]">
          {ownedCount} / {total}
        </span>
      </div>
      <p className="mb-2 text-sm text-[var(--muted)]">
        Награды из сундуков — без штрафов. Когда открывается:
      </p>
      <ul
        className="mb-3 flex flex-wrap gap-1.5"
        aria-label="Когда открываются сундуки"
      >
        {CHEST_SOURCE_ORDER.map((source) => (
          <li
            key={source}
            className="rounded-md bg-[var(--surface-mist)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted-strong)]"
          >
            {CHEST_SOURCE_LABELS[source]}
          </li>
        ))}
      </ul>

      {/* R11 — live wear preview */}
      <div className="mb-3 rounded-xl border border-[var(--border-quiet)] bg-[var(--accent-soft)]/50 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent-ink)]">
          Сейчас на вас
        </p>
        {hasWear ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {equipped || equippedSticker ? (
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-white ${frameAvatarClass(equipped)}`.trim()}
                aria-hidden
              >
                {equippedSticker ? <DiarySticker /> : null}
              </span>
            ) : null}
            <div className="min-w-0 text-sm font-medium text-[var(--foreground)]">
              {wearingFrame ? <p className="truncate">{wearingFrame}</p> : null}
              {wearingSticker ? <p className="truncate">{wearingSticker}</p> : null}
              {wearingCheer ? (
                <p className="truncate text-xs text-[var(--muted-strong)]">«{wearingCheer}»</p>
              ) : null}
            </div>
          </div>
        ) : hasUnlockedWearable ? (
          <p className="mt-1 text-xs text-[var(--muted-strong)]">
            Ничего не надето — выберите наклейку, фразу или рамку ниже.
          </p>
        ) : (
          <p className="mt-1 text-xs text-[var(--muted-strong)]">
            Откройте сундук — и первая награда появится здесь.
          </p>
        )}
      </div>

      {ownedCount === 0 ? (
        <p className="mb-3 rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-xs font-medium text-[var(--accent-ink)]">
          Коллекция пуста — закройте день или челлендж, откройте сундук, наденьте первую
          наклейку или фразу.
        </p>
      ) : null}
      {shareHint ? (
        <p className="mb-3 text-xs font-medium text-[var(--accent-ink)]" role="status">
          {shareHint}
        </p>
      ) : null}
      {metaHint ? (
        <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2">
          <div className="flex items-baseline justify-between gap-2 text-xs font-medium text-amber-950">
            <span>{metaHint.label}</span>
            <span className="tabular-nums">
              {metaHint.current}/{metaHint.target}
            </span>
          </div>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-amber-100"
            role="progressbar"
            aria-valuenow={metaHint.current}
            aria-valuemin={0}
            aria-valuemax={metaHint.target}
            aria-label="Прогресс к мета-сундуку"
          >
            <div
              className="h-full rounded-full bg-amber-500 transition-[width] duration-300"
              style={{ width: `${metaPct}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-1.5" role="toolbar" aria-label="Фильтр коллекции">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={active}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                active
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--accent-soft)] text-[var(--muted-strong)] hover:bg-[var(--surface-mist)]"
              }`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {grouped.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">По этому фильтру пока пусто.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map((group) => (
            <div key={group.id}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {group.items.map((reward) => {
                  const isFrame = reward.group === "frame";
                  const isSticker = reward.group === "sticker";
                  const isCheer = reward.group === "cheer";
                  const isEquipped =
                    (isFrame && equipped === reward.key) ||
                    (isSticker && equippedSticker === reward.key) ||
                    (isCheer && equippedCheer === reward.key);
                  return (
                    <div
                      key={reward.key}
                      className={`rounded-xl border px-3 py-2.5 ${
                        reward.unlocked
                          ? RARITY_TONE[reward.rarity]
                          : "border-[var(--border-hairline)] bg-[var(--surface-mist)]/80 text-[var(--muted)]"
                      }`}
                    >
                      {isFrame && reward.unlocked ? (
                        <div
                          className={`mb-2 mx-auto h-10 w-10 rounded-full bg-[var(--accent-soft)] ${frameAvatarClass(reward.key)}`}
                          aria-hidden
                        />
                      ) : null}
                      {isSticker && reward.unlocked ? (
                        <div className="mb-2 mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                          <StickerArt stickerKey={reward.key} size={28} title={reward.title} />
                        </div>
                      ) : null}
                      {isCheer && reward.unlocked ? (
                        <div
                          className="mb-2 mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg shadow-sm"
                          aria-hidden
                          title={cheerPhrase(reward.key) ?? undefined}
                        >
                          {lootGlyph(reward.key)}
                        </div>
                      ) : null}
                      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                        {reward.rarityLabel}
                        {reward.metaOnly ? " · мета" : ""}
                      </p>
                      <p className={`text-sm font-semibold ${reward.unlocked ? "" : "opacity-70"}`}>
                        {reward.unlocked ? reward.title : "???"}
                      </p>
                      <p className="mt-0.5 text-xs opacity-80">
                        {reward.unlocked ? reward.description : "Откроется из сундука"}
                      </p>
                      {(isFrame || isSticker || isCheer) && reward.unlocked ? (
                        <div className="mt-2 flex flex-col gap-1">
                          <button
                            type="button"
                            className={`w-full rounded-lg px-2 py-1 text-xs font-semibold ${
                              isEquipped
                                ? "bg-[var(--accent)] text-white"
                                : "bg-white/80 text-[var(--accent-ink)] ring-1 ring-[var(--accent)]/25"
                            }`}
                            onClick={() => toggleEquip(reward.key)}
                          >
                            {isEquipped
                              ? isCheer
                                ? "В репликах"
                                : isSticker
                                  ? "В дневнике"
                                  : "Надета"
                              : isCheer
                                ? "В реплики"
                                : isSticker
                                  ? "В дневник"
                                  : "Надеть"}
                          </button>
                          {isSticker ? (
                            <button
                              type="button"
                              className="w-full rounded-lg px-2 py-1 text-xs font-semibold text-[var(--accent-ink)] ring-1 ring-[var(--accent)]/20"
                              onClick={() => void onShareSticker(reward.key)}
                            >
                              Поделиться
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
