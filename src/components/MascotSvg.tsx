import { useId, type SVGProps } from "react";
import { MascotSeasonalLayer } from "@/components/MascotSeasonalLayer";
import { mascotGestureClass, type MascotGesture } from "@/lib/mascot-liveness";
import { mascotSkinClass, type MascotSkinId } from "@/lib/mascot-skin";

export type MascotPose = "idle" | "cheer" | "streak" | "goal" | "empty" | "tip";
export type { MascotGesture };

const SIZE_PX = {
  sm: 44,
  md: 72,
  lg: 112,
  xl: 220,
} as const;

const INK = "#0F766E";
const INK_DARK = "#115E59";
const LEAF_DARK = "#0D9488";
const BLUSH = "#FDA4AF";

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

export type MascotSvgProps = {
  pose?: MascotPose;
  /** One-shot Duolingo-style gesture overlay (look / yawn / pet / …). */
  gesture?: MascotGesture;
  skin?: MascotSkinId;
  size?: keyof typeof SIZE_PX;
  className?: string;
  title?: string;
  animate?: boolean;
  /** Pop-in entrance (celebration / first paint). */
  entrance?: boolean;
} & Omit<SVGProps<SVGSVGElement>, "children">;

/** Soft pear / egg blob — matches the 3D vinyl reference silhouette. */
const BODY_PATH =
  "M48 18c16.8 0 30 12.8 30 31.5 0 14.2-7.2 25.5-17.2 31.2C54.8 85.5 50.8 88 48 88c-2.8 0-6.8-2.5-12.8-7.3C25.2 75 18 63.7 18 49.5 18 30.8 31.2 18 48 18Z";

/**
 * Soft 3D mint sprout blob — faithful to the vinyl reference:
 * pear body, dual leaves, leaf-paddle arms, stubby feet, glossy eyes.
 */
export function MascotSvg({
  pose = "idle",
  gesture = "none",
  skin = "default",
  size = "md",
  className,
  title = "Талисман Calorie Vision",
  animate = true,
  entrance = false,
  ...rest
}: MascotSvgProps) {
  const uid = useId().replace(/:/g, "");
  const bodyGrad = `cvBody-${uid}`;
  const bodyShade = `cvShade-${uid}`;
  const sheen = `cvSheen-${uid}`;
  const belly = `cvBelly-${uid}`;
  const leafL = `cvLeafL-${uid}`;
  const leafR = `cvLeafR-${uid}`;
  const armGrad = `cvArm-${uid}`;
  const footGrad = `cvFoot-${uid}`;
  const cheek = `cvCheek-${uid}`;
  const glow = `cvGlow-${uid}`;
  const iris = `cvIris-${uid}`;
  const mouthFill = `cvMouth-${uid}`;
  const softBlur = `cvBlur-${uid}`;
  const clipBody = `cvClip-${uid}`;

  const px = SIZE_PX[size];
  const motion = animate ? mascotMotionClass(pose) : "";
  const gestureClass = animate ? mascotGestureClass(gesture) : "";
  const classes = [
    "mascot-root",
    motion,
    gestureClass,
    entrance ? "mascot-entrance" : "",
    "mascot-face-alive",
    mascotSkinClass(skin),
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const proud = pose === "streak" || pose === "goal";
  const curious = pose === "empty";
  const looking = gesture === "look";
  const cheering = pose === "cheer" || gesture === "react" || gesture === "pet";
  const openSmile = cheering || proud || gesture === "wave";
  const yawning = gesture === "yawn";
  const armPoseClass =
    pose === "cheer" || gesture === "react" || gesture === "pet"
      ? "mascot-arm-pose-cheer"
      : gesture === "wave"
        ? "mascot-arm-pose-wave"
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
      viewBox="-4 -10 104 116"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={classes}
      {...rest}
    >
      <title>{title}</title>
      <defs>
        <radialGradient id={bodyGrad} cx="38%" cy="28%" r="72%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#F7FFFC" />
          <stop offset="18%" stopColor="#E6FFFA" />
          <stop offset="42%" stopColor="#C5F2E6" />
          <stop offset="72%" stopColor="#9FDBC8" />
          <stop offset="100%" stopColor="#7BC4AE" />
        </radialGradient>
        <radialGradient id={bodyShade} cx="55%" cy="88%" r="58%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#0F766E" stopOpacity="0" />
          <stop offset="45%" stopColor="#0D9488" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#115E59" stopOpacity="0.22" />
        </radialGradient>
        <radialGradient id={sheen} cx="32%" cy="22%" r="40%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.7" />
          <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={belly} cx="50%" cy="45%" r="55%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#F0FDFA" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={leafL} x1="26" y1="28" x2="50" y2="-2" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2DD4BF" />
          <stop offset="0.35" stopColor="#0F766E" />
          <stop offset="0.75" stopColor="#115E59" />
          <stop offset="1" stopColor="#134E4A" />
        </linearGradient>
        <linearGradient id={leafR} x1="70" y1="26" x2="46" y2="-4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#99F6E4" />
          <stop offset="0.3" stopColor="#5EEAD4" />
          <stop offset="0.7" stopColor="#14B8A6" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
        <linearGradient id={armGrad} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#14B8A6" />
          <stop offset="0.4" stopColor="#0F766E" />
          <stop offset="1" stopColor="#134E4A" />
        </linearGradient>
        <linearGradient id={footGrad} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#9FDBC8" />
          <stop offset="1" stopColor="#7BC4AE" />
        </linearGradient>
        <radialGradient id={cheek} cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor={BLUSH} stopOpacity="0.75" />
          <stop offset="55%" stopColor={BLUSH} stopOpacity="0.28" />
          <stop offset="100%" stopColor={BLUSH} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={glow} cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#99F6E4" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#5EEAD4" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={iris} cx="35%" cy="30%" r="70%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#1E3A3A" />
          <stop offset="40%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
        <radialGradient id={mouthFill} cx="50%" cy="15%" r="85%" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#FECDD3" />
          <stop offset="100%" stopColor="#E11D48" stopOpacity="0.85" />
        </radialGradient>
        <filter id={softBlur} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>
        <clipPath id={clipBody}>
          <path d={BODY_PATH} />
        </clipPath>
      </defs>

      <ellipse className="mascot-shadow" cx="48" cy="96" rx="22" ry="3.8" fill={INK_DARK} opacity="0.18" filter={`url(#${softBlur})`} />
      <ellipse className="mascot-aura" cx="48" cy="56" rx="38" ry="38" fill={`url(#${glow})`} />

      {/* Stubby feet — under body */}
      <g className="mascot-feet">
        <ellipse cx="37" cy="88.5" rx="7.5" ry="4.2" fill={`url(#${footGrad})`} />
        <ellipse cx="37" cy="87.6" rx="4.2" ry="1.6" fill="#FFFFFF" opacity="0.28" />
        <ellipse cx="59" cy="88.5" rx="7.5" ry="4.2" fill={`url(#${footGrad})`} />
        <ellipse cx="59" cy="87.6" rx="4.2" ry="1.6" fill="#FFFFFF" opacity="0.28" />
      </g>

      {/* Body */}
      <g className="mascot-body">
        <path d={BODY_PATH} fill={`url(#${bodyGrad})`} />
        <path d={BODY_PATH} fill={`url(#${bodyShade})`} />
        <g clipPath={`url(#${clipBody})`}>
          <ellipse cx="36" cy="42" rx="18" ry="14" fill={`url(#${sheen})`} />
          <ellipse cx="48" cy="68" rx="16" ry="13" fill={`url(#${belly})`} />
          <ellipse cx="58" cy="52" rx="8" ry="11" fill="#14B8A6" opacity="0.07" />
        </g>
        <path d={BODY_PATH} fill="none" stroke={INK_DARK} strokeWidth="1.15" opacity="0.18" />
      </g>

      {/* Sprout leaves */}
      <g className="mascot-sprout">
        <path d="M48 28c0-5.5.15-10.5.4-14.5" stroke={LEAF_DARK} strokeWidth="3.2" strokeLinecap="round" />
        <ellipse cx="48.2" cy="27.2" rx="3.2" ry="2.6" fill={LEAF_DARK} />
        <ellipse cx="48.2" cy="26.5" rx="1.3" ry="1" fill="#99F6E4" opacity="0.8" />

        <g className="mascot-leaf-left">
          <g transform="translate(48 20)">
            <g className="mascot-leaf-left-spin">
              <g transform="translate(-48 -20)">
                <path
                  d="M48 21C43.5 8.5 32.5 1.2 21.5 0.5c2.2 11.8 10 19.2 26.5 22Z"
                  fill={`url(#${leafL})`}
                />
                <path
                  d="M48 21c-7-6.5-15.5-10.8-22.5-12"
                  stroke="#99F6E4"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  opacity="0.75"
                  fill="none"
                />
                <path
                  d="M41 14c-3.5-2.2-7.8-3.6-12-4"
                  stroke="#5EEAD4"
                  strokeWidth="0.9"
                  strokeLinecap="round"
                  opacity="0.5"
                  fill="none"
                />
                <ellipse cx="32" cy="10" rx="2.8" ry="1.6" fill="#FFFFFF" opacity="0.28" transform="rotate(-40 32 10)" />
              </g>
            </g>
          </g>
        </g>

        <g className="mascot-leaf-right">
          <g transform="translate(48 20)">
            <g className="mascot-leaf-right-spin">
              <g transform="translate(-48 -20)">
                <path
                  d="M48 21C52.8 8.2 63.5 1 74.5 0.8c-1.8 11.5-10.2 19-26.5 21.5Z"
                  fill={`url(#${leafR})`}
                />
                <path
                  d="M48 21c7.2-6.2 16-10.5 23-11.5"
                  stroke="#F0FDFA"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  opacity="0.85"
                  fill="none"
                />
                <path
                  d="M55 13.5c3.8-2.2 8.2-3.5 12.5-3.8"
                  stroke="#99F6E4"
                  strokeWidth="0.9"
                  strokeLinecap="round"
                  opacity="0.55"
                  fill="none"
                />
                <ellipse cx="64" cy="9" rx="3" ry="1.7" fill="#FFFFFF" opacity="0.34" transform="rotate(32 64 9)" />
              </g>
            </g>
          </g>
        </g>
      </g>

      {/* Face */}
      <g className={`mascot-face${curious ? " mascot-face-curious" : ""}${looking ? " mascot-face-look" : ""}`}>
        <g className="mascot-brows">
          <path
            d={
              proud || cheering
                ? "M31.5 42c4-4.5 10-4.5 14 0"
                : curious
                  ? "M31.5 45c4-1.6 10-2.6 14-1"
                  : "M31.5 44c4-2.8 10-2.8 14 0"
            }
            stroke={INK}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            opacity="0.9"
          />
          <path
            d={
              proud || cheering
                ? "M50.5 42c4-4.5 10-4.5 14 0"
                : curious
                  ? "M50.5 43.5c4-2.2 10-1.2 14 1.5"
                  : "M50.5 44c4-2.8 10-2.8 14 0"
            }
            stroke={INK}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            opacity="0.9"
          />
        </g>

        {cheering ? (
          <g className="mascot-eyes-happy">
            <path
              d="M31.5 52.5c4-4 11-4 15 0"
              stroke="#0F172A"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M49.5 52.5c4-4 11-4 15 0"
              stroke="#0F172A"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        ) : (
          <g className="mascot-eyes-open">
            <g className="mascot-eye-left">
              <circle cx="38.5" cy="52.5" r="6.8" fill={`url(#${iris})`} />
              <g className="mascot-pupil-left">
                <circle cx="41" cy="49.8" r="2.35" fill="#FFFFFF" />
                <circle cx="36" cy="54.6" r="1.15" fill="#FFFFFF" opacity="0.7" />
              </g>
            </g>
            <g className="mascot-eye-right">
              <circle cx="57.5" cy="52.5" r="6.8" fill={`url(#${iris})`} />
              <g className="mascot-pupil-right">
                <circle cx="60" cy="49.8" r="2.35" fill="#FFFFFF" />
                <circle cx="55" cy="54.6" r="1.15" fill="#FFFFFF" opacity="0.7" />
              </g>
            </g>
          </g>
        )}

        <g className="mascot-cheeks">
          <ellipse cx="28.5" cy="60" rx="6.5" ry="4" fill={`url(#${cheek})`} filter={`url(#${softBlur})`} />
          <ellipse cx="67.5" cy="60" rx="6.5" ry="4" fill={`url(#${cheek})`} filter={`url(#${softBlur})`} />
        </g>

        {curious ? (
          <ellipse cx="48" cy="66.5" rx="3.6" ry="4.2" fill={INK_DARK} opacity="0.82" />
        ) : yawning ? (
          <ellipse className="mascot-mouth mascot-mouth-yawn" cx="48" cy="66" rx="5.5" ry="7" fill={`url(#${mouthFill})`} stroke={INK} strokeWidth="1.4" />
        ) : openSmile ? (
          <g className="mascot-mouth">
            <path
              d="M38.5 63c2.8 8.5 16.2 8.5 19 0"
              fill={`url(#${mouthFill})`}
              stroke={INK}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M42 64.2c2.2 3.6 9.8 3.6 12 0" fill="#FFF1F2" opacity="0.9" />
          </g>
        ) : pose === "tip" ? (
          <path
            d="M40.5 65c2.6 4.2 12.4 4.2 15 0"
            stroke={INK}
            strokeWidth="2.3"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <path
            d="M41.5 65.5c2.4 3.2 10.6 3.2 13 0"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </g>

      {/* Leaf-paddle arms (reference style) */}
      {cheering || gesture === "wave" ? (
        <>
          <g className={`mascot-arm-left ${armPoseClass}`}>
            <g transform="translate(28 46)">
              <g className="mascot-arm-left-spin">
                <g transform="translate(-28 -46)">
                  <path
                    d="M30 48C18 36 8 38 7 48c-.8 8 6.5 14 14.5 12 5.5-1.4 11-5.5 8.5-12Z"
                    fill={`url(#${armGrad})`}
                  />
                  <path
                    d="M28 48c-5.5-4.5-11-5.5-15.5-3"
                    stroke="#99F6E4"
                    strokeWidth="1.15"
                    strokeLinecap="round"
                    opacity="0.7"
                    fill="none"
                  />
                  <ellipse cx="14" cy="42" rx="2.2" ry="1.3" fill="#FFFFFF" opacity="0.3" transform="rotate(-35 14 42)" />
                </g>
              </g>
            </g>
          </g>
          <g className={`mascot-arm-right ${armPoseClass}`}>
            <g transform="translate(68 46)">
              <g className="mascot-arm-right-spin">
                <g transform="translate(-68 -46)">
                  <path
                    d="M66 48C78 36 88 38 89 48c.8 8-6.5 14-14.5 12-5.5-1.4-11-5.5-8.5-12Z"
                    fill={`url(#${armGrad})`}
                  />
                  <path
                    d="M68 48c5.5-4.5 11-5.5 15.5-3"
                    stroke="#99F6E4"
                    strokeWidth="1.15"
                    strokeLinecap="round"
                    opacity="0.7"
                    fill="none"
                  />
                  <ellipse cx="82" cy="42" rx="2.2" ry="1.3" fill="#FFFFFF" opacity="0.3" transform="rotate(35 82 42)" />
                </g>
              </g>
            </g>
          </g>
        </>
      ) : (
        <>
          <g className={`mascot-arm-left ${armPoseClass}`}>
            <g transform="translate(22 58)">
              <g className="mascot-arm-left-spin">
                <g transform="translate(-22 -58)">
                  <path
                    d="M26 52C14 50 8 58 10 66c1.5 6.5 9 8.5 15 4.5 4-2.6 5.5-7.5 4-12.5-0.6-2.2-1.5-4.5-3-6Z"
                    fill={`url(#${armGrad})`}
                  />
                  <path
                    d="M24 56c-5 0.5-9.5 3.5-10.5 8"
                    stroke="#99F6E4"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    opacity="0.7"
                    fill="none"
                  />
                  <ellipse cx="16" cy="58" rx="2.4" ry="1.4" fill="#FFFFFF" opacity="0.28" transform="rotate(-50 16 58)" />
                </g>
              </g>
            </g>
          </g>
          <g className={`mascot-arm-right ${armPoseClass}`}>
            <g transform="translate(74 58)">
              <g className="mascot-arm-right-spin">
                <g transform="translate(-74 -58)">
                  <path
                    d="M70 52C82 50 88 58 86 66c-1.5 6.5-9 8.5-15 4.5-4-2.6-5.5-7.5-4-12.5 0.6-2.2 1.5-4.5 3-6Z"
                    fill={`url(#${armGrad})`}
                  />
                  <path
                    d="M72 56c5 0.5 9.5 3.5 10.5 8"
                    stroke="#99F6E4"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    opacity="0.7"
                    fill="none"
                  />
                  <ellipse cx="80" cy="58" rx="2.4" ry="1.4" fill="#FFFFFF" opacity="0.28" transform="rotate(50 80 58)" />
                  {pose === "tip" ? (
                    <g className="mascot-tip-dot">
                      <circle cx="84" cy="34" r="5" fill="#F0FDFA" stroke={INK} strokeWidth="1.45" />
                      <circle cx="84" cy="34" r="2" fill={INK} />
                      <circle cx="85.2" cy="32.8" r="0.9" fill="#FFFFFF" opacity="0.75" />
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
            d="M74 24c.6 10-5.2 16.5-11 16.5 6.5-4.8 5.8-11.5 4-16.5 4.8 1.8 7.5 6 7 .0Z"
            fill="#F59E0B"
          />
          <path
            d="M68.5 30.5c.3 6.5-3.2 10.2-7.2 10.2 4.2-3.2 3.6-7.2 2-10.5 3.2.9 5.4 3.2 5.2.3Z"
            fill="#FBBF24"
          />
          <path d="M66 33.5c.2 4.2-1.8 6.8-4.2 6.8 2.5-2 2.2-4.6 1.2-6.8 2 .5 3.2 1.8 3 0Z" fill="#FEF3C7" />
        </g>
      ) : null}

      {pose === "goal" ? (
        <g className="mascot-goal-star">
          <circle cx="76" cy="24" r="11" fill={`url(#${glow})`} />
          <circle cx="76" cy="24" r="9.2" fill="#A7F3D0" stroke={INK} strokeWidth="1.5" />
          <path
            d="M71 24.5l3.2 3.2 7.2-7.6"
            stroke={INK}
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
      ) : null}

      {pose === "empty" ? (
        <g className="mascot-empty-bubble">
          <rect x="64" y="10" width="27" height="18" rx="7" fill="#F0FDFA" stroke={INK} strokeWidth="1.4" />
          <path d="M71 28l-4 6 8-3.5" fill="#F0FDFA" stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
          <text
            x="77.5"
            y="24"
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

      <MascotSeasonalLayer skin={skin} />

      {(cheering || proud) && (
        <g className="mascot-cheer-sparkles" aria-hidden>
          <g className="mascot-sparkle mascot-sparkle-a">
            <path d="M12 24l1.4 3.2 3.2 1.4-3.2 1.4L12 33.2l-1.4-3.2L7.4 28.6l3.2-1.4L12 24Z" fill="#5EEAD4" />
          </g>
          <g className="mascot-sparkle mascot-sparkle-b">
            <path d="M84 12l1.2 2.8 2.8 1.2-2.8 1.2L84 20l-1.2-2.8-2.8-1.2 2.8-1.2L84 12Z" fill="#FBBF24" />
          </g>
          <g className="mascot-sparkle mascot-sparkle-c">
            <circle cx="18" cy="12" r="1.9" fill="#99F6E4" />
          </g>
          <g className="mascot-sparkle mascot-sparkle-d">
            <circle cx="78" cy="42" r="1.5" fill="#FDE68A" />
          </g>
          <g className="mascot-sparkle mascot-sparkle-e">
            <path d="M8 42l1 2.2 2.2 1-2.2 1L8 48.4l-1-2.2-2.2-1 2.2-1L8 42Z" fill="#F0FDFA" />
          </g>
        </g>
      )}
    </svg>
  );
}
