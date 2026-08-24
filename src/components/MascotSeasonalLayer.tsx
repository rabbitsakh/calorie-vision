import type { MascotSkinId } from "@/lib/mascot-skin";

type MascotSeasonalLayerProps = {
  skin: MascotSkinId;
};

/**
 * Soft seasonal ambience only — no clothes, hats, or sunglasses.
 * Color mood comes from `.mascot-skin-*` filters in globals.css.
 */
export function MascotSeasonalLayer({ skin }: MascotSeasonalLayerProps) {
  switch (skin) {
    case "winter":
      return (
        <g className="mascot-seasonal mascot-seasonal-winter" aria-hidden>
          <g className="mascot-snowflake-a">
            <circle cx="14" cy="20" r="1.3" fill="#E0F2FE" opacity="0.85" />
          </g>
          <g className="mascot-snowflake-b">
            <circle cx="82" cy="28" r="1.1" fill="#E0F2FE" opacity="0.7" />
          </g>
          <circle cx="22" cy="40" r="0.9" fill="#F0F9FF" opacity="0.65" />
          <circle cx="76" cy="16" r="0.8" fill="#F0F9FF" opacity="0.55" />
        </g>
      );
    case "spring":
      return (
        <g className="mascot-seasonal mascot-seasonal-spring" aria-hidden>
          <g className="mascot-petal-a">
            <ellipse
              cx="12"
              cy="32"
              rx="2"
              ry="1.1"
              fill="#F9A8D4"
              opacity="0.7"
              transform="rotate(18 12 32)"
            />
          </g>
          <ellipse
            cx="84"
            cy="36"
            rx="1.8"
            ry="1"
            fill="#86EFAC"
            opacity="0.55"
            transform="rotate(-15 84 36)"
          />
        </g>
      );
    case "summer":
      return (
        <g className="mascot-seasonal mascot-seasonal-summer" aria-hidden>
          <circle cx="78" cy="14" r="6" fill="#FDE047" opacity="0.28" className="mascot-sun-glow" />
          <circle cx="78" cy="14" r="2.4" fill="#FEF08A" opacity="0.45" />
        </g>
      );
    case "autumn":
      return (
        <g className="mascot-seasonal mascot-seasonal-autumn" aria-hidden>
          <g className="mascot-leaf-fall-a">
            <path
              d="M12 26c2-4 6-6 9-4.5 2 1 2.5 4 .5 6.5-2 2.2-5.5 2.2-8 .5-1.2-.9-1.8-2-1.5-2.5Z"
              fill="#EA580C"
              opacity="0.85"
            />
          </g>
          <g className="mascot-leaf-fall-b">
            <path
              d="M80 38c1.5-3.5 5-5 7.5-3.5 1.8 1 2 3.2.2 5-1.6 1.6-4.2 1.8-6.2.5-1-.7-1.5-1.5-1.5-2Z"
              fill="#F97316"
              opacity="0.8"
            />
          </g>
        </g>
      );
    default:
      return null;
  }
}
