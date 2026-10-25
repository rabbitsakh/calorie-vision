import { StickerArt, isStickerArtKey } from "@/components/StickerArt";
import { rewardDef, stickerGlyph, type RewardGroup } from "@/lib/rewards";

type RewardArtProps = {
  rewardKey: string | null | undefined;
  /** Render size in px. */
  size?: number;
  className?: string;
  title?: string;
};

/**
 * Unified loot art for stickers / frames / cheers — SVG first, emoji only in sr-only.
 */
export function RewardArt({
  rewardKey,
  size = 40,
  className = "",
  title,
}: RewardArtProps) {
  if (!rewardKey) return null;
  const def = rewardDef(rewardKey);
  const label = title ?? def?.title ?? "Награда";
  const group: RewardGroup = def?.group ?? "sticker";

  if (group === "sticker" && isStickerArtKey(rewardKey)) {
    return (
      <StickerArt
        stickerKey={rewardKey}
        size={size}
        className={className}
        title={label}
      />
    );
  }

  if (group === "frame") {
    return (
      <span
        className={`reward-art reward-art--frame inline-flex items-center justify-center ${className}`.trim()}
        style={{ width: size, height: size }}
        role="img"
        aria-label={label}
        title={label}
      >
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
          {renderFrameBody(rewardKey)}
        </svg>
      </span>
    );
  }

  if (group === "cheer") {
    return (
      <span
        className={`reward-art reward-art--cheer inline-flex items-center justify-center ${className}`.trim()}
        style={{ width: size, height: size }}
        role="img"
        aria-label={label}
        title={label}
      >
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
          {renderCheerBody(rewardKey)}
        </svg>
      </span>
    );
  }

  // Fallback — still avoid bare emoji as primary chrome
  return (
    <span
      className={`reward-art reward-art--fallback inline-flex items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-ink)] ${className}`.trim()}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      role="img"
      aria-label={label}
      title={label}
    >
      <span aria-hidden>✦</span>
      <span className="sr-only">{stickerGlyph(rewardKey) || label}</span>
    </span>
  );
}

function renderFrameBody(key: string) {
  const tones: Record<string, { ring: string; wash: string; bead: string }> = {
    frame_teal: { ring: "#0d7377", wash: "#99f6e4", bead: "#134e4a" },
    frame_amber: { ring: "#d97706", wash: "#fde68a", bead: "#92400e" },
    frame_mint: { ring: "#059669", wash: "#a7f3d0", bead: "#065f46" },
    frame_sky: { ring: "#0284c7", wash: "#bae6fd", bead: "#075985" },
    frame_fest: { ring: "#c2410c", wash: "#fed7aa", bead: "#9a3412" },
  };
  const t = tones[key] ?? tones.frame_teal!;
  return (
    <>
      <circle cx="20" cy="20" r="16" fill={t.wash} opacity="0.55" />
      <circle
        cx="20"
        cy="20"
        r="14.5"
        stroke={t.ring}
        strokeWidth="3.2"
        fill="none"
      />
      <circle cx="20" cy="20" r="10" stroke={t.bead} strokeWidth="1.2" fill="none" opacity="0.45" />
      <circle cx="20" cy="6.5" r="2.2" fill={t.ring} />
      <circle cx="20" cy="33.5" r="2.2" fill={t.ring} />
      <circle cx="6.5" cy="20" r="2.2" fill={t.ring} />
      <circle cx="33.5" cy="20" r="2.2" fill={t.ring} />
    </>
  );
}

function renderCheerBody(key: string) {
  // Soft speech bubble + accent mark — shared language, tint by key
  const accent =
    key === "cheer_festive" || key === "cheer_collector"
      ? "#d97706"
      : key === "cheer_streak" || key === "cheer_week"
        ? "#0d7377"
        : "#14919b";
  return (
    <>
      <rect x="5" y="7" width="30" height="20" rx="10" fill="#ecfdf8" stroke={accent} strokeWidth="1.8" />
      <path d="M14 27 L11 34 L20 27 Z" fill="#ecfdf8" stroke={accent} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="15" cy="17" r="1.6" fill={accent} />
      <circle cx="20" cy="17" r="1.6" fill={accent} />
      <circle cx="25" cy="17" r="1.6" fill={accent} />
    </>
  );
}
