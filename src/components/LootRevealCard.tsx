"use client";

import { RewardArt } from "@/components/RewardArt";
import { RARITY_LABELS, type RewardRarity } from "@/lib/rewards";

type LootRevealCardProps = {
  rewardKey: string;
  title: string;
  description?: string;
  rarity?: RewardRarity;
  rarityLabel?: string;
  /** Compact for inbox toast; default is open-ceremony size. */
  size?: "ceremony" | "toast";
  className?: string;
};

/**
 * Chests 2.0 reveal surface — large art + rarity, not emoji toast chrome.
 */
export function LootRevealCard({
  rewardKey,
  title,
  description,
  rarity = "common",
  rarityLabel,
  size = "ceremony",
  className = "",
}: LootRevealCardProps) {
  const art = size === "ceremony" ? 96 : 44;
  const rarityText = rarityLabel ?? RARITY_LABELS[rarity] ?? rarity;

  return (
    <div
      className={`loot-reveal loot-reveal--${rarity} loot-reveal--${size} ${className}`.trim()}
      role="status"
    >
      <div className="loot-reveal-art" aria-hidden>
        <RewardArt rewardKey={rewardKey} size={art} title={title} />
      </div>
      <div className="loot-reveal-copy min-w-0">
        <p className="loot-reveal-rarity">{rarityText}</p>
        <p className="loot-reveal-title">{title}</p>
        {description ? <p className="loot-reveal-desc">{description}</p> : null}
      </div>
    </div>
  );
}
