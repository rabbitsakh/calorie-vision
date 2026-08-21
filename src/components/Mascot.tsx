import { useId, type SVGProps } from "react";

export type MascotPose = "idle" | "cheer" | "streak" | "goal" | "empty" | "tip";

const SIZE_PX = {
  sm: 44,
  md: 72,
  lg: 112,
  xl: 220,
} as const;

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
 * Soft teal sprout companion — plump chibi body, leaf ears, glossy eyes.
 * Supportive tone only (not guilt nudges). Poses tweak arms / face / props.
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
  const bodyGrad = `mascotBodyGrad-${uid}`;
  const bellyGrad = `mascotBellyGrad-${uid}`;
  const leafDark = `mascotLeafDark-${uid}`;
  const leafLight = `mascotLeafLight-${uid}`;
  const armGrad = `mascotArmGrad-${uid}`;
  const cheekGrad = `mascotCheek-${uid}`;

  const px = SIZE_PX[size];
  const armsUp = pose === "cheer" || pose === "streak" || pose === "goal";
  const tipArm = pose === "tip";
  const curious = pose === "empty";
  const proud = pose === "streak" || pose === "goal";
  const motion = animate ? mascotMotionClass(pose) : "";
  const classes = ["mascot-root", motion, className].filter(Boolean).join(" ");

  const leftArm = armsUp
    ? "rotate(-48deg) translate(-4px, -10px)"
    : tipArm
      ? "rotate(6deg) translate(0, 2px)"
      : curious
        ? "rotate(14deg) translate(1px, 3px)"
        : "rotate(-6deg)";
  const rightArm = armsUp
    ? "rotate(48deg) translate(4px, -10px)"
    : tipArm
      ? "rotate(-38deg) translate(6px, -14px)"
      : curious
        ? "rotate(-12deg) translate(-1px, 2px)"
        : "rotate(6deg)";

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
        <linearGradient id={bodyGrad} x1="28" y1="28" x2="96" y2="108" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E6FFFA" />
          <stop offset="0.45" stopColor="#99F6E4" />
          <stop offset="1" stopColor="#2DD4BF" />
        </linearGradient>
        <linearGradient id={bellyGrad} x1="48" y1="70" x2="80" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id={leafDark} x1="54" y1="8" x2="78" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0F766E" />
          <stop offset="1" stopColor="#115E59" />
        </linearGradient>
        <linearGradient id={leafLight} x1="40" y1="10" x2="58" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2DD4BF" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
        <linearGradient id={armGrad} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#5EEAD4" />
          <stop offset="1" stopColor="#14B8A6" />
        </linearGradient>
        <radialGradient id={cheekGrad} cx="50%" cy="50%" r="50%">
          <stop stopColor="#FB7185" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FB7185" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse className="mascot-shadow" cx="64" cy="118" rx="28" ry="5" fill="#0F766E" opacity="0.14" />

      <g className="mascot-arm-left" style={{ transformOrigin: "38px 78px", transform: leftArm }}>
        <path
          d="M40 74c-12 2-20 14-16 22 3 6 12 7 18 2 4-3 5-9 3-14-2-4-4-8-5-10Z"
          fill={`url(#${armGrad})`}
        />
        <ellipse cx="28" cy="92" rx="7" ry="5.5" fill="#5EEAD4" />
        <ellipse cx="28" cy="91" rx="3.5" ry="2.2" fill="#FFFFFF" opacity="0.35" />
      </g>

      <g className="mascot-arm-right" style={{ transformOrigin: "90px 78px", transform: rightArm }}>
        <path
          d="M88 74c12 2 20 14 16 22-3 6-12 7-18 2-4-3-5-9-3-14 2-4 4-8 5-10Z"
          fill={`url(#${armGrad})`}
        />
        <ellipse cx="100" cy="92" rx="7" ry="5.5" fill="#5EEAD4" />
        <ellipse cx="100" cy="91" rx="3.5" ry="2.2" fill="#FFFFFF" opacity="0.35" />
        {tipArm ? (
          <g className="mascot-tip-dot">
            <circle cx="108" cy="52" r="5.5" fill="#0F766E" />
            <circle cx="108" cy="52" r="2.4" fill="#5EEAD4" />
          </g>
        ) : null}
      </g>

      <g className="mascot-body">
        <ellipse cx="64" cy="78" rx="34" ry="36" fill={`url(#${bodyGrad})`} />
        <ellipse cx="64" cy="78" rx="34" ry="36" fill="#99F6E4" opacity="0.25" />
        <ellipse cx="54" cy="62" rx="12" ry="9" fill="#FFFFFF" opacity="0.45" />
        <ellipse cx="64" cy="92" rx="18" ry="16" fill={`url(#${bellyGrad})`} />
      </g>

      <g className="mascot-leaves">
        <g className="mascot-leaf-right">
          <path
            d="M66 46c2-18 16-28 26-30-4 14-10 24-22 32-2 1-5 0-4-2Z"
            fill={`url(#${leafDark})`}
          />
          <path d="M72 28c6-2 12-2 16 0-4 5-9 8-14 10-2 1-3-1-2-3Z" fill="#5EEAD4" opacity="0.45" />
          <path
            d="M70 42c8-8 16-14 20-22"
            stroke="#5EEAD4"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.55"
          />
        </g>
        <g className="mascot-leaf-left">
          <path
            d="M62 46c-4-16-16-26-26-30 6 14 12 24 22 32 2 1 5 0 4-2Z"
            fill={`url(#${leafLight})`}
          />
          <path d="M48 26c-5-1-10 0-14 3 5 4 10 7 15 8 2 0 2-2-1-3Z" fill="#CCFBF1" opacity="0.5" />
          <path
            d="M58 42c-8-8-15-14-20-22"
            stroke="#CCFBF1"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.65"
          />
        </g>
        <path d="M64 44v10" stroke="#0F766E" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      </g>

      <g className="mascot-face" transform={curious ? "translate(0 1.5)" : undefined}>
        <path
          className="mascot-brow-left"
          d={
            proud
              ? "M42 58c4-4 10-4 14 0"
              : curious
                ? "M42 60c4-1 10-2 14-1"
                : "M42 59c4-2.5 10-2.5 14 0"
          }
          stroke="#0F766E"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
          opacity="0.75"
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
          stroke="#0F766E"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
          opacity="0.75"
        />

        <g className="mascot-eye-left">
          <ellipse cx="50" cy="68" rx="7.2" ry="7.8" fill="#0F172A" />
          <circle cx="52.4" cy="65.6" r="2.6" fill="#FFFFFF" />
          <circle cx="48.2" cy="70.2" r="1.1" fill="#FFFFFF" opacity="0.7" />
        </g>
        <g className="mascot-eye-right">
          <ellipse cx="78" cy="68" rx="7.2" ry="7.8" fill="#0F172A" />
          <circle cx="80.4" cy="65.6" r="2.6" fill="#FFFFFF" />
          <circle cx="76.2" cy="70.2" r="1.1" fill="#FFFFFF" opacity="0.7" />
        </g>

        <ellipse cx="40" cy="76" rx="7" ry="4.5" fill={`url(#${cheekGrad})`} />
        <ellipse cx="88" cy="76" rx="7" ry="4.5" fill={`url(#${cheekGrad})`} />

        {pose === "empty" ? (
          <ellipse cx="64" cy="82" rx="4.2" ry="5" fill="#0F766E" opacity="0.8" />
        ) : armsUp || pose === "tip" ? (
          <path
            d="M54 80c4 8 12 8 16 0"
            stroke="#0F766E"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <path
            d="M55 81c3.5 5 10.5 5 14 0"
            stroke="#0F766E"
            strokeWidth="2.8"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </g>

      {pose === "streak" ? (
        <g className="mascot-flame" style={{ transformOrigin: "102px 42px" }}>
          <path d="M102 28c0 10-7 16-12 16 7-5 5-12 3-16 5 2 9 7 9 0Z" fill="#F59E0B" />
          <path d="M98 34c0 6-3.5 9-6.5 9 3.5-2.5 2.5-6.5 1.5-9 3 1 5 4 5 0Z" fill="#FDE68A" />
        </g>
      ) : null}

      {pose === "goal" ? (
        <g className="mascot-goal-star" opacity="0.95">
          <path
            d="M104 34l2.2 4.6 5 .7-3.6 3.5.9 5.1-4.5-2.4-4.5 2.4.9-5.1-3.6-3.5 5-.7Z"
            fill="#FBBF24"
          />
        </g>
      ) : null}
    </svg>
  );
}
