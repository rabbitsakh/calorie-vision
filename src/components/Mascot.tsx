import { useId, type SVGProps } from "react";

export type MascotPose = "idle" | "cheer" | "streak" | "goal" | "empty" | "tip";

const SIZE_PX = {
  sm: 44,
  md: 72,
  lg: 112,
  xl: 220,
} as const;

const STROKE = "#134E4A";
const LEAF_DARK = "#166534";
const LEAF_MID = "#15803D";
const LIMB = "#86EFAC";
const LIMB_LIGHT = "#A7F3D0";
const BODY = "#FFFFFF";
const BODY_TINT = "#F0FDFA";

/** CSS class per pose — supportive micro-motion (see globals.css). */
export function mascotMotionClass(pose: MascotPose): string {
  switch (pose) {
    case "cheer":
      return "mascot-motion mascot-cheer";
    case "streak":
      return "mascot-motion mascot-streak";
    case "goal":
      return "mascot-motion mascot-goal";
    case "tip":
      return "mascot-motion mascot-tip";
    case "empty":
      return "mascot-motion mascot-empty";
    default:
      return "mascot-motion mascot-idle";
  }
}

type MascotProps = {
  pose?: MascotPose;
  size?: keyof typeof SIZE_PX;
  className?: string;
  title?: string;
  /** Pose-based loop animation. Default true. */
  animate?: boolean;
} & Omit<SVGProps<SVGSVGElement>, "children">;

/**
 * Soft white blob-leaf companion — sprout ears, leaf limbs, chest emblem.
 * Supportive tone only (not guilt nudges). No name in UI.
 */
export function Mascot({
  pose = "idle",
  size = "md",
  className,
  title = "Талисман Calorie Vision",
  animate = true,
  ...rest
}: MascotProps) {
  const uid = useId().replace(/:/g, "");
  const bodyShade = `mascotBodyShade-${uid}`;

  const px = SIZE_PX[size];
  const armsUp = pose === "cheer" || pose === "streak";
  const goalArm = pose === "goal";
  const tipArm = pose === "tip";
  const curious = pose === "empty";
  const proud = pose === "streak" || pose === "goal";
  const motion = animate ? mascotMotionClass(pose) : "";
  const classes = ["mascot-root", motion, className].filter(Boolean).join(" ");

  const leftArm = armsUp
    ? "rotate(-52deg) translate(-6px, -16px)"
    : goalArm
      ? "rotate(-8deg)"
      : tipArm
        ? "rotate(8deg) translate(0, 2px)"
        : curious
          ? "rotate(18deg) translate(2px, 4px)"
          : "rotate(-8deg)";
  const rightArm = armsUp
    ? "rotate(52deg) translate(6px, -16px)"
    : goalArm
      ? "rotate(42deg) translate(4px, -12px)"
      : tipArm
        ? "rotate(-44deg) translate(8px, -18px)"
        : curious
          ? "rotate(-14deg) translate(-2px, 3px)"
          : "rotate(8deg)";

  const bodyShift = curious ? "translate(0 4px)" : undefined;
  const faceShift = curious ? "translate(0 2)" : undefined;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={classes}
      {...rest}
    >
      <title>{title}</title>
      <defs>
        <radialGradient id={bodyShade} cx="50%" cy="40%" r="58%">
          <stop stopColor={BODY} />
          <stop offset="1" stopColor={BODY_TINT} />
        </radialGradient>
      </defs>

      <ellipse className="mascot-shadow" cx="64" cy="118" rx="26" ry="4.5" fill={STROKE} opacity="0.1" />

      <g className="mascot-legs" transform={bodyShift}>
        <path
          d="M52 102c-2 6-1 10 2 12 3 2 6-1 7-5 1-3 0-6-2-8-2-2-5-2-7 1Z"
          fill={LIMB}
          stroke={STROKE}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M76 102c2 6 1 10-2 12-3 2-6-1-7-5-1-3 0-6 2-8 2-2 5-2 7 1Z"
          fill={LIMB}
          stroke={STROKE}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </g>

      <g className="mascot-arm-left" style={{ transformOrigin: "42px 82px", transform: leftArm }}>
        <path
          d="M40 78c-10 2-18 12-16 22 2 6 10 8 16 4 4-3 5-10 2-16-2-4-2-8-2-10Z"
          fill={LIMB_LIGHT}
          stroke={STROKE}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </g>

      <g className="mascot-arm-right" style={{ transformOrigin: "86px 82px", transform: rightArm }}>
        <path
          d="M88 78c10 2 18 12 16 22-2 6-10 8-16 4-4-3-5-10-2-16 2-4 2-8 2-10Z"
          fill={LIMB_LIGHT}
          stroke={STROKE}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </g>

      <g className="mascot-body" transform={bodyShift}>
        <ellipse cx="64" cy="76" rx="30" ry="32" fill={`url(#${bodyShade})`} />
        <ellipse
          cx="64"
          cy="76"
          rx="30"
          ry="32"
          fill="none"
          stroke={STROKE}
          strokeWidth="2.2"
        />

        <g className="mascot-emblem" opacity="0.95">
          <path
            d="M64 82c-4-6-10-8-14-6 2 6 6 10 14 12 8-2 12-6 14-12-4-2-10 0-14 6Z"
            fill={LIMB}
            stroke={STROKE}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path d="M64 84v6" stroke={LEAF_MID} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      </g>

      <g className="mascot-leaves" transform={bodyShift}>
        <g className="mascot-leaf-right">
          <path
            d="M66 48c2-16 14-26 24-28-4 12-10 22-20 30-2 1-5 0-4-2Z"
            fill={LEAF_DARK}
            stroke={STROKE}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </g>
        <g className="mascot-leaf-left">
          <path
            d="M62 48c-4-14-14-24-24-28 6 12 12 22 22 30 2 1 5 0 4-2Z"
            fill={LEAF_MID}
            stroke={STROKE}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </g>
        <path d="M64 46v10" stroke={STROKE} strokeWidth="2.4" strokeLinecap="round" opacity="0.65" />
      </g>

      <g className="mascot-face" transform={faceShift}>
        <path
          className="mascot-brow-left"
          d={
            proud
              ? "M42 58c4-4 10-4 14 0"
              : curious
                ? "M42 60c4-1 10-2 14-1"
                : "M42 59c4-2.5 10-2.5 14 0"
          }
          stroke={STROKE}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        <path
          className="mascot-brow-right"
          d={
            proud
              ? "M72 58c4-4 10-4 14 0"
              : curious
                ? "M72 59c4-2 10-1 14 2"
                : "M72 59c4-2.5 10-2.5 14 0"
          }
          stroke={STROKE}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />

        <circle className="mascot-eye-left" cx="50" cy="68" r="3.4" fill="#0F172A" />
        <circle className="mascot-eye-right" cx="78" cy="68" r="3.4" fill="#0F172A" />

        {pose === "empty" ? (
          <ellipse cx="64" cy="82" rx="3.6" ry="4.2" fill={STROKE} opacity="0.75" />
        ) : armsUp || goalArm || pose === "tip" ? (
          <path
            d="M54 80c4 8 12 8 16 0"
            stroke={STROKE}
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <path
            d="M55 81c3.5 5 10.5 5 14 0"
            stroke={STROKE}
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </g>

      {pose === "streak" ? (
        <g className="mascot-flame" style={{ transformOrigin: "100px 40px" }}>
          <path
            d="M100 26c0 10-7 16-12 16 7-5 5-12 3-16 5 2 9 7 9 0Z"
            fill="#F59E0B"
            stroke="#D97706"
            strokeWidth="1.2"
          />
          <path d="M96 32c0 6-3.5 9-6.5 9 3.5-2.5 2.5-6.5 1.5-9 3 1 5 4 5 0Z" fill="#FDE68A" />
          <circle cx="104" cy="22" r="3" fill="#FDE68A" opacity="0.85" className="mascot-goal-star" />
        </g>
      ) : null}

      {pose === "goal" ? (
        <g className="mascot-goal-star">
          <circle cx="104" cy="38" r="11" fill={LIMB_LIGHT} stroke={STROKE} strokeWidth="1.8" />
          <path
            d="M99 38l3 3 6-7"
            stroke={STROKE}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      ) : null}

      {pose === "tip" ? (
        <g className="mascot-tip-dot">
          <circle cx="108" cy="36" r="12" fill={LIMB_LIGHT} stroke={STROKE} strokeWidth="1.8" />
          <path
            d="M108 30v4M108 42v2"
            stroke={STROKE}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M102 34h12c0 4-2.5 6-6 6s-6-2-6-6Z"
            fill="#FDE68A"
            stroke={STROKE}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </g>
      ) : null}

      {pose === "empty" ? (
        <g className="mascot-empty-bubble" opacity="0.95">
          <rect x="88" y="24" width="26" height="18" rx="6" fill={LIMB_LIGHT} stroke={STROKE} strokeWidth="1.6" />
          <path d="M94 42l-4 6 8-4" fill={LIMB_LIGHT} stroke={STROKE} strokeWidth="1.4" strokeLinejoin="round" />
          <text
            x="101"
            y="37"
            textAnchor="middle"
            fill={STROKE}
            fontSize="12"
            fontWeight="700"
            fontFamily="system-ui, sans-serif"
          >
            ?
          </text>
        </g>
      ) : null}

      {pose === "cheer" ? (
        <g className="mascot-cheer-sparkles" opacity="0.75">
          <circle cx="28" cy="36" r="2" fill={LIMB} />
          <circle cx="34" cy="28" r="1.5" fill={LEAF_MID} />
          <path d="M22 44l4-4M26 40l-4-4" stroke={LEAF_MID} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      ) : null}
    </svg>
  );
}
