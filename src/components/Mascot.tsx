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

/** CSS class per pose — lively micro-motion (see globals.css). */
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
      return {
        left: "rotate(-58deg) translate(-4px, -10px)",
        right: "rotate(58deg) translate(4px, -10px)",
      };
    case "streak":
    case "goal":
      return {
        left: "rotate(-42deg) translate(-2px, -7px)",
        right: "rotate(42deg) translate(2px, -7px)",
      };
    case "tip":
      return {
        left: "rotate(12deg) translate(1px, 1px)",
        right: "rotate(-38deg) translate(6px, -14px)",
      };
    case "empty":
      return {
        left: "rotate(16deg) translate(0, 3px)",
        right: "rotate(-14deg) translate(0, 2px)",
      };
    default:
      return { left: undefined, right: undefined };
  }
}

/** Soft organic blob outline — slightly squashy, not a perfect ellipse. */
const BODY_PATH =
  "M48 28c14.5 0 27 10.8 27 26.5 0 9.2-4.2 17-10.8 21.8C58.8 80.8 53.6 83 48 83c-5.6 0-10.8-2.2-16.2-6.7C25.2 71.5 21 63.7 21 54.5 21 38.8 33.5 28 48 28Z";

/**
 * Lively detailed teal blob with sprout crown.
 * Soft 3D volume, expressive face, animated limbs/leaves — still v1 silhouette
 * (no side whiskers, no chest emblem, no separate legs).
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
  const bodyRim = `cvRim-${uid}`;
  const sheen = `cvSheen-${uid}`;
  const belly = `cvBelly-${uid}`;
  const leafL = `cvLeafL-${uid}`;
  const leafR = `cvLeafR-${uid}`;
  const cheek = `cvCheek-${uid}`;
  const armGrad = `cvArm-${uid}`;
  const glow = `cvGlow-${uid}`;
  const iris = `cvIris-${uid}`;
  const mouthFill = `cvMouth-${uid}`;
  const clipBody = `cvClip-${uid}`;

  const px = SIZE_PX[size];
  const motion = animate ? mascotMotionClass(pose) : "";
  const classes = ["mascot-root", motion, className].filter(Boolean).join(" ");
  const arms = armTransforms(pose);
  const proud = pose === "streak" || pose === "goal";
  const curious = pose === "empty";
  const cheering = pose === "cheer";
  const openSmile = cheering || proud;

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
        <radialGradient id={bodyGrad} cx="36%" cy="28%" r="72%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="18%" stopColor="#F0FDFA" />
          <stop offset="42%" stopColor="#CCFBF1" />
          <stop offset="68%" stopColor="#5EEAD4" />
          <stop offset="88%" stopColor="#2DD4BF" />
          <stop offset="100%" stopColor="#14B8A6" />
        </radialGradient>
        <radialGradient id={bodyShade} cx="55%" cy="82%" r="58%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#0F766E" stopOpacity="0" />
          <stop offset="40%" stopColor="#0F766E" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#115E59" stopOpacity="0.38" />
        </radialGradient>
        <linearGradient id={bodyRim} x1="20" y1="30" x2="76" y2="82" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#0F766E" stopOpacity="0.2" />
        </linearGradient>
        <radialGradient id={sheen} cx="32%" cy="24%" r="38%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={belly} cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={leafL} x1="30" y1="30" x2="50" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#99F6E4" />
          <stop offset="0.35" stopColor="#2DD4BF" />
          <stop offset="0.75" stopColor="#0D9488" />
          <stop offset="1" stopColor="#115E59" />
        </linearGradient>
        <linearGradient id={leafR} x1="66" y1="28" x2="46" y2="2" gradientUnits="userSpaceOnUse">
          <stop stopColor="#CCFBF1" />
          <stop offset="0.3" stopColor="#5EEAD4" />
          <stop offset="0.7" stopColor="#14B8A6" />
          <stop offset="1" stopColor="#0F766E" />
        </linearGradient>
        <radialGradient id={cheek} cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor={BLUSH} stopOpacity="0.7" />
          <stop offset="55%" stopColor={BLUSH} stopOpacity="0.28" />
          <stop offset="100%" stopColor={BLUSH} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={armGrad} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#F0FDFA" />
          <stop offset="0.45" stopColor="#99F6E4" />
          <stop offset="1" stopColor="#5EEAD4" />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#5EEAD4" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#2DD4BF" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#14B8A6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={iris} cx="35%" cy="30%" r="70%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="55%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
        <radialGradient id={mouthFill} cx="50%" cy="20%" r="80%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FDA4AF" />
          <stop offset="100%" stopColor="#E11D48" stopOpacity="0.85" />
        </radialGradient>
        <clipPath id={clipBody}>
          <path d={BODY_PATH} />
        </clipPath>
      </defs>

      <ellipse className="mascot-shadow" cx="48" cy="90" rx="26" ry="5" fill={INK_DARK} opacity="0.18" />
      <ellipse className="mascot-aura" cx="48" cy="56" rx="38" ry="38" fill={`url(#${glow})`} />

      <g className="mascot-body">
        <path d={BODY_PATH} fill={`url(#${bodyGrad})`} />
        <path d={BODY_PATH} fill={`url(#${bodyShade})`} />
        <path d={BODY_PATH} fill={`url(#${bodyRim})`} opacity="0.55" />
        <g clipPath={`url(#${clipBody})`}>
          <ellipse cx="38" cy="46" rx="16" ry="12" fill={`url(#${sheen})`} />
          <ellipse cx="48" cy="70" rx="15" ry="10" fill={`url(#${belly})`} />
          {/* Soft subsurface “life” mottling */}
          <ellipse cx="58" cy="52" rx="8" ry="10" fill="#14B8A6" opacity="0.08" />
          <ellipse cx="34" cy="58" rx="7" ry="9" fill="#0D9488" opacity="0.07" />
        </g>
        <path d={BODY_PATH} fill="none" stroke={INK_DARK} strokeWidth="1.55" opacity="0.3" />
        <path
          d="M27 48c3-15 12-22 21-22"
          stroke="#FFFFFF"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.4"
          fill="none"
        />
      </g>

      {/* Sprout — independently swaying leaves */}
      <g className="mascot-sprout">
        <path d="M48 33.5c0-5 .15-9.5.4-13" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="48.2" cy="32.8" rx="2.8" ry="2.3" fill="#14B8A6" />
        <ellipse cx="48.2" cy="32.2" rx="1.2" ry="0.9" fill="#99F6E4" opacity="0.8" />

        <g className="mascot-leaf-left" style={{ transformOrigin: "48px 24px" }}>
          <path
            d="M48 24.5C45.5 14 37.5 7.5 29.5 6.2c1.8 9.8 7.8 15.8 18.5 19.5Z"
            fill={`url(#${leafL})`}
          />
          <path
            d="M48 24.5c-5.2-5-11-8.2-16.2-9.2"
            stroke="#CCFBF1"
            strokeWidth="1.15"
            strokeLinecap="round"
            opacity="0.75"
            fill="none"
          />
          <path
            d="M42 18c-2.5-1.5-5.5-2.5-8.5-2.8"
            stroke="#5EEAD4"
            strokeWidth="0.9"
            strokeLinecap="round"
            opacity="0.55"
            fill="none"
          />
          <ellipse cx="36" cy="14" rx="2.2" ry="1.4" fill="#FFFFFF" opacity="0.28" transform="rotate(-35 36 14)" />
        </g>

        <g className="mascot-leaf-right" style={{ transformOrigin: "48px 24px" }}>
          <path
            d="M48 24.5C50.5 13.2 58.8 6.2 67 5c-1.5 10.2-8 16.5-19 20.2Z"
            fill={`url(#${leafR})`}
          />
          <path
            d="M48 24.5c5.5-5.2 11.8-8.5 17.2-9.5"
            stroke="#F0FDFA"
            strokeWidth="1.15"
            strokeLinecap="round"
            opacity="0.8"
            fill="none"
          />
          <path
            d="M54 17.5c2.8-1.6 6-2.6 9.2-2.8"
            stroke="#99F6E4"
            strokeWidth="0.9"
            strokeLinecap="round"
            opacity="0.55"
            fill="none"
          />
          <ellipse cx="60" cy="12.5" rx="2.4" ry="1.5" fill="#FFFFFF" opacity="0.32" transform="rotate(32 60 12.5)" />
        </g>
      </g>

      <g className="mascot-face" transform={curious ? "translate(0 1.5)" : undefined}>
        <g className="mascot-brows">
          <path
            d={
              proud || cheering
                ? "M32 45.5c4-4.2 9.5-4.2 13.5 0"
                : curious
                  ? "M32 48c4-1.5 9.5-2.5 13.5-1"
                  : "M32 47c4-2.6 9.5-2.6 13.5 0"
            }
            stroke={INK}
            strokeWidth="2.25"
            strokeLinecap="round"
            fill="none"
            opacity="0.82"
          />
          <path
            d={
              proud || cheering
                ? "M50.5 45.5c4-4.2 9.5-4.2 13.5 0"
                : curious
                  ? "M50.5 47c4-2.2 9.5-1.2 13.5 1.5"
                  : "M50.5 47c4-2.6 9.5-2.6 13.5 0"
            }
            stroke={INK}
            strokeWidth="2.25"
            strokeLinecap="round"
            fill="none"
            opacity="0.82"
          />
        </g>

        {cheering ? (
          <g className="mascot-eyes-happy">
            <path d="M32.5 54c3.8-3.6 10-3.6 13.8 0" stroke="#0F172A" strokeWidth="2.9" strokeLinecap="round" fill="none" />
            <path d="M49.8 54c3.8-3.6 10-3.6 13.8 0" stroke="#0F172A" strokeWidth="2.9" strokeLinecap="round" fill="none" />
            <path d="M34 52.5c2.2-1.2 5-1.2 7.2 0" stroke="#FFFFFF" strokeWidth="1.1" strokeLinecap="round" opacity="0.45" fill="none" />
            <path d="M51.5 52.5c2.2-1.2 5-1.2 7.2 0" stroke="#FFFFFF" strokeWidth="1.1" strokeLinecap="round" opacity="0.45" fill="none" />
          </g>
        ) : (
          <g className="mascot-eyes-open">
            <g className="mascot-eye-left">
              <ellipse cx="39" cy="54.8" rx="5.1" ry="5.6" fill={`url(#${iris})`} />
              <ellipse cx="39" cy="54.8" rx="5.1" ry="5.6" fill="none" stroke="#020617" strokeWidth="0.6" opacity="0.35" />
              <circle cx="41.1" cy="52.6" r="1.7" fill="#FFFFFF" />
              <circle cx="37.2" cy="56.6" r="0.85" fill="#FFFFFF" opacity="0.55" />
            </g>
            <g className="mascot-eye-right">
              <ellipse cx="57" cy="54.8" rx="5.1" ry="5.6" fill={`url(#${iris})`} />
              <ellipse cx="57" cy="54.8" rx="5.1" ry="5.6" fill="none" stroke="#020617" strokeWidth="0.6" opacity="0.35" />
              <circle cx="59.1" cy="52.6" r="1.7" fill="#FFFFFF" />
              <circle cx="55.2" cy="56.6" r="0.85" fill="#FFFFFF" opacity="0.55" />
            </g>
          </g>
        )}

        <g className="mascot-cheeks">
          <ellipse cx="29.5" cy="62" rx="6.2" ry="3.8" fill={`url(#${cheek})`} />
          <ellipse cx="66.5" cy="62" rx="6.2" ry="3.8" fill={`url(#${cheek})`} />
        </g>

        {curious ? (
          <ellipse cx="48" cy="67" rx="3.8" ry="4.4" fill={INK_DARK} opacity="0.82" />
        ) : openSmile ? (
          <g className="mascot-mouth">
            <path
              d="M39 63.2c2.5 7.8 15.5 7.8 18 0"
              fill={`url(#${mouthFill})`}
              stroke={INK}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M42.5 64.2c2 3.2 9 3.2 11 0" fill="#FDF2F8" opacity="0.9" />
            <ellipse cx="48" cy="67.8" rx="3.2" ry="2.2" fill="#BE123C" opacity="0.55" />
          </g>
        ) : pose === "tip" ? (
          <path
            d="M41 64.5c2.6 4.5 11.4 4.5 14 0"
            stroke={INK}
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <path
            d="M42 65c2.5 3.4 9.5 3.4 12 0"
            stroke={INK}
            strokeWidth="2.35"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </g>

      {/* Arms in front so cheer waves stay readable */}
      <g
        className="mascot-arm-left"
        style={{
          transformOrigin: "27px 56px",
          ...(pose === "cheer" ? {} : { transform: arms.left }),
        }}
      >
        <path
          d="M31 52c-10 0-18 8.5-17.2 18 .6 6.2 7.2 9 14 4.2 3.5-2.5 5.8-7 5.6-11.5C33.2 57.5 32.4 54 31 52Z"
          fill={`url(#${armGrad})`}
          stroke={INK_DARK}
          strokeWidth="1.35"
          strokeOpacity="0.32"
        />
        <ellipse cx="20.5" cy="68.5" rx="6" ry="5.2" fill="#E6FFFA" stroke={INK_DARK} strokeWidth="1.15" strokeOpacity="0.28" />
        <ellipse cx="18.2" cy="67.2" rx="1.5" ry="2.2" fill="#CCFBF1" opacity="0.9" />
        <ellipse cx="21.2" cy="66.4" rx="1.4" ry="2" fill="#CCFBF1" opacity="0.85" />
        <ellipse cx="24" cy="67.4" rx="1.3" ry="1.8" fill="#CCFBF1" opacity="0.8" />
        <ellipse cx="19" cy="65.2" rx="1.5" ry="1.1" fill="#FFFFFF" opacity="0.55" />
      </g>

      <g
        className="mascot-arm-right"
        style={{
          transformOrigin: "69px 56px",
          ...(pose === "cheer" ? {} : { transform: arms.right }),
        }}
      >
        <path
          d="M65 52c10 0 18 8.5 17.2 18-.6 6.2-7.2 9-14 4.2-3.5-2.5-5.8-7-5.6-11.5C62.8 57.5 63.6 54 65 52Z"
          fill={`url(#${armGrad})`}
          stroke={INK_DARK}
          strokeWidth="1.35"
          strokeOpacity="0.32"
        />
        <ellipse cx="75.5" cy="68.5" rx="6" ry="5.2" fill="#E6FFFA" stroke={INK_DARK} strokeWidth="1.15" strokeOpacity="0.28" />
        <ellipse cx="77.8" cy="67.2" rx="1.5" ry="2.2" fill="#CCFBF1" opacity="0.9" />
        <ellipse cx="74.8" cy="66.4" rx="1.4" ry="2" fill="#CCFBF1" opacity="0.85" />
        <ellipse cx="72" cy="67.4" rx="1.3" ry="1.8" fill="#CCFBF1" opacity="0.8" />
        <ellipse cx="77" cy="65.2" rx="1.5" ry="1.1" fill="#FFFFFF" opacity="0.55" />
        {pose === "tip" ? (
          <g className="mascot-tip-dot">
            <circle cx="79" cy="36" r="5" fill="#F0FDFA" stroke={INK} strokeWidth="1.5" />
            <circle cx="79" cy="36" r="2" fill={INK} />
            <circle cx="80.2" cy="34.8" r="0.9" fill="#FFFFFF" opacity="0.7" />
          </g>
        ) : null}
      </g>

      {pose === "streak" ? (
        <g className="mascot-flame">
          <path
            d="M74 28c.6 9.5-5 15.5-10.5 15.5 6.5-4.5 5.5-11 3.8-16 4.5 1.8 7.2 5.8 6.7.5Z"
            fill="#F59E0B"
          />
          <path
            d="M69 34c.3 6.2-3.2 9.8-7 9.8 4-3.2 3.5-7 2-10.2 3.2.9 5.2 3.2 5 0.4Z"
            fill="#FBBF24"
          />
          <path
            d="M66.5 36.5c.2 4-1.8 6.5-4.2 6.5 2.5-2 2.2-4.5 1.2-6.5 2 .5 3.2 1.8 3 .0Z"
            fill="#FEF3C7"
          />
          <path d="M67.5 32c1.8 2.5 1.5 5.5 0 7.5" stroke="#FFFBEB" strokeWidth="1.3" strokeLinecap="round" opacity="0.75" />
        </g>
      ) : null}

      {pose === "goal" ? (
        <g className="mascot-goal-star">
          <circle cx="76" cy="27" r="11" fill={`url(#${glow})`} />
          <circle cx="76" cy="27" r="9.5" fill="#A7F3D0" stroke={INK} strokeWidth="1.55" />
          <circle cx="76" cy="27" r="9.5" fill="#FFFFFF" opacity="0.18" />
          <path
            d="M71 27.5l3.2 3.2 7-7.5"
            stroke={INK}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      ) : null}

      {pose === "empty" ? (
        <g className="mascot-empty-bubble">
          <rect x="65" y="14" width="26" height="18" rx="7" fill="#F0FDFA" stroke={INK} strokeWidth="1.45" />
          <path d="M72 32l-4 6 8-3.5" fill="#F0FDFA" stroke={INK} strokeWidth="1.35" strokeLinejoin="round" />
          <text
            x="78"
            y="28"
            textAnchor="middle"
            fill={INK_DARK}
            fontSize="12"
            fontWeight="800"
            fontFamily="system-ui, sans-serif"
          >
            ?
          </text>
        </g>
      ) : null}

      {(cheering || proud) && (
        <g className="mascot-cheer-sparkles" aria-hidden>
          <g className="mascot-sparkle mascot-sparkle-a">
            <path d="M16 28l1.4 3.2 3.2 1.4-3.2 1.4L16 37.2l-1.4-3.2L11.4 32.6l3.2-1.4L16 28Z" fill="#5EEAD4" />
          </g>
          <g className="mascot-sparkle mascot-sparkle-b">
            <path d="M80 18l1.2 2.6 2.6 1.2-2.6 1.2L80 25.6l-1.2-2.6-2.6-1.2 2.6-1.2L80 18Z" fill="#FBBF24" />
          </g>
          <g className="mascot-sparkle mascot-sparkle-c">
            <circle cx="22" cy="18" r="1.8" fill="#99F6E4" />
          </g>
          <g className="mascot-sparkle mascot-sparkle-d">
            <circle cx="74" cy="44" r="1.5" fill="#FDE68A" />
          </g>
          <g className="mascot-sparkle mascot-sparkle-e">
            <path d="M12 44l.9 2 2 .9-2 .9L12 50.7l-.9-2-2-.9 2-.9L12 44Z" fill="#F0FDFA" opacity="0.9" />
          </g>
        </g>
      )}
    </svg>
  );
}
