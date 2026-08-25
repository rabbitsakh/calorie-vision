import type { MascotSkinId } from "@/lib/mascot-skin";

const INK = "#0F766E";
const INK_DARK = "#115E59";

/** Neck wrap hugging the pear body — shared geometry for scarves / sashes. */
function neckWrapPath() {
  return "M27 57 C27 49 69 49 69 57 C69 65 48 71 27 66 Z";
}

type PartProps = {
  skin: MascotSkinId;
  clipBody?: string;
};

/** Behind body — cape, soft glow. */
export function MascotSeasonalBack({ skin }: PartProps) {
  if (skin === "halloween") {
    return (
      <g className="mascot-seasonal mascot-seasonal-back" aria-hidden>
        <path
          d="M24 46 C18 72 30 92 48 94 C66 92 78 72 72 46 C66 54 30 54 24 46 Z"
          fill="#4C1D95"
          opacity="0.35"
        />
        <path
          d="M26 48 C22 68 34 84 48 86 C62 84 74 68 70 48"
          stroke="#7C3AED"
          strokeWidth="1.2"
          fill="none"
          opacity="0.5"
        />
      </g>
    );
  }
  if (skin === "feb23") {
    return (
      <g className="mascot-seasonal mascot-seasonal-back" aria-hidden>
        <path
          d="M26 48 C22 70 34 88 48 90 C62 88 74 70 70 48 C64 56 32 56 26 48 Z"
          fill="#1E3A8A"
          opacity="0.22"
        />
      </g>
    );
  }
  if (skin === "victory") {
    return (
      <g className="mascot-seasonal mascot-seasonal-back" aria-hidden>
        <path
          d="M28 50 C24 72 36 88 48 90 C60 88 72 72 68 50 C62 58 34 58 28 50 Z"
          fill="#F59E0B"
          opacity="0.12"
        />
      </g>
    );
  }
  return null;
}

/** Far ambience — stays inside aura, never on margins. */
export function MascotSeasonalAmbient({ skin }: PartProps) {
  switch (skin) {
    case "winter":
      return (
        <g className="mascot-seasonal mascot-seasonal-ambient" aria-hidden>
          <g className="mascot-snowflake-a">
            <circle cx="22" cy="34" r="1.1" fill="#E0F2FE" opacity="0.8" />
          </g>
          <g className="mascot-snowflake-b">
            <circle cx="74" cy="38" r="1" fill="#E0F2FE" opacity="0.65" />
          </g>
        </g>
      );
    case "spring":
      return (
        <g className="mascot-seasonal mascot-seasonal-ambient" aria-hidden>
          <g className="mascot-petal-a">
            <ellipse cx="24" cy="32" rx="1.8" ry="1" fill="#F9A8D4" opacity="0.65" transform="rotate(15 24 32)" />
          </g>
        </g>
      );
    case "summer":
      return (
        <g className="mascot-seasonal mascot-seasonal-ambient" aria-hidden>
          <circle cx="68" cy="30" r="5" fill="#FDE047" opacity="0.22" className="mascot-sun-glow" />
        </g>
      );
    case "autumn":
      return (
        <g className="mascot-seasonal mascot-seasonal-ambient" aria-hidden>
          <g className="mascot-leaf-fall-a">
            <path
              d="M22 36c1.5-2.5 4-3.5 6-2.5 1.2 0.8 1.5 2.8 0.2 4-1.2 1.2-3.2 1.2-4.8 0.2Z"
              fill="#EA580C"
              opacity="0.75"
            />
          </g>
        </g>
      );
    case "newyear":
      return (
        <g className="mascot-seasonal mascot-seasonal-ambient" aria-hidden>
          <g className="mascot-ny-sparkle-a">
            <path d="M24 34l0.8 1.8 1.8 0.8-1.8 0.8L24 39.2l-0.8-1.8-1.8-0.8 1.8-0.8L24 34Z" fill="#FBBF24" opacity="0.85" />
          </g>
        </g>
      );
    case "feb23":
      return (
        <g className="mascot-seasonal mascot-seasonal-ambient" aria-hidden>
          <path
            d="M72 32l1.2 2.4 2.6 0.4-1.9 1.8 0.5 2.6L72 38.2l-2.4 1.2 0.5-2.6-1.9-1.8 2.6-0.4L72 32Z"
            fill="#F59E0B"
            opacity="0.9"
          />
          <circle cx="22" cy="36" r="1.2" fill="#93C5FD" opacity="0.7" />
        </g>
      );
    case "march8":
      return (
        <g className="mascot-seasonal mascot-seasonal-ambient" aria-hidden>
          <g className="mascot-petal-a">
            <ellipse cx="22" cy="34" rx="2" ry="1.1" fill="#F9A8D4" opacity="0.75" transform="rotate(-20 22 34)" />
          </g>
          <circle cx="74" cy="36" r="1.4" fill="#FDE68A" opacity="0.85" />
          <circle cx="70" cy="30" r="1.1" fill="#FACC15" opacity="0.75" />
        </g>
      );
    case "valentine":
      return (
        <g className="mascot-seasonal mascot-seasonal-ambient" aria-hidden>
          <g className="mascot-petal-a">
            <path d="M22 34c0-1.4 1.2-2.4 2.2-2.4 0.7 0 1.3 0.4 1.8 1 0.5-0.6 1.1-1 1.8-1 1 0 2.2 1 2.2 2.4 0 2.2-4 4.2-4 4.2s-4-2-4-4.2Z" fill="#FB7185" opacity="0.85" />
          </g>
          <path d="M72 33c0-1 0.9-1.7 1.6-1.7 0.5 0 0.9 0.3 1.3 0.7 0.4-0.4 0.8-0.7 1.3-0.7 0.7 0 1.6 0.7 1.6 1.7 0 1.6-2.9 3-2.9 3S72 34.6 72 33Z" fill="#F43F5E" opacity="0.8" />
        </g>
      );
    case "cosmonaut":
      return (
        <g className="mascot-seasonal mascot-seasonal-ambient" aria-hidden>
          <g className="mascot-ny-sparkle-a">
            <path d="M22 33l0.7 1.5 1.5 0.7-1.5 0.7L22 37.4l-0.7-1.5-1.5-0.7 1.5-0.7L22 33Z" fill="#E0F2FE" opacity="0.9" />
          </g>
          <path d="M74 30l0.6 1.3 1.3 0.6-1.3 0.6L74 33.8l-0.6-1.3-1.3-0.6 1.3-0.6L74 30Z" fill="#93C5FD" opacity="0.85" />
          <circle cx="68" cy="38" r="0.9" fill="#FDE68A" opacity="0.75" />
        </g>
      );
    case "victory":
      return (
        <g className="mascot-seasonal mascot-seasonal-ambient" aria-hidden>
          <path
            d="M72 31l1.1 2.2 2.4 0.3-1.8 1.6 0.4 2.4L72 36.4l-2.1 1.1 0.4-2.4-1.8-1.6 2.4-0.3L72 31Z"
            fill="#FBBF24"
            opacity="0.9"
          />
          <circle cx="23" cy="35" r="1.3" fill="#F97316" opacity="0.7" />
        </g>
      );
    case "knowledge":
      return (
        <g className="mascot-seasonal mascot-seasonal-ambient" aria-hidden>
          <circle cx="22" cy="34" r="1.3" fill="#FDE68A" opacity="0.85" />
          <path d="M72 32l0.7 1.5 1.5 0.7-1.5 0.7L72 36.4l-0.7-1.5-1.5-0.7 1.5-0.7L72 32Z" fill="#F87171" opacity="0.8" />
        </g>
      );
    default:
      return null;
  }
}

/** Frost / warmth wash on belly — clipped to body. */
export function MascotSeasonalBodyWash({ skin, clipBody }: PartProps) {
  if (!clipBody || skin === "default") return null;
  if (skin === "winter") {
    return (
      <g clipPath={`url(#${clipBody})`} className="mascot-seasonal-body-wash" aria-hidden>
        <ellipse cx="48" cy="62" rx="20" ry="16" fill="#E0F2FE" opacity="0.12" />
      </g>
    );
  }
  if (skin === "summer") {
    return (
      <g clipPath={`url(#${clipBody})`} className="mascot-seasonal-body-wash" aria-hidden>
        <ellipse cx="42" cy="48" rx="14" ry="10" fill="#FEF08A" opacity="0.08" />
      </g>
    );
  }
  if (skin === "valentine") {
    return (
      <g clipPath={`url(#${clipBody})`} className="mascot-seasonal-body-wash" aria-hidden>
        <ellipse cx="48" cy="60" rx="16" ry="12" fill="#FDA4AF" opacity="0.1" />
      </g>
    );
  }
  if (skin === "march8") {
    return (
      <g clipPath={`url(#${clipBody})`} className="mascot-seasonal-body-wash" aria-hidden>
        <ellipse cx="48" cy="60" rx="16" ry="12" fill="#F9A8D4" opacity="0.1" />
      </g>
    );
  }
  return null;
}

/** Sprout / head-top — inside mascot-sprout group. */
export function MascotSeasonalSprout({ skin }: PartProps) {
  switch (skin) {
    case "winter":
      return (
        <g className="mascot-seasonal mascot-seasonal-sprout" aria-hidden>
          <path
            d="M34 21 C34 17 62 17 62 21"
            stroke="#99F6E4"
            strokeWidth="2.8"
            strokeLinecap="round"
            fill="none"
          />
          <ellipse cx="34" cy="21" rx="4.5" ry="3.8" fill="#5EEAD4" stroke={INK_DARK} strokeWidth="1" />
          <ellipse cx="62" cy="21" rx="4.5" ry="3.8" fill="#5EEAD4" stroke={INK_DARK} strokeWidth="1" />
          <ellipse cx="28" cy="9" rx="3" ry="1.6" fill="#F0F9FF" opacity="0.7" transform="rotate(-35 28 9)" />
          <ellipse cx="68" cy="8" rx="3" ry="1.6" fill="#F0F9FF" opacity="0.65" transform="rotate(32 68 8)" />
        </g>
      );
    case "spring":
      return (
        <g className="mascot-seasonal mascot-seasonal-sprout" aria-hidden>
          <circle cx="33" cy="12" r="3" fill="#F9A8D4" stroke="#DB2777" strokeWidth="0.9" />
          <circle cx="33" cy="12" r="1.1" fill="#FDE68A" />
          <circle cx="48" cy="7" r="2.6" fill="#FBCFE8" stroke="#EC4899" strokeWidth="0.9" />
          <circle cx="63" cy="12" r="3" fill="#86EFAC" stroke="#16A34A" strokeWidth="0.9" />
          <ellipse cx="48" cy="16" rx="2.4" ry="3" fill="#FB7185" stroke="#BE123C" strokeWidth="0.8" />
        </g>
      );
    case "summer":
      return (
        <g className="mascot-seasonal mascot-seasonal-sprout" aria-hidden>
          <ellipse cx="48" cy="38" rx="13" ry="7" fill="#14B8A6" stroke={INK_DARK} strokeWidth="1" />
          <ellipse cx="48" cy="36" rx="8" ry="4" fill="#5EEAD4" opacity="0.5" />
        </g>
      );
    case "newyear":
      return (
        <g className="mascot-seasonal mascot-seasonal-sprout" aria-hidden>
          <path d="M41 17c-4-3-7-1-8 2 3 1 6 2 9 1Z" fill="#F59E0B" stroke="#B45309" strokeWidth="0.9" />
          <path d="M55 17c4-3 7-1 8 2-3 1-6 2-9 1Z" fill="#F59E0B" stroke="#B45309" strokeWidth="0.9" />
          <circle cx="48" cy="17" r="2.6" fill="#FDE68A" stroke="#B45309" strokeWidth="0.9" />
          <path d="M48 19v6" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case "halloween":
      return (
        <g className="mascot-seasonal mascot-seasonal-sprout" aria-hidden>
          <g className="mascot-bat" transform="translate(66 6)">
            <path d="M0 1.5c-3-3-6-1.5-7.5 1.5 3 0 4.5 1.5 7.5 1.5 3 0 4.5-1.5 7.5-1.5-1.5-3-4.5-4.5-7.5-1.5Z" fill="#1E293B" />
          </g>
        </g>
      );
    case "feb23":
      return (
        <g className="mascot-seasonal mascot-seasonal-sprout" aria-hidden>
          {/* Pilotka */}
          <ellipse cx="48" cy="16" rx="11" ry="4.2" fill="#3F6212" stroke="#1A2E05" strokeWidth="1" />
          <path d="M37 16 C37 12 59 12 59 16" fill="#4D7C0F" stroke="#1A2E05" strokeWidth="0.8" />
          <path d="M48 12.5v3.5" stroke="#FBBF24" strokeWidth="1.4" strokeLinecap="round" />
          <path
            d="M48 10.5l0.9 1.9 2.1 0.3-1.5 1.4 0.4 2L48 14.9l-1.9 1.2 0.4-2-1.5-1.4 2.1-0.3L48 10.5Z"
            fill="#FBBF24"
            stroke="#B45309"
            strokeWidth="0.5"
          />
        </g>
      );
    case "march8":
      return (
        <g className="mascot-seasonal mascot-seasonal-sprout" aria-hidden>
          {/* Mimosa + tulips crown */}
          <circle cx="38" cy="12" r="3.4" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.8" />
          <circle cx="38" cy="12" r="1.2" fill="#FEF08A" />
          <circle cx="48" cy="8" r="3.8" fill="#FACC15" stroke="#CA8A04" strokeWidth="0.8" />
          <circle cx="58" cy="12" r="3.4" fill="#FDE047" stroke="#CA8A04" strokeWidth="0.8" />
          <ellipse cx="43" cy="15" rx="2.2" ry="3.2" fill="#FB7185" stroke="#BE123C" strokeWidth="0.7" />
          <ellipse cx="53" cy="15" rx="2.2" ry="3.2" fill="#F472B6" stroke="#BE185D" strokeWidth="0.7" />
          <circle cx="48" cy="14.5" r="2" fill="#F9A8D4" stroke="#DB2777" strokeWidth="0.6" />
        </g>
      );
    case "valentine":
      return (
        <g className="mascot-seasonal mascot-seasonal-sprout" aria-hidden>
          <path
            d="M48 18c-3.2-3.4-8-1.2-8 2.4 0 4.2 8 7.6 8 7.6s8-3.4 8-7.6c0-3.6-4.8-5.8-8-2.4Z"
            fill="#F43F5E"
            stroke="#BE123C"
            strokeWidth="0.9"
            transform="translate(0 -8) scale(0.55)"
            style={{ transformOrigin: "48px 18px" }}
          />
          <path d="M44 11c-1.5-1.6-3.8-0.6-3.8 1.1 0 2 3.8 3.6 3.8 3.6s3.8-1.6 3.8-3.6c0-1.7-2.3-2.7-3.8-1.1Z" fill="#FB7185" stroke="#E11D48" strokeWidth="0.7" />
        </g>
      );
    case "cosmonaut":
      return (
        <g className="mascot-seasonal mascot-seasonal-sprout" aria-hidden>
          {/* Tiny helmet rim */}
          <ellipse cx="48" cy="18" rx="12" ry="5" fill="none" stroke="#94A3B8" strokeWidth="1.6" opacity="0.9" />
          <ellipse cx="48" cy="14" rx="10" ry="8" fill="#E0F2FE" opacity="0.22" />
          <path
            d="M48 8l0.9 1.9 2.1 0.3-1.5 1.4 0.4 2L48 12.4l-1.9 1.2 0.4-2-1.5-1.4 2.1-0.3L48 8Z"
            fill="#FDE68A"
            stroke="#CA8A04"
            strokeWidth="0.5"
          />
        </g>
      );
    case "victory":
      return (
        <g className="mascot-seasonal mascot-seasonal-sprout" aria-hidden>
          <ellipse cx="42" cy="13" rx="2.4" ry="3.4" fill="#DC2626" stroke="#991B1B" strokeWidth="0.7" />
          <ellipse cx="48" cy="10" rx="2.6" ry="3.6" fill="#EF4444" stroke="#991B1B" strokeWidth="0.7" />
          <ellipse cx="54" cy="13" rx="2.4" ry="3.4" fill="#DC2626" stroke="#991B1B" strokeWidth="0.7" />
          <path d="M48 16v3" stroke="#166534" strokeWidth="1.2" strokeLinecap="round" />
          <path
            d="M48 7l0.8 1.7 1.9 0.3-1.4 1.2 0.3 1.8L48 11l-1.6 1 0.3-1.8-1.4-1.2 1.9-0.3L48 7Z"
            fill="#FBBF24"
            stroke="#B45309"
            strokeWidth="0.5"
          />
        </g>
      );
    case "knowledge":
      return (
        <g className="mascot-seasonal mascot-seasonal-sprout" aria-hidden>
          {/* School bow */}
          <path d="M36 16c-5-4-9-1-9 3 5 1 9 2 13 1Z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="0.8" />
          <path d="M60 16c5-4 9-1 9 3-5 1-9 2-13 1Z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="0.8" />
          <path d="M36 16c-4-3-7 0-6 3 3 0 5 0 8-1Z" fill="#FCA5A5" opacity="0.85" />
          <path d="M60 16c4-3 7 0 6 3-3 0-5 0-8-1Z" fill="#FCA5A5" opacity="0.85" />
          <circle cx="48" cy="17" r="3" fill="#EF4444" stroke="#B91C1C" strokeWidth="0.9" />
          <circle cx="48" cy="17" r="1.2" fill="#FEE2E2" />
        </g>
      );
    default:
      return null;
  }
}

/** Scarf / sash on neck — clipped to body silhouette. */
export function MascotSeasonalNeck({ skin, clipBody }: PartProps) {
  if (!clipBody) return null;
  const wrap = neckWrapPath();

  if (skin === "winter") {
    return (
      <g className="mascot-seasonal mascot-seasonal-neck" aria-hidden>
        <g clipPath={`url(#${clipBody})`}>
          <path d={wrap} fill="#0F766E" opacity="0.92" />
          <path d="M30 58 C48 64 66 58 66 58" stroke="#5EEAD4" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.75" />
        </g>
        <path
          d="M63 60 C67 66 68 74 64 79 C61 73 62 66 63 60 Z"
          fill="#134E4A"
          stroke={INK_DARK}
          strokeWidth="0.8"
        />
      </g>
    );
  }

  if (skin === "autumn") {
    return (
      <g className="mascot-seasonal mascot-seasonal-neck" aria-hidden>
        <g clipPath={`url(#${clipBody})`}>
          <path d={wrap} fill="#C2410C" opacity="0.88" />
          <path d="M30 58 C48 64 66 58" stroke="#FDBA74" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.8" />
        </g>
      </g>
    );
  }

  if (skin === "newyear") {
    return (
      <g className="mascot-seasonal mascot-seasonal-neck" aria-hidden>
        <g clipPath={`url(#${clipBody})`}>
          <path d={wrap} fill="none" stroke="#F59E0B" strokeWidth="3" opacity="0.85" />
          <path d="M30 58 C48 64 66 58" stroke="#FDE68A" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </g>
      </g>
    );
  }

  if (skin === "feb23") {
    return (
      <g className="mascot-seasonal mascot-seasonal-neck" aria-hidden>
        <g clipPath={`url(#${clipBody})`}>
          <path d={wrap} fill="#1E3A8A" opacity="0.92" />
          <path d="M30 58 C48 64 66 58" stroke="#FBBF24" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.95" />
          <path d="M32 60 C48 65 64 60" stroke="#DC2626" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.85" />
        </g>
      </g>
    );
  }

  if (skin === "march8") {
    return (
      <g className="mascot-seasonal mascot-seasonal-neck" aria-hidden>
        <g clipPath={`url(#${clipBody})`}>
          <path d={wrap} fill="#DB2777" opacity="0.88" />
          <path d="M30 58 C48 64 66 58" stroke="#FBCFE8" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.95" />
        </g>
      </g>
    );
  }

  if (skin === "valentine") {
    return (
      <g className="mascot-seasonal mascot-seasonal-neck" aria-hidden>
        <g clipPath={`url(#${clipBody})`}>
          <path d={wrap} fill="#E11D48" opacity="0.88" />
          <path d="M30 58 C48 64 66 58" stroke="#FECDD3" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9" />
        </g>
      </g>
    );
  }

  if (skin === "cosmonaut") {
    return (
      <g className="mascot-seasonal mascot-seasonal-neck" aria-hidden>
        <g clipPath={`url(#${clipBody})`}>
          <path d={wrap} fill="#0369A1" opacity="0.9" />
          <path d="M30 58 C48 64 66 58" stroke="#E0F2FE" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9" />
        </g>
      </g>
    );
  }

  if (skin === "victory") {
    return (
      <g className="mascot-seasonal mascot-seasonal-neck" aria-hidden>
        <g clipPath={`url(#${clipBody})`}>
          {/* St. George ribbon stripes */}
          <path d={wrap} fill="#F59E0B" opacity="0.95" />
          <path d="M29 56 C48 62 67 56" stroke="#1C1917" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.85" />
          <path d="M31 60 C48 66 65 60" stroke="#1C1917" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8" />
        </g>
      </g>
    );
  }

  if (skin === "knowledge") {
    return (
      <g className="mascot-seasonal mascot-seasonal-neck" aria-hidden>
        <g clipPath={`url(#${clipBody})`}>
          <path d={wrap} fill="#1E3A8A" opacity="0.9" />
          <path d="M30 58 C48 64 66 58" stroke="#F8FAFC" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.85" />
        </g>
      </g>
    );
  }

  return null;
}

/** Forehead brim / visor — after face, follows head curve. */
export function MascotSeasonalForehead({ skin }: PartProps) {
  if (skin !== "summer") return null;
  return (
    <g className="mascot-seasonal mascot-seasonal-forehead" aria-hidden>
      <ellipse cx="48" cy="41" rx="24" ry="5.5" fill="#0D9488" stroke={INK_DARK} strokeWidth="1.1" />
      <path
        d="M32 41c4-2 28-2 32 0"
        stroke="#99F6E4"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.75"
      />
      <path
        d="M34 42 C36 52 44 56 48 56 C52 56 60 52 62 42"
        stroke={INK}
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
        opacity="0.35"
      />
    </g>
  );
}

/** Props held at right paddle — drawn after arms. */
export function MascotSeasonalHeld({ skin }: PartProps) {
  if (skin === "autumn") {
    return (
      <g className="mascot-seasonal mascot-seasonal-held" transform="translate(79 57)" aria-hidden>
        <g className="mascot-pumpkin">
          <ellipse cx="0" cy="2" rx="7" ry="6" fill="#EA580C" stroke="#9A3412" strokeWidth="1" />
          <ellipse cx="-2.5" cy="1.5" rx="2.5" ry="5" fill="#F97316" opacity="0.85" />
          <ellipse cx="2.5" cy="1.5" rx="2.5" ry="5" fill="#C2410C" opacity="0.5" />
          <path d="M0 -3v2.5" stroke="#166534" strokeWidth="1.4" strokeLinecap="round" />
          <ellipse cx="0.8" cy="-3.8" rx="1.6" ry="0.9" fill="#22C55E" transform="rotate(20 0.8 -3.8)" />
        </g>
      </g>
    );
  }

  if (skin === "summer") {
    return (
      <g className="mascot-seasonal mascot-seasonal-held" transform="translate(80 58)" aria-hidden>
        <path
          d="M0 0c0-3 2.5-6 2.5-6s2.5 3 2.5 6a2.5 2.5 0 1 1-5 0Z"
          fill="#38BDF8"
          stroke="#0284C7"
          strokeWidth="0.9"
        />
        <circle cx="1.2" cy="-1.5" r="0.6" fill="#FFFFFF" opacity="0.8" />
      </g>
    );
  }

  if (skin === "halloween") {
    return (
      <g className="mascot-seasonal mascot-seasonal-held" transform="translate(17 59)" aria-hidden>
        <ellipse cx="0" cy="1" rx="4.5" ry="3.8" fill="#EA580C" stroke="#9A3412" strokeWidth="0.8" />
        <path d="M0 -2v1.5" stroke="#166534" strokeWidth="1.1" strokeLinecap="round" />
      </g>
    );
  }

  if (skin === "feb23") {
    return (
      <g className="mascot-seasonal mascot-seasonal-held" transform="translate(78 56)" aria-hidden>
        <circle cx="0" cy="2" r="5" fill="#1E3A8A" stroke="#FBBF24" strokeWidth="1.1" />
        <path d="M0 -1.2l0.9 1.9 2.1 0.3-1.5 1.4 0.4 2L0 3.2l-1.9 1.2 0.4-2-1.5-1.4 2.1-0.3L0 -1.2Z" fill="#FBBF24" />
      </g>
    );
  }

  if (skin === "march8") {
    return (
      <g className="mascot-seasonal mascot-seasonal-held" transform="translate(78 55)" aria-hidden>
        <ellipse cx="0" cy="1" rx="2.2" ry="3.4" fill="#FB7185" stroke="#BE123C" strokeWidth="0.7" />
        <ellipse cx="3.2" cy="2" rx="2" ry="3" fill="#F472B6" stroke="#BE185D" strokeWidth="0.7" />
        <circle cx="1.4" cy="-2" r="1.8" fill="#FACC15" stroke="#CA8A04" strokeWidth="0.6" />
        <path d="M1 4v3" stroke="#166534" strokeWidth="1.1" strokeLinecap="round" />
      </g>
    );
  }

  if (skin === "valentine") {
    return (
      <g className="mascot-seasonal mascot-seasonal-held" transform="translate(78 56)" aria-hidden>
        <path d="M0 6c-3.5-3.6-8.5-1.2-8.5 2.6 0 4.6 8.5 8.2 8.5 8.2s8.5-3.6 8.5-8.2c0-3.8-5-6.2-8.5-2.6Z" fill="#F43F5E" stroke="#BE123C" strokeWidth="0.8" transform="translate(0 -8) scale(0.55)" style={{ transformOrigin: "0px 6px" }} />
        <path d="M0 2c-2-2.1-4.8-0.7-4.8 1.5 0 2.6 4.8 4.7 4.8 4.7s4.8-2.1 4.8-4.7c0-2.2-2.8-3.6-4.8-1.5Z" fill="#FB7185" stroke="#E11D48" strokeWidth="0.7" />
      </g>
    );
  }

  if (skin === "cosmonaut") {
    return (
      <g className="mascot-seasonal mascot-seasonal-held" transform="translate(78 55)" aria-hidden>
        <path d="M0 6 L2.5 -4 L5 6 Z" fill="#94A3B8" stroke="#475569" strokeWidth="0.8" />
        <rect x="1.2" y="5.5" width="2.6" height="2.2" rx="0.4" fill="#F97316" />
        <circle cx="2.5" cy="-1" r="1.1" fill="#38BDF8" opacity="0.9" />
      </g>
    );
  }

  if (skin === "victory") {
    return (
      <g className="mascot-seasonal mascot-seasonal-held" transform="translate(78 56)" aria-hidden>
        <circle cx="0" cy="2" r="4.5" fill="#F59E0B" stroke="#B45309" strokeWidth="0.9" />
        <path d="M0 -0.8l0.8 1.6 1.8 0.2-1.3 1.2 0.3 1.8L0 2.8l-1.6 1 0.3-1.8-1.3-1.2 1.8-0.2L0 -0.8Z" fill="#FEF3C7" />
      </g>
    );
  }

  if (skin === "knowledge") {
    return (
      <g className="mascot-seasonal mascot-seasonal-held" transform="translate(76 54)" aria-hidden>
        <rect x="-1" y="0" width="8" height="10" rx="1" fill="#1E3A8A" stroke="#0F172A" strokeWidth="0.8" />
        <rect x="0" y="1" width="6" height="8" rx="0.5" fill="#EFF6FF" />
        <path d="M3 -2.5c0 0 2.5 0.5 2.5 2.5" stroke="#FBBF24" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <circle cx="5.5" cy="0.2" r="1.3" fill="#FBBF24" stroke="#B45309" strokeWidth="0.5" />
      </g>
    );
  }

  return null;
}

/** Autumn copper tint on right leaf — overlay matching leaf bbox. */
export function MascotSeasonalLeafTint({ skin }: PartProps) {
  if (skin !== "autumn") return null;
  return (
    <g className="mascot-seasonal mascot-seasonal-leaf-tint" aria-hidden>
      <path
        d="M48 21C52.8 8.2 63.5 1 74.5 0.8c-1.8 11.5-10.2 19-26.5 21.5Z"
        fill="#EA580C"
        opacity="0.42"
        style={{ mixBlendMode: "multiply" }}
      />
    </g>
  );
}
