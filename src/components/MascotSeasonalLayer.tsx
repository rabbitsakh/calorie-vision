import type { MascotSkinId } from "@/lib/mascot-skin";

const INK = "#0F766E";

type MascotSeasonalLayerProps = {
  skin: MascotSkinId;
};

/** Seasonal accessories drawn on top of the blob (SVG path). */
export function MascotSeasonalLayer({ skin }: MascotSeasonalLayerProps) {
  switch (skin) {
    case "winter":
      return (
        <g className="mascot-seasonal mascot-seasonal-winter" aria-hidden>
          <path
            d="M34 14c6-2 14-2 20 0 4 1.2 7 4 8 7.5l-2.5 1.2c-1-2.8-3.5-4.8-6.5-5.8-5-1.8-11.2-1.6-16 .5-2.5 1-4.5 2.8-5.5 5l-2.5-1.2c1.2-3.8 4.2-6.5 8-7.2Z"
            fill="#DC2626"
          />
          <ellipse cx="48" cy="12" rx="11" ry="4.2" fill="#EF4444" />
          <circle cx="48" cy="6.5" r="3.2" fill="#FEF2F2" />
          <path
            d="M28 58c14 6 36 6 50 0"
            stroke="#B91C1C"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M30 58c12 4 32 4 44 0"
            stroke="#FCA5A5"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            opacity="0.85"
          />
          <g className="mascot-snowflake-a">
            <circle cx="14" cy="18" r="1.2" fill="#E0F2FE" opacity="0.9" />
          </g>
          <g className="mascot-snowflake-b">
            <circle cx="82" cy="28" r="1" fill="#E0F2FE" opacity="0.75" />
          </g>
        </g>
      );
    case "spring":
      return (
        <g className="mascot-seasonal mascot-seasonal-spring" aria-hidden>
          <circle cx="72" cy="22" r="5.5" fill="#FBCFE8" stroke="#EC4899" strokeWidth="1.2" />
          <circle cx="72" cy="22" r="2.2" fill="#FDE68A" />
          <path d="M72 27v5" stroke="#16A34A" strokeWidth="1.6" strokeLinecap="round" />
          <ellipse cx="68" cy="31" rx="3.5" ry="2" fill="#86EFAC" transform="rotate(-25 68 31)" />
          <ellipse cx="76" cy="31" rx="3.5" ry="2" fill="#86EFAC" transform="rotate(25 76 31)" />
          <g className="mascot-petal-a">
            <ellipse cx="10" cy="34" rx="2.2" ry="1.2" fill="#F9A8D4" opacity="0.85" transform="rotate(20 10 34)" />
          </g>
        </g>
      );
    case "summer":
      return (
        <g className="mascot-seasonal mascot-seasonal-summer" aria-hidden>
          <rect x="30" y="48" width="36" height="8" rx="4" fill="#0F172A" opacity="0.88" />
          <rect x="32" y="50" width="14" height="4" rx="2" fill="#38BDF8" opacity="0.55" />
          <rect x="50" y="50" width="14" height="4" rx="2" fill="#38BDF8" opacity="0.55" />
          <path d="M66 48v3.5l4 2.5" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" fill="none" />
          <circle cx="78" cy="16" r="7" fill="#FDE047" opacity="0.35" className="mascot-sun-glow" />
        </g>
      );
    case "autumn":
      return (
        <g className="mascot-seasonal mascot-seasonal-autumn" aria-hidden>
          <g className="mascot-leaf-fall-a">
            <path
              d="M12 26c2-4 6-6 9-4.5 2 1 2.5 4 .5 6.5-2 2.2-5.5 2.2-8 .5-1.2-.9-1.8-2-1.5-2.5Z"
              fill="#EA580C"
            />
            <path d="M16 24v5" stroke="#9A3412" strokeWidth="0.9" strokeLinecap="round" />
          </g>
          <g className="mascot-leaf-fall-b">
            <path
              d="M80 38c1.5-3.5 5-5 7.5-3.5 1.8 1 2 3.2.2 5-1.6 1.6-4.2 1.8-6.2.5-1-.7-1.5-1.5-1.5-2Z"
              fill="#F97316"
            />
          </g>
          <path
            d="M70 18c-1.5 3-4.5 4.5-7 3.5-2-.8-2.8-3-.5-5 1.8-1.5 4.5-1.2 6 1 1 .9 1.5 2 1.5 2.5Z"
            fill="#FB923C"
            stroke={INK}
            strokeWidth="0.8"
          />
        </g>
      );
    default:
      return null;
  }
}
