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
        left: "rotate(-46deg) translate(-3px, -8px)",
        right: "rotate(46deg) translate(3px, -8px)",
      };
    case "tip":
      return {
        left: "rotate(10deg)",
        right: "rotate(-32deg) translate(5px, -12px)",
      };
    case "empty":
      return {
        left: "rotate(14deg) translate(0, 2px)",
        right: "rotate(-12deg)",
      };
    default:
      return { left: undefined, right: undefined };
  }
}

/**
 * Soft 3D teal blob with a sprout crown — richer shading/details, still v1 silhouette.
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
  const bodyGrad = `cvBody-${uid}`;
  const bodyShade = `cvShade-${uid}`;
  const sheen = `cvSheen-${uid}`;
  const leafL = `cvLeafL-${uid}`;
  const leafR = `cvLeafR-${uid}`;
  const cheek = `cvCheek-${uid}`;
  const armGrad = `cvArm-${uid}`;
  const glow = `cvGlow-${uid}`;

  const px = SIZE_PX[size];
  const motion = animate ? mascotMotionClass(pose) : "";
  const classes = ["mascot-root", motion, className].filter(Boolean).join(" ");
  const arms = armTransforms(pose);
  const proud = pose === "streak" || pose === "goal";
  const curious = pose === "empty";
  const cheering = pose === "cheer";

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
        <radialGradient id={bodyGrad} cx="38%" cy="32%" r="68%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="28%" stopColor="#F0FDFA" />
          <stop offset="55%" stopColor="#CCFBF1" />
          <stop offset="82%" stopColor="#5EEAD4" />
          <stop offset="100%" stopColor="#2DD4BF" />
        </radialGradient>
        <radialGradient id={bodyShade} cx="50%" cy="78%" r="55%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#0F766E" stopOpacity="0" />
          <stop offset="55%" stopColor="#0F766E" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#134E4A" stopOpacity="0.28" />
        </radialGradient>
        <radialGradient id={sheen} cx="34%" cy="28%" r="42%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={leafL} x1="34" y1="28" x2="48" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5EEAD4" />
          <stop offset="0.45" stopColor="#14B8A6" />
          <stop offset="1" stopColor="#0F766E" />
        </linearGradient>
        <linearGradient id={leafR} x1="62" y1="28" x2="48" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#99F6E4" />
          <stop offset="0.4" stopColor="#2DD4BF" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
        <radialGradient id={cheek} cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor={BLUSH} stopOpacity="0.55" />
          <stop offset="100%" stopColor={BLUSH} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={armGrad} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#99F6E4" />
          <stop offset="1" stopColor="#5EEAD4" />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#5EEAD4" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#5EEAD4" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse className="mascot-shadow" cx="48" cy="89" rx="24" ry="4.5" fill={INK_DARK} opacity="0.16" />
      <ellipse cx="48" cy="58" rx="34" ry="34" fill={`url(#${glow})`} opacity="0.55" />

      {/* Soft filled arms — still stroke-free silhouette, no side leaves */}
      <g
        className="mascot-arm-left"
        style={{ transformOrigin: "28px 58px", transform: arms.left }}
      >
        <path
          d="M30 54c-9 1-16 9-15 17 1 5 7 7 13 3 3-2 5-6 5-10 0-4-1-7-3-10Z"
          fill={`url(#${armGrad})`}
          stroke={INK_DARK}
          strokeWidth="1.4"
          strokeOpacity="0.35"
        />
        <ellipse cx="22" cy="68" rx="5.2" ry="4.6" fill="#CCFBF1" stroke={INK_DARK} strokeWidth="1.2" strokeOpacity="0.3" />
        <ellipse cx="20.5" cy="66.5" rx="1.6" ry="1.2" fill="#FFFFFF" opacity="0.55" />
      </g>

      <g
        className="mascot-arm-right"
        style={{ transformOrigin: "68px 58px", transform: arms.right }}
      >
        <path
          d="M66 54c9 1 16 9 15 17-1 5-7 7-13 3-3-2-5-6-5-10 0-4 1-7 3-10Z"
          fill={`url(#${armGrad})`}
          stroke={INK_DARK}
          strokeWidth="1.4"
          strokeOpacity="0.35"
        />
        <ellipse cx="74" cy="68" rx="5.2" ry="4.6" fill="#CCFBF1" stroke={INK_DARK} strokeWidth="1.2" strokeOpacity="0.3" />
        <ellipse cx="75.5" cy="66.5" rx="1.6" ry="1.2" fill="#FFFFFF" opacity="0.55" />
        {pose === "tip" ? (
          <g>
            <circle cx="78" cy="38" r="4.2" fill="#F0FDFA" stroke={INK} strokeWidth="1.5" />
            <circle cx="78" cy="38" r="1.6" fill={INK} />
          </g>
        ) : null}
      </g>

      <g className="mascot-body">
        <ellipse cx="48" cy="58" rx="27" ry="29" fill={`url(#${bodyGrad})`} />
        <ellipse cx="48" cy="58" rx="27" ry="29" fill={`url(#${bodyShade})`} />
        <ellipse cx="40" cy="48" rx="14" ry="11" fill={`url(#${sheen})`} />
        <ellipse cx="48" cy="72" rx="14" ry="9" fill="#FFFFFF" opacity="0.28" />
        <ellipse
          cx="48"
          cy="58"
          rx="27"
          ry="29"
          fill="none"
          stroke={INK_DARK}
          strokeWidth="1.6"
          opacity="0.28"
        />
        {/* Soft rim light */}
        <path
          d="M24 52c2-14 12-24 24-24"
          stroke="#FFFFFF"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.35"
          fill="none"
        />
      </g>

      {/* Sprout crown — two leaves on a short stem */}
      <g className="mascot-sprout">
        <path d="M48 34c0-4 .2-8 .4-11" stroke={INK} strokeWidth="2.8" strokeLinecap="round" />
        <path
          d="M48.2 24c-1.5-9-9-14.5-15.5-15.5 1.2 8.5 6.2 13.8 15.5 17.2Z"
          fill={`url(#${leafL})`}
        />
        <path
          d="M47.8 24c1.5-9.5 9.2-15 16-16-1 9-6.5 14.2-16 17.5Z"
          fill={`url(#${leafR})`}
        />
        <path
          d="M48.2 24c-4-4-8.5-6.5-12.5-7.2"
          stroke="#99F6E4"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.65"
          fill="none"
        />
        <path
          d="M47.8 24c4-4.2 9-6.8 13.2-7.5"
          stroke="#CCFBF1"
          strokeWidth="1.1"
          strokeLinecap="round"
          opacity="0.7"
          fill="none"
        />
        <ellipse cx="48" cy="33.5" rx="2.4" ry="2" fill="#14B8A6" opacity="0.85" />
      </g>

      <g className="mascot-face" transform={curious ? "translate(0 1)" : undefined}>
        {/* Brows */}
        <path
          d={
            proud
              ? "M33 47c3.5-3.5 8-3.5 11.5 0"
              : curious
                ? "M33 49c3.5-1.2 8-2.2 11.5-1"
                : "M33 48c3.5-2.2 8-2.2 11.5 0"
          }
          stroke={INK}
          strokeWidth="2.1"
          strokeLinecap="round"
          fill="none"
          opacity="0.75"
        />
        <path
          d={
            proud
              ? "M51.5 47c3.5-3.5 8-3.5 11.5 0"
              : curious
                ? "M51.5 48c3.5-2 8-1.2 11.5 1.2"
                : "M51.5 48c3.5-2.2 8-2.2 11.5 0"
          }
          stroke={INK}
          strokeWidth="2.1"
          strokeLinecap="round"
          fill="none"
          opacity="0.75"
        />

        {cheering ? (
          <>
            {/* Happy closed eyes */}
            <path d="M33.5 54c3.2-2.8 8-2.8 11.2 0" stroke="#0F172A" strokeWidth="2.6" strokeLinecap="round" fill="none" />
            <path d="M51.5 54c3.2-2.8 8-2.8 11.2 0" stroke="#0F172A" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            <ellipse className="mascot-eye-left" cx="39" cy="54.5" rx="4" ry="4.4" fill="#0F172A" />
            <ellipse className="mascot-eye-right" cx="57" cy="54.5" rx="4" ry="4.4" fill="#0F172A" />
            <circle cx="40.6" cy="53" r="1.35" fill="#FFFFFF" />
            <circle cx="58.6" cy="53" r="1.35" fill="#FFFFFF" />
            <circle cx="37.8" cy="56.2" r="0.7" fill="#FFFFFF" opacity="0.55" />
            <circle cx="55.8" cy="56.2" r="0.7" fill="#FFFFFF" opacity="0.55" />
          </>
        )}

        {/* Cheeks */}
        <ellipse cx="31" cy="61" rx="5" ry="3.2" fill={`url(#${cheek})`} />
        <ellipse cx="65" cy="61" rx="5" ry="3.2" fill={`url(#${cheek})`} />

        {curious ? (
          <ellipse cx="48" cy="65.5" rx="3.4" ry="4" fill={INK_DARK} opacity="0.8" />
        ) : cheering || proud || pose === "tip" ? (
          <path
            d="M40 63.5c2.8 6.5 13.2 6.5 16 0"
            stroke={INK}
            strokeWidth="2.6"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <path
            d="M42 64c2.4 3.6 9.6 3.6 12 0"
            stroke={INK}
            strokeWidth="2.3"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </g>

      {pose === "streak" ? (
        <g className="mascot-flame">
          <path
            d="M73 30c.5 8-4.5 13-9 13 5.5-4 4.5-9.5 3-14 4 1.5 6.5 5 6 1Z"
            fill="#F59E0B"
          />
          <path
            d="M68.5 35c.2 5.5-2.8 8.5-6 8.5 3.5-2.8 3-6.2 1.8-9 2.8.8 4.5 2.8 4.2.5Z"
            fill="#FDE68A"
          />
          <path d="M67 33c1.5 2 1.2 4.5 0 6" stroke="#FFFBEB" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
        </g>
      ) : null}

      {pose === "goal" ? (
        <g className="mascot-goal-star">
          <circle cx="76" cy="28" r="10" fill={`url(#${glow})`} />
          <circle cx="76" cy="28" r="9" fill="#A7F3D0" stroke={INK} strokeWidth="1.5" />
          <path
            d="M71.5 28.5l3 3 6.5-7"
            stroke={INK}
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      ) : null}

      {pose === "empty" ? (
        <g className="mascot-empty-bubble" opacity="0.98">
          <rect x="66" y="16" width="24" height="17" rx="6" fill="#F0FDFA" stroke={INK} strokeWidth="1.4" />
          <path d="M72 33l-3.5 5.5 7-3.2" fill="#F0FDFA" stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
          <text
            x="78"
            y="29"
            textAnchor="middle"
            fill={INK_DARK}
            fontSize="12"
            fontWeight="700"
            fontFamily="system-ui, sans-serif"
          >
            ?
          </text>
        </g>
      ) : null}

      {cheering ? (
        <g className="mascot-cheer-sparkles">
          <path d="M18 30l1.2 2.8 2.8 1.2-2.8 1.2L18 38l-1.2-2.8L14 34l2.8-1.2L18 30Z" fill="#5EEAD4" opacity="0.9" />
          <path d="M78 22l1 2.2 2.2 1-2.2 1L78 28.4l-1-2.2-2.2-1 2.2-1L78 22Z" fill="#FBBF24" opacity="0.85" />
          <circle cx="24" cy="20" r="1.6" fill="#99F6E4" />
          <circle cx="72" cy="42" r="1.3" fill="#FDE68A" />
        </g>
      ) : null}
    </svg>
  );
}
