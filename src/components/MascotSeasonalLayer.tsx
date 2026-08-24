import type { MascotSkinId } from "@/lib/mascot-skin";

const INK = "#0F766E";
const INK_DARK = "#115E59";

type MascotSeasonalLayerProps = {
  skin: MascotSkinId;
};

/**
 * Duo-style seasonal / event outfits — bold readable costume, sprout silhouette kept.
 */
export function MascotSeasonalLayer({ skin }: MascotSeasonalLayerProps) {
  switch (skin) {
    case "winter":
      return <WinterOutfit />;
    case "spring":
      return <SpringOutfit />;
    case "summer":
      return <SummerOutfit />;
    case "autumn":
      return <AutumnOutfit />;
    case "newyear":
      return <NewYearOutfit />;
    case "halloween":
      return <HalloweenOutfit />;
    default:
      return null;
  }
}

/** Frost Sprout — moss scarf + icy leaf tips + earmuffs on sprout (no red Santa). */
function WinterOutfit() {
  return (
    <g className="mascot-seasonal mascot-seasonal-winter" aria-hidden>
      {/* Earmuffs on sprout base */}
      <ellipse cx="36" cy="22" rx="6.5" ry="5.5" fill="#5EEAD4" stroke={INK_DARK} strokeWidth="1.2" />
      <ellipse cx="60" cy="22" rx="6.5" ry="5.5" fill="#5EEAD4" stroke={INK_DARK} strokeWidth="1.2" />
      <path
        d="M36 20c4-6 20-6 24 0"
        stroke="#99F6E4"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx="36" cy="22" rx="3.2" ry="2.6" fill="#F0FDFA" opacity="0.55" />
      <ellipse cx="60" cy="22" rx="3.2" ry="2.6" fill="#F0FDFA" opacity="0.55" />

      {/* Frost on leaf tips */}
      <ellipse cx="28" cy="8" rx="4" ry="2.2" fill="#E0F2FE" opacity="0.75" transform="rotate(-35 28 8)" />
      <ellipse cx="68" cy="7" rx="4" ry="2.2" fill="#E0F2FE" opacity="0.7" transform="rotate(32 68 7)" />
      <path d="M26 6l2 3M69 5l-1.5 3" stroke="#F8FAFC" strokeWidth="1.1" strokeLinecap="round" opacity="0.9" />

      {/* Moss / teal scarf — Duo textile read, brand colors */}
      <path
        d="M24 56c8 10 40 10 48 0-2 8-10 14-24 14S26 64 24 56Z"
        fill="#0F766E"
        opacity="0.92"
      />
      <path
        d="M28 57c6 6 34 6 40 0"
        stroke="#5EEAD4"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />
      <path
        d="M66 62c4 2 8 8 6 14-4 2-8 0-10-4 0-4 2-8 4-10Z"
        fill="#134E4A"
      />
      <path d="M68 66c2 3 4 6 3 9" stroke="#99F6E4" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />

      {/* Mittens vibe on raised feel — cuff rings near arms */}
      <ellipse cx="14" cy="62" rx="4" ry="2.4" fill="#5EEAD4" stroke={INK_DARK} strokeWidth="1" opacity="0.85" />
      <ellipse cx="82" cy="62" rx="4" ry="2.4" fill="#5EEAD4" stroke={INK_DARK} strokeWidth="1" opacity="0.85" />

      <g className="mascot-snowflake-a">
        <circle cx="12" cy="18" r="1.4" fill="#E0F2FE" />
        <path d="M12 15v6M9 18h6" stroke="#F8FAFC" strokeWidth="0.8" strokeLinecap="round" />
      </g>
      <g className="mascot-snowflake-b">
        <circle cx="84" cy="30" r="1.2" fill="#E0F2FE" opacity="0.85" />
      </g>
    </g>
  );
}

/** Budding — flower crown on sprout + dew + warm blush energy. */
function SpringOutfit() {
  return (
    <g className="mascot-seasonal mascot-seasonal-spring" aria-hidden>
      {/* Flower crown around sprout */}
      <g className="mascot-spring-crown">
        <circle cx="34" cy="14" r="4.2" fill="#F9A8D4" stroke="#DB2777" strokeWidth="1" />
        <circle cx="34" cy="14" r="1.6" fill="#FDE68A" />
        <circle cx="48" cy="8" r="3.6" fill="#FBCFE8" stroke="#EC4899" strokeWidth="1" />
        <circle cx="48" cy="8" r="1.3" fill="#FEF3C7" />
        <circle cx="62" cy="14" r="4.2" fill="#86EFAC" stroke="#16A34A" strokeWidth="1" />
        <circle cx="62" cy="14" r="1.6" fill="#FDE68A" />
        <path
          d="M34 14c5-8 23-8 28 0"
          stroke="#4ADE80"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.75"
        />
      </g>

      {/* Dew drops on leaves */}
      <ellipse cx="30" cy="12" rx="1.6" ry="2.2" fill="#BAE6FD" opacity="0.85" />
      <circle cx="30.4" cy="11.2" r="0.5" fill="#FFFFFF" opacity="0.9" />

      {/* Tiny bud between leaves */}
      <ellipse cx="48" cy="18" rx="3.2" ry="4" fill="#FB7185" stroke="#BE123C" strokeWidth="1" />
      <path d="M48 14v8" stroke="#FECDD3" strokeWidth="1" opacity="0.7" />

      <g className="mascot-petal-a">
        <ellipse cx="10" cy="34" rx="2.4" ry="1.3" fill="#F9A8D4" opacity="0.8" transform="rotate(22 10 34)" />
      </g>
      <ellipse cx="86" cy="40" rx="2.2" ry="1.2" fill="#86EFAC" opacity="0.65" transform="rotate(-18 86 40)" />
    </g>
  );
}

/** Sun Mint — leaf panama/visor (not black sunglasses) + bright sheen props. */
function SummerOutfit() {
  return (
    <g className="mascot-seasonal mascot-seasonal-summer" aria-hidden>
      {/* Leaf panama — same language as paddle arms */}
      <g className="mascot-summer-hat">
        <ellipse cx="48" cy="16" rx="28" ry="7" fill="#0D9488" stroke={INK_DARK} strokeWidth="1.3" />
        <ellipse cx="48" cy="14" rx="16" ry="6.5" fill="#14B8A6" stroke={INK_DARK} strokeWidth="1.1" />
        <ellipse cx="48" cy="12.5" rx="10" ry="4" fill="#5EEAD4" opacity="0.55" />
        <path
          d="M34 14c5-3 23-3 28 0"
          stroke="#99F6E4"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />
        {/* Chin strap */}
        <path
          d="M32 18c2 14 8 22 16 22s14-8 16-22"
          stroke={INK}
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
          opacity="0.45"
        />
      </g>

      {/* Soft sun */}
      <circle cx="82" cy="12" r="8" fill="#FDE047" opacity="0.32" className="mascot-sun-glow" />
      <circle cx="82" cy="12" r="3.2" fill="#FEF08A" opacity="0.7" />

      {/* Water-drop charm (hydration wink) */}
      <path
        d="M18 48c0-4 4-9 4-9s4 5 4 9a4 4 0 1 1-8 0Z"
        fill="#38BDF8"
        stroke="#0284C7"
        strokeWidth="1"
        opacity="0.9"
      />
      <circle cx="21" cy="49" r="0.8" fill="#FFFFFF" opacity="0.75" />
    </g>
  );
}

/** Harvest — copper leaf + pumpkin prop (requested). */
function AutumnOutfit() {
  return (
    <g className="mascot-seasonal mascot-seasonal-autumn" aria-hidden>
      {/* Copper wash on right leaf tip */}
      <path
        d="M52 8c8-6 18-6 24-2-2 8-10 14-20 16-2-4-4-10-4-14Z"
        fill="#EA580C"
        opacity="0.55"
      />
      <path
        d="M58 10c5-3 12-3 16-0.5"
        stroke="#FDBA74"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />

      {/* Scarf-band in harvest colors */}
      <path
        d="M26 55c10 8 34 8 44 0-1 6-8 11-22 11S27 61 26 55Z"
        fill="#C2410C"
        opacity="0.9"
      />
      <path
        d="M30 56c8 4 28 4 36 0"
        stroke="#FDBA74"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.75"
      />

      {/* Pumpkin at feet */}
      <g transform="translate(72 78)">
        <g className="mascot-pumpkin">
          <ellipse cx="0" cy="4" rx="11" ry="9" fill="#EA580C" stroke="#9A3412" strokeWidth="1.2" />
          <ellipse cx="-4" cy="3" rx="4" ry="7.5" fill="#F97316" opacity="0.85" />
          <ellipse cx="4" cy="3" rx="4" ry="7.5" fill="#C2410C" opacity="0.55" />
          <path d="M0 -4v4" stroke="#166534" strokeWidth="2" strokeLinecap="round" />
          <ellipse cx="1" cy="-5" rx="2.4" ry="1.4" fill="#22C55E" transform="rotate(25 1 -5)" />
          <ellipse cx="-2" cy="1" rx="1.2" ry="0.7" fill="#FDBA74" opacity="0.5" />
        </g>
      </g>

      <g className="mascot-leaf-fall-a">
        <path
          d="M10 24c2-4 6-6 9-4.5 2 1 2.5 4 .5 6.5-2 2.2-5.5 2.2-8 .5-1.2-.9-1.8-2-1.5-2.5Z"
          fill="#EA580C"
        />
      </g>
      <g className="mascot-leaf-fall-b">
        <path
          d="M86 36c1.5-3.5 5-5 7.5-3.5 1.8 1 2 3.2.2 5-1.6 1.6-4.2 1.8-6.2.5-1-.7-1.5-1.5-1.5-2Z"
          fill="#F97316"
        />
      </g>
    </g>
  );
}

/** New Year — gold ribbon on sprout + sparkles (no Santa hat). */
function NewYearOutfit() {
  return (
    <g className="mascot-seasonal mascot-seasonal-newyear" aria-hidden>
      {/* Gold ribbon bow on sprout */}
      <path
        d="M40 16c-6-4-10-2-12 2 4 2 8 3 12 2Z"
        fill="#F59E0B"
        stroke="#B45309"
        strokeWidth="1"
      />
      <path
        d="M56 16c6-4 10-2 12 2-4 2-8 3-12 2Z"
        fill="#F59E0B"
        stroke="#B45309"
        strokeWidth="1"
      />
      <circle cx="48" cy="17" r="3.2" fill="#FDE68A" stroke="#B45309" strokeWidth="1.1" />
      <path d="M48 20v10" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M48 30c-3 4-2 8 0 8s3-4 0-8"
        stroke="#FBBF24"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Thin gold sash */}
      <path
        d="M24 58c12 6 36 6 48 0"
        stroke="#F59E0B"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      <path
        d="M26 58c11 4 33 4 44 0"
        stroke="#FDE68A"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />

      {/* Confetti / stars */}
      <g className="mascot-ny-sparkle-a">
        <path d="M14 22l1.2 2.6 2.6 1.2-2.6 1.2L14 29.6l-1.2-2.6-2.6-1.2 2.6-1.2L14 22Z" fill="#FBBF24" />
      </g>
      <g className="mascot-ny-sparkle-b">
        <path d="M82 18l1 2.2 2.2 1-2.2 1L82 24.4l-1-2.2-2.2-1 2.2-1L82 18Z" fill="#FDE68A" />
      </g>
      <circle cx="20" cy="42" r="1.3" fill="#FCA5A5" />
      <circle cx="78" cy="44" r="1.1" fill="#93C5FD" />
    </g>
  );
}

/** Halloween — playful ghost cape + glow eyes accent (ironic, not horror). */
function HalloweenOutfit() {
  return (
    <g className="mascot-seasonal mascot-seasonal-halloween" aria-hidden>
      {/* Ghost sheet over upper body — face peeks */}
      <path
        d="M22 40c2-18 16-28 26-28s24 10 26 28c0 8-4 14-8 16l-3-6-5 8-5-8-5 8-5-8-3 6c-4-2-8-8-8-16Z"
        fill="#F8FAFC"
        stroke="#CBD5E1"
        strokeWidth="1.3"
        opacity="0.95"
      />
      {/* Sheet eye holes showing teal glow */}
      <ellipse cx="40" cy="48" rx="4.5" ry="5" fill="#0F766E" opacity="0.85" />
      <ellipse cx="56" cy="48" rx="4.5" ry="5" fill="#0F766E" opacity="0.85" />
      <circle cx="41.5" cy="46.5" r="1.3" fill="#5EEAD4" />
      <circle cx="57.5" cy="46.5" r="1.3" fill="#5EEAD4" />

      {/* Tiny bat */}
      <g transform="translate(78 16)">
        <g className="mascot-bat">
          <path d="M0 2c-4-4-8-2-10 2 4 0 6 2 10 2 4 0 6-2 10-2-2-4-6-6-10-2Z" fill="#1E293B" />
          <circle cx="0" cy="2" r="1.6" fill="#334155" />
        </g>
      </g>

      {/* Mini pumpkin badge */}
      <g transform="translate(16 70)">
        <ellipse cx="0" cy="2" rx="6" ry="5" fill="#EA580C" stroke="#9A3412" strokeWidth="0.9" />
        <path d="M0 -2v3" stroke="#166534" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    </g>
  );
}
