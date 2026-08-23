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

/**
 * Pear / teardrop blob — taller, squashier silhouette (reads as character, not a circle).
 * Still v1 identity: sprout crown, no side whiskers, no chest emblem, no separate legs.
 */
const BODY_PATH =
  "M48 22c16.2 0 30 12.2 30 30.5 0 11.8-5.4 21.2-13.6 26.8C57.6 84.2 52.4 87 48 87c-4.4 0-9.6-2.8-16.4-7.7C23.4 73.7 18 64.3 18 52.5 18 34.2 31.8 22 48 22Z";

/**
 * Lively detailed teal blob with sprout crown.
 * Nested SVG pivot groups keep cheer arm waves on reliable joints.
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
  const speck = `cvSpeck-${uid}`;

  const px = SIZE_PX[size];
  const motion = animate ? mascotMotionClass(pose) : "";
  const classes = ["mascot-root", motion, className].filter(Boolean).join(" ");
  const proud = pose === "streak" || pose === "goal";
  const curious = pose === "empty";
  const cheering = pose === "cheer";
  const openSmile = cheering || proud;
  const armPoseClass =
    pose === "cheer"
      ? "mascot-arm-pose-cheer"
      : pose === "tip"
        ? "mascot-arm-pose-tip"
        : proud
          ? "mascot-arm-pose-proud"
          : pose === "empty"
            ? "mascot-arm-pose-empty"
            : "mascot-arm-pose-idle";

  return (
    <svg
      width={px}
      height={px}
      viewBox="-10 -14 116 118"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={classes}
      {...rest}
    >
      <title>{title}</title>
      <defs>
        <radialGradient id={bodyGrad} cx="34%" cy="26%" r="74%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="14%" stopColor="#F0FDFA" />
          <stop offset="36%" stopColor="#CCFBF1" />
          <stop offset="58%" stopColor="#5EEAD4" />
          <stop offset="82%" stopColor="#2DD4BF" />
          <stop offset="100%" stopColor="#0D9488" />
        </radialGradient>
        <radialGradient id={bodyShade} cx="58%" cy="88%" r="62%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#0F766E" stopOpacity="0" />
          <stop offset="35%" stopColor="#0F766E" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#115E59" stopOpacity="0.46" />
        </radialGradient>
        <linearGradient id={bodyRim} x1="18" y1="26" x2="78" y2="86" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.62" />
          <stop offset="0.42" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="1" stopColor="#0F766E" stopOpacity="0.28" />
        </linearGradient>
        <radialGradient id={sheen} cx="30%" cy="22%" r="42%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.98" />
          <stop offset="38%" stopColor="#FFFFFF" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={belly} cx="50%" cy="45%" r="55%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.62" />
          <stop offset="55%" stopColor="#E6FFFA" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={leafL} x1="28" y1="34" x2="52" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#99F6E4" />
          <stop offset="0.28" stopColor="#2DD4BF" />
          <stop offset="0.68" stopColor="#0D9488" />
          <stop offset="1" stopColor="#115E59" />
        </linearGradient>
        <linearGradient id={leafR} x1="68" y1="32" x2="44" y2="-2" gradientUnits="userSpaceOnUse">
          <stop stopColor="#CCFBF1" />
          <stop offset="0.25" stopColor="#5EEAD4" />
          <stop offset="0.65" stopColor="#14B8A6" />
          <stop offset="1" stopColor="#0F766E" />
        </linearGradient>
        <radialGradient id={cheek} cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor={BLUSH} stopOpacity="0.78" />
          <stop offset="52%" stopColor={BLUSH} stopOpacity="0.32" />
          <stop offset="100%" stopColor={BLUSH} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={armGrad} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#F0FDFA" />
          <stop offset="0.4" stopColor="#99F6E4" />
          <stop offset="1" stopColor="#5EEAD4" />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#5EEAD4" stopOpacity="0.6" />
          <stop offset="55%" stopColor="#2DD4BF" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#14B8A6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={iris} cx="34%" cy="28%" r="72%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="45%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
        <radialGradient id={mouthFill} cx="50%" cy="18%" r="85%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FDA4AF" />
          <stop offset="100%" stopColor="#E11D48" stopOpacity="0.88" />
        </radialGradient>
        <filter id={speck} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
        <clipPath id={clipBody}>
          <path d={BODY_PATH} />
        </clipPath>
      </defs>

      <ellipse className="mascot-shadow" cx="48" cy="91.5" rx="24" ry="4.2" fill={INK_DARK} opacity="0.2" />
      <ellipse className="mascot-aura" cx="48" cy="56" rx="40" ry="40" fill={`url(#${glow})`} />

      {/* Body */}
      <g className="mascot-body">
        <path d={BODY_PATH} fill={`url(#${bodyGrad})`} />
        <path d={BODY_PATH} fill={`url(#${bodyShade})`} />
        <path d={BODY_PATH} fill={`url(#${bodyRim})`} opacity="0.6" />
        <g clipPath={`url(#${clipBody})`}>
          <ellipse cx="36" cy="44" rx="18" ry="14" fill={`url(#${sheen})`} />
          <ellipse cx="48" cy="72" rx="17" ry="12" fill={`url(#${belly})`} />
          <ellipse cx="60" cy="54" rx="9" ry="12" fill="#14B8A6" opacity="0.1" />
          <ellipse cx="32" cy="60" rx="8" ry="11" fill="#0D9488" opacity="0.09" />
          <ellipse cx="42" cy="50" rx="2.2" ry="1.4" fill="#FFFFFF" opacity="0.35" filter={`url(#${speck})`} />
          <ellipse cx="55" cy="58" rx="1.6" ry="1.1" fill="#FFFFFF" opacity="0.22" filter={`url(#${speck})`} />
          <ellipse cx="38" cy="66" rx="1.4" ry="1" fill="#FFFFFF" opacity="0.18" filter={`url(#${speck})`} />
        </g>
        <path d={BODY_PATH} fill="none" stroke={INK_DARK} strokeWidth="1.6" opacity="0.32" />
        <path
          d="M25 46c4-16 13.5-24 23-24"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity="0.42"
          fill="none"
        />
        <path
          d="M68 40c-2.5-8-8-14-14-17"
          stroke="#FFFFFF"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.22"
          fill="none"
        />
      </g>

      {/* Sprout — large veined leaves, independent sway */}
      <g className="mascot-sprout">
        <path d="M48 30c0-6 .2-11.5.55-16" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
        <ellipse cx="48.25" cy="29.2" rx="3.4" ry="2.8" fill="#0D9488" />
        <ellipse cx="48.25" cy="28.4" rx="1.5" ry="1.1" fill="#99F6E4" opacity="0.85" />

        <g className="mascot-leaf-left">
          <g transform="translate(48 22)">
            <g className="mascot-leaf-left-spin">
              <g transform="translate(-48 -22)">
                <path
                  d="M48 23C44.2 10.5 33.5 2.2 22.5 1.2c2.4 12.5 10.2 19.8 25.5 23.2Z"
                  fill={`url(#${leafL})`}
                />
                <path
                  d="M48 23C44.2 10.5 33.5 2.2 22.5 1.2c2.4 12.5 10.2 19.8 25.5 23.2Z"
                  fill="none"
                  stroke={INK_DARK}
                  strokeWidth="1.1"
                  opacity="0.28"
                />
                <path
                  d="M48 23c-6.5-6.2-14-10.2-20.5-11.5"
                  stroke="#CCFBF1"
                  strokeWidth="1.35"
                  strokeLinecap="round"
                  opacity="0.85"
                  fill="none"
                />
                <path
                  d="M40 15.5c-3.2-2-7-3.4-10.8-3.8"
                  stroke="#5EEAD4"
                  strokeWidth="1"
                  strokeLinecap="round"
                  opacity="0.65"
                  fill="none"
                />
                <path
                  d="M43 19c-2.8-1.4-5.8-2.2-8.8-2.4"
                  stroke="#2DD4BF"
                  strokeWidth="0.75"
                  strokeLinecap="round"
                  opacity="0.45"
                  fill="none"
                />
                <ellipse
                  cx="32"
                  cy="11"
                  rx="3"
                  ry="1.8"
                  fill="#FFFFFF"
                  opacity="0.32"
                  transform="rotate(-38 32 11)"
                />
              </g>
            </g>
          </g>
        </g>

        <g className="mascot-leaf-right">
          <g transform="translate(48 22)">
            <g className="mascot-leaf-right-spin">
              <g transform="translate(-48 -22)">
                <path
                  d="M48 23C52 9.8 62.5 1.5 74.2 0.8c-2 12.8-10.5 20.5-26.2 23.5Z"
                  fill={`url(#${leafR})`}
                />
                <path
                  d="M48 23C52 9.8 62.5 1.5 74.2 0.8c-2 12.8-10.5 20.5-26.2 23.5Z"
                  fill="none"
                  stroke={INK_DARK}
                  strokeWidth="1.1"
                  opacity="0.25"
                />
                <path
                  d="M48 23c7-6.5 15-10.8 22-12"
                  stroke="#F0FDFA"
                  strokeWidth="1.35"
                  strokeLinecap="round"
                  opacity="0.88"
                  fill="none"
                />
                <path
                  d="M55.5 15c3.5-2.2 7.6-3.5 11.8-3.8"
                  stroke="#99F6E4"
                  strokeWidth="1"
                  strokeLinecap="round"
                  opacity="0.65"
                  fill="none"
                />
                <path
                  d="M53 18.5c2.8-1.5 6-2.4 9.2-2.6"
                  stroke="#5EEAD4"
                  strokeWidth="0.75"
                  strokeLinecap="round"
                  opacity="0.45"
                  fill="none"
                />
                <ellipse
                  cx="64"
                  cy="10"
                  rx="3.2"
                  ry="1.9"
                  fill="#FFFFFF"
                  opacity="0.36"
                  transform="rotate(34 64 10)"
                />
              </g>
            </g>
          </g>
        </g>
      </g>

      {/* Face */}
      <g className={`mascot-face${curious ? " mascot-face-curious" : ""}`}>
        <g className="mascot-brows">
          <path
            d={
              proud || cheering
                ? "M31 43.5c4.2-4.8 10.2-4.8 14.5 0"
                : curious
                  ? "M31 46.5c4.2-1.8 10.2-2.8 14.5-1.2"
                  : "M31 45.5c4.2-3 10.2-3 14.5 0"
            }
            stroke={INK}
            strokeWidth="2.35"
            strokeLinecap="round"
            fill="none"
            opacity="0.88"
          />
          <path
            d={
              proud || cheering
                ? "M50.5 43.5c4.2-4.8 10.2-4.8 14.5 0"
                : curious
                  ? "M50.5 45.2c4.2-2.4 10.2-1.4 14.5 1.6"
                  : "M50.5 45.5c4.2-3 10.2-3 14.5 0"
            }
            stroke={INK}
            strokeWidth="2.35"
            strokeLinecap="round"
            fill="none"
            opacity="0.88"
          />
        </g>

        {cheering ? (
          <g className="mascot-eyes-happy">
            <path
              d="M31.5 53.5c4.2-4.2 11.2-4.2 15.4 0"
              stroke="#0F172A"
              strokeWidth="3.1"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M49.2 53.5c4.2-4.2 11.2-4.2 15.4 0"
              stroke="#0F172A"
              strokeWidth="3.1"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M33.2 51.6c2.5-1.5 5.8-1.5 8.3 0"
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.5"
              fill="none"
            />
            <path
              d="M51 51.6c2.5-1.5 5.8-1.5 8.3 0"
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.5"
              fill="none"
            />
          </g>
        ) : (
          <g className="mascot-eyes-open">
            <g className="mascot-eye-left">
              <ellipse cx="38.5" cy="53.8" rx="5.8" ry="6.4" fill={`url(#${iris})`} />
              <ellipse
                cx="38.5"
                cy="53.8"
                rx="5.8"
                ry="6.4"
                fill="none"
                stroke="#020617"
                strokeWidth="0.65"
                opacity="0.4"
              />
              <circle cx="41" cy="51.2" r="2" fill="#FFFFFF" />
              <circle cx="36.2" cy="55.8" r="1" fill="#FFFFFF" opacity="0.55" />
              <circle cx="40.2" cy="55.2" r="0.55" fill="#5EEAD4" opacity="0.45" />
            </g>
            <g className="mascot-eye-right">
              <ellipse cx="57.5" cy="53.8" rx="5.8" ry="6.4" fill={`url(#${iris})`} />
              <ellipse
                cx="57.5"
                cy="53.8"
                rx="5.8"
                ry="6.4"
                fill="none"
                stroke="#020617"
                strokeWidth="0.65"
                opacity="0.4"
              />
              <circle cx="60" cy="51.2" r="2" fill="#FFFFFF" />
              <circle cx="55.2" cy="55.8" r="1" fill="#FFFFFF" opacity="0.55" />
              <circle cx="59.2" cy="55.2" r="0.55" fill="#5EEAD4" opacity="0.45" />
            </g>
          </g>
        )}

        <g className="mascot-cheeks">
          <ellipse cx="28" cy="62.5" rx="7" ry="4.2" fill={`url(#${cheek})`} />
          <ellipse cx="68" cy="62.5" rx="7" ry="4.2" fill={`url(#${cheek})`} />
        </g>

        {curious ? (
          <ellipse cx="48" cy="68" rx="4.2" ry="4.8" fill={INK_DARK} opacity="0.85" />
        ) : openSmile ? (
          <g className="mascot-mouth">
            <path
              d="M37.5 63.5c3 9.2 18 9.2 21 0"
              fill={`url(#${mouthFill})`}
              stroke={INK}
              strokeWidth="1.85"
              strokeLinejoin="round"
            />
            <path d="M41.5 64.6c2.4 4 10.6 4 13 0" fill="#FDF2F8" opacity="0.92" />
            <ellipse cx="48" cy="69.2" rx="3.8" ry="2.6" fill="#BE123C" opacity="0.58" />
            <path
              d="M40 63.8c2.8 1.2 12.2 1.2 15 0"
              stroke="#FFFFFF"
              strokeWidth="1.1"
              strokeLinecap="round"
              opacity="0.35"
              fill="none"
            />
          </g>
        ) : pose === "tip" ? (
          <path
            d="M40 65.5c2.8 5 13.2 5 16 0"
            stroke={INK}
            strokeWidth="2.55"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <path
            d="M41 66c2.8 3.8 11.2 3.8 14 0"
            stroke={INK}
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </g>

      {/*
        Arms — nested translate → spin → translate-back so CSS rotate
        always pivots on shoulder joints in viewBox space.
        Cheer uses dedicated raised geometry so hands stay readable above the head.
      */}
      {cheering ? (
        <>
          <g className="mascot-arm-left mascot-arm-pose-cheer">
            <g transform="translate(30 42)">
              <g className="mascot-arm-left-spin">
                <g transform="translate(-30 -42)">
                  <path
                    d="M32 44c-8-14-20-18-26-10-4.5 6 0 16 10 18 5.5 1.2 12-1 16-8Z"
                    fill={`url(#${armGrad})`}
                    stroke={INK_DARK}
                    strokeWidth="1.45"
                    strokeOpacity="0.36"
                  />
                  <ellipse
                    cx="10"
                    cy="30"
                    rx="7.4"
                    ry="6.2"
                    fill="#E6FFFA"
                    stroke={INK_DARK}
                    strokeWidth="1.25"
                    strokeOpacity="0.32"
                  />
                  <ellipse cx="7.2" cy="27.8" rx="1.85" ry="2.7" fill="#CCFBF1" />
                  <ellipse cx="10.8" cy="26.6" rx="1.75" ry="2.5" fill="#CCFBF1" />
                  <ellipse cx="14.4" cy="28" rx="1.55" ry="2.2" fill="#99F6E4" />
                  <ellipse cx="8.4" cy="25.4" rx="1.9" ry="1.35" fill="#FFFFFF" opacity="0.7" />
                </g>
              </g>
            </g>
          </g>
          <g className="mascot-arm-right mascot-arm-pose-cheer">
            <g transform="translate(66 42)">
              <g className="mascot-arm-right-spin">
                <g transform="translate(-66 -42)">
                  <path
                    d="M64 44c8-14 20-18 26-10 4.5 6 0 16-10 18-5.5 1.2-12-1-16-8Z"
                    fill={`url(#${armGrad})`}
                    stroke={INK_DARK}
                    strokeWidth="1.45"
                    strokeOpacity="0.36"
                  />
                  <ellipse
                    cx="86"
                    cy="30"
                    rx="7.4"
                    ry="6.2"
                    fill="#E6FFFA"
                    stroke={INK_DARK}
                    strokeWidth="1.25"
                    strokeOpacity="0.32"
                  />
                  <ellipse cx="88.8" cy="27.8" rx="1.85" ry="2.7" fill="#CCFBF1" />
                  <ellipse cx="85.2" cy="26.6" rx="1.75" ry="2.5" fill="#CCFBF1" />
                  <ellipse cx="81.6" cy="28" rx="1.55" ry="2.2" fill="#99F6E4" />
                  <ellipse cx="87.6" cy="25.4" rx="1.9" ry="1.35" fill="#FFFFFF" opacity="0.7" />
                </g>
              </g>
            </g>
          </g>
        </>
      ) : (
        <>
          <g className={`mascot-arm-left ${armPoseClass}`}>
            <g transform="translate(26 48)">
              <g className="mascot-arm-left-spin">
                <g transform="translate(-26 -48)">
                  <path
                    d="M28 46c-12.5 1.5-20.5 12-18.2 22.5 1.2 5.8 7.8 8.2 14.5 3.2 3.5-2.6 5.8-7.2 5.2-11.8C29.2 54.2 29 48.8 28 46Z"
                    fill={`url(#${armGrad})`}
                    stroke={INK_DARK}
                    strokeWidth="1.45"
                    strokeOpacity="0.36"
                  />
                  <ellipse
                    cx="17.5"
                    cy="66"
                    rx="7.2"
                    ry="6"
                    fill="#E6FFFA"
                    stroke={INK_DARK}
                    strokeWidth="1.25"
                    strokeOpacity="0.32"
                  />
                  <ellipse cx="14.6" cy="64.2" rx="1.8" ry="2.6" fill="#CCFBF1" />
                  <ellipse cx="18.2" cy="63" rx="1.7" ry="2.4" fill="#CCFBF1" />
                  <ellipse cx="21.6" cy="64.4" rx="1.5" ry="2.15" fill="#99F6E4" />
                  <ellipse cx="15.8" cy="61.8" rx="1.85" ry="1.3" fill="#FFFFFF" opacity="0.65" />
                </g>
              </g>
            </g>
          </g>

          <g className={`mascot-arm-right ${armPoseClass}`}>
            <g transform="translate(70 48)">
              <g className="mascot-arm-right-spin">
                <g transform="translate(-70 -48)">
                  <path
                    d="M68 46c12.5 1.5 20.5 12 18.2 22.5-1.2 5.8-7.8 8.2-14.5 3.2-3.5-2.6-5.8-7.2-5.2-11.8C66.8 54.2 67 48.8 68 46Z"
                    fill={`url(#${armGrad})`}
                    stroke={INK_DARK}
                    strokeWidth="1.45"
                    strokeOpacity="0.36"
                  />
                  <ellipse
                    cx="78.5"
                    cy="66"
                    rx="7.2"
                    ry="6"
                    fill="#E6FFFA"
                    stroke={INK_DARK}
                    strokeWidth="1.25"
                    strokeOpacity="0.32"
                  />
                  <ellipse cx="81.4" cy="64.2" rx="1.8" ry="2.6" fill="#CCFBF1" />
                  <ellipse cx="77.8" cy="63" rx="1.7" ry="2.4" fill="#CCFBF1" />
                  <ellipse cx="74.4" cy="64.4" rx="1.5" ry="2.15" fill="#99F6E4" />
                  <ellipse cx="80.2" cy="61.8" rx="1.85" ry="1.3" fill="#FFFFFF" opacity="0.65" />
                  {pose === "tip" ? (
                    <g className="mascot-tip-dot">
                      <circle cx="82" cy="30" r="5.2" fill="#F0FDFA" stroke={INK} strokeWidth="1.55" />
                      <circle cx="82" cy="30" r="2.1" fill={INK} />
                      <circle cx="83.3" cy="28.7" r="0.95" fill="#FFFFFF" opacity="0.75" />
                    </g>
                  ) : null}
                </g>
              </g>
            </g>
          </g>
        </>
      )}

      {pose === "streak" ? (
        <g className="mascot-flame">
          <path
            d="M75 26c.7 10.5-5.5 17-11.5 17 7-5 6-12.2 4.2-17.5 5 2 8 6.5 7.3.5Z"
            fill="#F59E0B"
          />
          <path
            d="M69.5 32.5c.35 6.8-3.5 10.8-7.6 10.8 4.4-3.5 3.8-7.6 2.2-11.2 3.5 1 5.7 3.5 5.4.4Z"
            fill="#FBBF24"
          />
          <path
            d="M66.8 35.5c.25 4.4-2 7.1-4.6 7.1 2.7-2.2 2.4-4.9 1.3-7.1 2.2.55 3.5 2 3.3 0Z"
            fill="#FEF3C7"
          />
          <path
            d="M68 30.5c2 2.8 1.6 6 0 8.2"
            stroke="#FFFBEB"
            strokeWidth="1.35"
            strokeLinecap="round"
            opacity="0.8"
          />
        </g>
      ) : null}

      {pose === "goal" ? (
        <g className="mascot-goal-star">
          <circle cx="76" cy="25" r="12" fill={`url(#${glow})`} />
          <circle cx="76" cy="25" r="10" fill="#A7F3D0" stroke={INK} strokeWidth="1.6" />
          <circle cx="76" cy="25" r="10" fill="#FFFFFF" opacity="0.2" />
          <path
            d="M70.5 25.5l3.4 3.4 7.5-8"
            stroke={INK}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      ) : null}

      {pose === "empty" ? (
        <g className="mascot-empty-bubble">
          <rect x="64" y="12" width="28" height="19" rx="7.5" fill="#F0FDFA" stroke={INK} strokeWidth="1.5" />
          <path d="M72 31l-4.5 6.5 8.5-3.8" fill="#F0FDFA" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
          <text
            x="78"
            y="26.5"
            textAnchor="middle"
            fill={INK_DARK}
            fontSize="13"
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
            <path d="M14 26l1.6 3.6 3.6 1.6-3.6 1.6L14 36.4l-1.6-3.6L8.8 31.2l3.6-1.6L14 26Z" fill="#5EEAD4" />
          </g>
          <g className="mascot-sparkle mascot-sparkle-b">
            <path d="M82 14l1.4 3 3 1.4-3 1.4L82 23l-1.4-3-3-1.4 3-1.4L82 14Z" fill="#FBBF24" />
          </g>
          <g className="mascot-sparkle mascot-sparkle-c">
            <circle cx="20" cy="14" r="2.1" fill="#99F6E4" />
          </g>
          <g className="mascot-sparkle mascot-sparkle-d">
            <circle cx="76" cy="46" r="1.7" fill="#FDE68A" />
          </g>
          <g className="mascot-sparkle mascot-sparkle-e">
            <path d="M10 46l1.1 2.4 2.4 1.1-2.4 1.1L10 53l-1.1-2.4-2.4-1.1 2.4-1.1L10 46Z" fill="#F0FDFA" />
          </g>
          <g className="mascot-sparkle mascot-sparkle-f">
            <path d="M86 38l1 2.2 2.2 1-2.2 1L86 44.4l-1-2.2-2.2-1 2.2-1L86 38Z" fill="#A7F3D0" />
          </g>
        </g>
      )}
    </svg>
  );
}
