import { useId, type SVGProps } from "react";

export type MascotPose = "idle" | "cheer" | "streak" | "goal" | "empty" | "tip";

const SIZE_PX = {
  sm: 44,
  md: 72,
  lg: 112,
  xl: 220,
} as const;

const INK = "#134E4A";
const LEAF_DARK = "#166534";
const LEAF_LIGHT = "#15803D";
const LIMB = "#86EFAC";
const LIMB_SOFT = "#A7F3D0";
const BODY = "#FFFFFF";
const BLUSH = "#FDA4AF";

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
  animate?: boolean;
} & Omit<SVGProps<SVGSVGElement>, "children">;

/**
 * White pear-blob companion with leaf ears and mint limbs — 6 poses from the concept sheet.
 * Supportive tone only. No name in UI.
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
  const bodyGrad = `mascotBody-${uid}`;

  const px = SIZE_PX[size];
  const motion = animate ? mascotMotionClass(pose) : "";
  const classes = ["mascot-root", motion, className].filter(Boolean).join(" ");

  const cheer = pose === "cheer";
  const streak = pose === "streak";
  const goal = pose === "goal";
  const tip = pose === "tip";
  const empty = pose === "empty";
  const armsUp = cheer || streak;

  const rootTransform = empty ? "translate(0 10) scale(0.96)" : undefined;

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
        <radialGradient id={bodyGrad} cx="50%" cy="38%" r="62%">
          <stop stopColor={BODY} />
          <stop offset="1" stopColor="#F0FDFA" />
        </radialGradient>
      </defs>

      <g transform={rootTransform}>
        <ellipse className="mascot-shadow" cx="64" cy="118" rx="24" ry="4" fill={INK} opacity="0.1" />

        {/* Legs */}
        <g className="mascot-legs">
          <ellipse cx="54" cy="108" rx="7" ry="5" fill={LIMB} stroke={INK} strokeWidth="1.5" />
          <ellipse cx="74" cy="108" rx="7" ry="5" fill={LIMB} stroke={INK} strokeWidth="1.5" />
        </g>

        {/* Left arm */}
        <g
          className="mascot-arm-left"
          style={{
            transformOrigin: "44px 84px",
            transform: armsUp
              ? "rotate(-48deg) translate(-4px, -14px)"
              : goal
                ? "rotate(-6deg)"
                : tip
                  ? "rotate(10deg) translate(0, 2px)"
                  : empty
                    ? "rotate(24deg) translate(4px, 6px)"
                    : "rotate(-10deg)",
          }}
        >
          <ellipse cx="36" cy="84" rx="9" ry="12" fill={LIMB_SOFT} stroke={INK} strokeWidth="1.6" />
        </g>

        {/* Right arm */}
        <g
          className="mascot-arm-right"
          style={{
            transformOrigin: "84px 84px",
            transform: armsUp
              ? "rotate(48deg) translate(4px, -14px)"
              : goal
                ? "rotate(38deg) translate(2px, -10px)"
                : tip
                  ? "rotate(-42deg) translate(6px, -16px)"
                  : empty
                    ? "rotate(-8deg) translate(-2px, 2px)"
                    : "rotate(10deg)",
          }}
        >
          <ellipse cx="92" cy="84" rx="9" ry="12" fill={LIMB_SOFT} stroke={INK} strokeWidth="1.6" />
          {goal ? (
            <circle cx="100" cy="68" r="5.5" fill={LIMB_SOFT} stroke={INK} strokeWidth="1.4" />
          ) : null}
          {tip ? (
            <circle cx="104" cy="58" r="4" fill={LIMB_SOFT} stroke={INK} strokeWidth="1.3" />
          ) : null}
        </g>

        {/* Body */}
        <g className="mascot-body">
          <path
            d="M64 44c-22 2-30 18-30 36 0 16 10 28 30 30 20-2 30-14 30-30 0-18-8-34-30-36Z"
            fill={`url(#${bodyGrad})`}
            stroke={INK}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <g className="mascot-emblem" opacity="0.95">
            <path
              d="M56 78c-2-4-6-6-10-5 1 4 4 7 10 8 6-1 9-4 10-8-4-1-8 1-10 5Z"
              fill={LIMB}
              stroke={INK}
              strokeWidth="1.1"
            />
            <path
              d="M72 78c2-4 6-6 10-5-1 4-4 7-10 8-6-1-9-4-10-8 4-1 8 1 10 5Z"
              fill={LIMB_SOFT}
              stroke={INK}
              strokeWidth="1.1"
            />
          </g>
        </g>

        {/* Head leaves */}
        <g className="mascot-leaves">
          <g className="mascot-leaf-left">
            <path
              d="M58 46c-6-14-18-22-28-24 4 10 10 18 20 24 2 1 6 0 8-0Z"
              fill={LEAF_LIGHT}
              stroke={INK}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </g>
          <g className="mascot-leaf-right">
            <path
              d="M70 46c6-14 18-22 28-24-4 10-10 18-20 24-2 1-6 0-8-0Z"
              fill={LEAF_DARK}
              stroke={INK}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </g>
        </g>

        {/* Face */}
        <g className="mascot-face">
          {cheer ? (
            <>
              <path d="M46 66c2-3 6-3 8 0" stroke={INK} strokeWidth="2.2" strokeLinecap="round" fill="none" />
              <path d="M74 66c2-3 6-3 8 0" stroke={INK} strokeWidth="2.2" strokeLinecap="round" fill="none" />
            </>
          ) : empty ? (
            <>
              <circle className="mascot-eye-left" cx="50" cy="68" r="3" fill={INK} />
              <circle className="mascot-eye-right" cx="78" cy="68" r="3" fill={INK} />
            </>
          ) : (
            <>
              <circle className="mascot-eye-left" cx="50" cy="68" r="3.2" fill={INK} />
              <circle className="mascot-eye-right" cx="78" cy="68" r="3.2" fill={INK} />
            </>
          )}

          <ellipse cx="40" cy="76" rx="6" ry="3.2" fill={BLUSH} opacity="0.45" />
          <ellipse cx="88" cy="76" rx="6" ry="3.2" fill={BLUSH} opacity="0.45" />

          {empty ? (
            <path d="M58 82c2 2 10 2 12 0" stroke={INK} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          ) : cheer ? (
            <path
              d="M54 80c4 10 12 10 16 0"
              stroke={INK}
              strokeWidth="2.6"
              strokeLinecap="round"
              fill="none"
            />
          ) : tip ? (
            <ellipse cx="64" cy="82" rx="3.5" ry="4" fill={INK} opacity="0.8" />
          ) : (
            <path d="M55 81c3.5 5 10.5 5 14 0" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          )}
        </g>

        {streak ? (
          <g className="mascot-flame" style={{ transformOrigin: "98px 42px" }}>
            <path
              d="M98 28c0 10-6 16-11 16 6-4 4-11 2-15 4 2 9 6 9-1Z"
              fill="#F59E0B"
              stroke="#D97706"
              strokeWidth="1.2"
            />
            <path d="M94 34c0 5-2.5 8-5 8 2.5-2 2-5.5 1-7.5 2.5 1 4 3.5 4 0Z" fill="#FDE68A" />
            <text
              x="96"
              y="40"
              textAnchor="middle"
              fill={INK}
              fontSize="9"
              fontWeight="800"
              fontFamily="system-ui, sans-serif"
            >
              7
            </text>
            <circle cx="108" cy="24" r="2.5" fill="#FDE68A" className="mascot-goal-star" />
          </g>
        ) : null}

        {goal ? (
          <g className="mascot-goal-star">
            <circle cx="104" cy="36" r="11" fill={LIMB_SOFT} stroke={INK} strokeWidth="1.8" />
            <path
              d="M99 36l3 3 6-7"
              stroke={INK}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </g>
        ) : null}

        {tip ? (
          <g className="mascot-tip-dot">
            <circle cx="108" cy="34" r="12" fill={LIMB_SOFT} stroke={INK} strokeWidth="1.8" />
            <path
              d="M108 28v4M108 40v2"
              stroke={INK}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M102 32h12c0 4-2.5 6-6 6s-6-2-6-6Z"
              fill="#FDE68A"
              stroke={INK}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </g>
        ) : null}

        {empty ? (
          <g className="mascot-empty-bubble" opacity="0.95">
            <rect x="88" y="22" width="26" height="18" rx="6" fill={LIMB_SOFT} stroke={INK} strokeWidth="1.6" />
            <path d="M94 40l-4 6 8-4" fill={LIMB_SOFT} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
            <text
              x="101"
              y="35"
              textAnchor="middle"
              fill={INK}
              fontSize="12"
              fontWeight="700"
              fontFamily="system-ui, sans-serif"
            >
              ?
            </text>
          </g>
        ) : null}

        {cheer ? (
          <g className="mascot-cheer-sparkles" opacity="0.8">
            <circle cx="28" cy="34" r="2" fill={LIMB} />
            <circle cx="34" cy="26" r="1.5" fill={LEAF_LIGHT} />
            <path d="M22 42l4-4M26 38l-4-4" stroke={LEAF_LIGHT} strokeWidth="1.6" strokeLinecap="round" />
          </g>
        ) : null}
      </g>
    </svg>
  );
}
