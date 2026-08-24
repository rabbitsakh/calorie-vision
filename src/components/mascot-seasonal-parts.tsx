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
  if (skin !== "halloween") return null;
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
          {/* Crown — sits on forehead, behind brim */}
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
