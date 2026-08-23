import { useId, type SVGProps } from "react";

export type MascotPose = "idle" | "cheer" | "streak" | "goal" | "empty" | "tip";

const SIZE_PX = {
  sm: 44,
  md: 72,
  lg: 112,
  xl: 220,
} as const;

const INK = "#0F766E";
const INK_DARK = "#134E4A";
const LEAF_DARK = "#0F766E";
const LEAF_LIGHT = "#14B8A6";
const BLUSH = "#FB7185";

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

type ArmTransform = string | undefined;

function armTransforms(pose: MascotPose): { left: ArmTransform; right: ArmTransform } {
  switch (pose) {
    case "cheer":
    case "streak":
    case "goal":
      return {
        left: "rotate(-42deg) translate(-2px, -6px)",
        right: "rotate(42deg) translate(2px, -6px)",
      };
    case "tip":
      return {
        left: "rotate(8deg)",
        right: "rotate(-28deg) translate(4px, -10px)",
      };
    case "empty":
      return {
        left: "rotate(12deg) translate(0, 2px)",
        right: "rotate(-10deg)",
      };
    default:
      return { left: undefined, right: undefined };
  }
}

/**
 * Round teal blob with a sprout on top and stroke limbs — faithful to the v1 concept sheet.
 * No side leaf “whiskers”, no chest emblem, no separate legs.
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
  const arms = armTransforms(pose);
  const proud = pose === "streak" || pose === "goal";
  const curious = pose === "empty";

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={classes}
      {...rest}
    >
      <title>{title}</title>
      <defs>
        <radialGradient id={bodyGrad} cx="48" cy="52" r="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="0.45" stopColor="#CCFBF1" />
          <stop offset="1" stopColor="#99F6E4" />
        </radialGradient>
      </defs>

      <ellipse className="mascot-shadow" cx="48" cy="88" rx="22" ry="4" fill={INK} opacity="0.12" />

      <g
        className="mascot-arm-left"
        style={{ transformOrigin: "30px 58px", transform: arms.left }}
      >
        <path
          d="M28 56c-8 2-14 10-12 16 2 4 8 4 12 1"
          stroke={INK}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      <g
        className="mascot-arm-right"
        style={{ transformOrigin: "66px 58px", transform: arms.right }}
      >
        <path
          d="M68 56c8 2 14 10 12 16-2 4-8 4-12 1"
          stroke={INK}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        {pose === "tip" ? <circle cx="78" cy="40" r="3.5" fill={INK} /> : null}
      </g>

      <g className="mascot-body">
        <ellipse cx="48" cy="58" rx="26" ry="28" fill={`url(#${bodyGrad})`} />
        <ellipse cx="48" cy="58" rx="26" ry="28" fill="#99F6E4" opacity="0.35" />
        <ellipse cx="48" cy="60" rx="20" ry="22" fill="#5EEAD4" opacity="0.22" />
        <ellipse cx="48" cy="66" rx="12" ry="10" fill="#FFFFFF" opacity="0.55" />
        <ellipse
          cx="48"
          cy="58"
          rx="26"
          ry="28"
          fill="none"
          stroke={INK_DARK}
          strokeWidth="1.8"
          opacity="0.35"
        />
      </g>

      <g className="mascot-sprout">
        <path d="M48 30c0-10 8-16 14-18-2 8-6 14-14 18Z" fill={LEAF_DARK} />
        <path d="M48 30c0-9-8-15-14-17 2 8 6 13 14 17Z" fill={LEAF_LIGHT} />
        <path d="M48 32v8" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      </g>

      <g className="mascot-face" transform={curious ? "translate(0 1)" : undefined}>
        <path
          d={
            proud
              ? "M34 48c3-3 7-3 10 0"
              : curious
                ? "M34 50c3-1 7-2 10-1"
                : "M34 49c3-2 7-2 10 0"
          }
          stroke={INK}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />
        <path
          d={
            proud
              ? "M52 48c3-3 7-3 10 0"
              : curious
                ? "M52 49c3-2 7-1 10 1"
                : "M52 49c3-2 7-2 10 0"
          }
          stroke={INK}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />

        {pose === "cheer" ? (
          <>
            <path d="M34 50c3-1 7-1 10 1" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M52 50c3-1 7-1 10 1" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
          </>
        ) : null}

        <circle className="mascot-eye-left" cx="39" cy="54" r="3.2" fill="#0F172A" />
        <circle className="mascot-eye-right" cx="57" cy="54" r="3.2" fill="#0F172A" />
        <circle cx="40.2" cy="53" r="1" fill="#FFFFFF" />
        <circle cx="58.2" cy="53" r="1" fill="#FFFFFF" />

        {curious ? (
          <ellipse cx="48" cy="64" rx="3" ry="3.5" fill={INK_DARK} opacity="0.75" />
        ) : pose === "cheer" || proud || pose === "tip" ? (
          <path
            d="M42 62c3 5 9 5 12 0"
            stroke={INK}
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <path
            d="M43 63c2.5 3 7.5 3 10 0"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
        )}

        <ellipse cx="33" cy="60" rx="3.5" ry="2" fill={BLUSH} opacity="0.32" />
        <ellipse cx="63" cy="60" rx="3.5" ry="2" fill={BLUSH} opacity="0.32" />
      </g>

      {pose === "streak" ? (
        <g className="mascot-flame">
          <path
            d="M72 34c0 6-4 9-7 9 4-3 3-7 2-10 3 1 5 4 5 1Z"
            fill="#F59E0B"
            opacity="0.9"
          />
          <path d="M68 38c0 4-2 6-4.5 6 2.5-2 2-4.5 1-6 2 0.5 3.5 2 3.5 0Z" fill="#FDE68A" />
        </g>
      ) : null}

      {pose === "goal" ? (
        <g className="mascot-goal-star">
          <circle cx="76" cy="30" r="9" fill="#A7F3D0" stroke={INK} strokeWidth="1.6" />
          <path
            d="M72 30l2.5 2.5 5-6"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      ) : null}

      {pose === "empty" ? (
        <g className="mascot-empty-bubble" opacity="0.95">
          <rect x="66" y="18" width="22" height="16" rx="5" fill="#CCFBF1" stroke={INK} strokeWidth="1.4" />
          <path d="M72 34l-3 5 6-3" fill="#CCFBF1" stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
          <text
            x="77"
            y="30"
            textAnchor="middle"
            fill={INK_DARK}
            fontSize="11"
            fontWeight="700"
            fontFamily="system-ui, sans-serif"
          >
            ?
          </text>
        </g>
      ) : null}

      {pose === "cheer" ? (
        <g className="mascot-cheer-sparkles" opacity="0.75">
          <circle cx="20" cy="26" r="1.8" fill={LEAF_LIGHT} />
          <circle cx="26" cy="20" r="1.3" fill="#5EEAD4" />
        </g>
      ) : null}
    </svg>
  );
}
