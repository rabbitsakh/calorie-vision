import type { SVGProps } from "react";

export type MascotPose = "idle" | "cheer" | "streak" | "goal" | "empty" | "tip";

const SIZE_PX = {
  sm: 40,
  md: 64,
  lg: 96,
} as const;

type MascotProps = {
  pose?: MascotPose;
  size?: keyof typeof SIZE_PX;
  className?: string;
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, "children">;

/**
 * Soft teal blob-leaf companion for supportive moments (not guilt nudges).
 * Poses tweak arms / brows / mouth via the same SVG body.
 */
export function Mascot({
  pose = "idle",
  size = "md",
  className,
  title = "Талисман Calorie Vision",
  ...rest
}: MascotProps) {
  const px = SIZE_PX[size];
  const armsUp = pose === "cheer" || pose === "streak" || pose === "goal";
  const tipArm = pose === "tip";
  const curious = pose === "empty";
  const proud = pose === "streak" || pose === "goal";

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
      {...rest}
    >
      <title>{title}</title>
      {/* soft ground shadow */}
      <ellipse cx="48" cy="88" rx="22" ry="4" fill="#0f766e" opacity="0.12" />

      {/* left arm */}
      <g
        style={{
          transformOrigin: "30px 58px",
          transform: armsUp
            ? "rotate(-42deg) translate(-2px, -6px)"
            : tipArm
              ? "rotate(8deg)"
              : curious
                ? "rotate(12deg) translate(0, 2px)"
                : "none",
        }}
      >
        <path
          d="M28 56c-8 2-14 10-12 16 2 4 8 4 12 1"
          stroke="#0f766e"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* right arm */}
      <g
        style={{
          transformOrigin: "66px 58px",
          transform: armsUp
            ? "rotate(42deg) translate(2px, -6px)"
            : tipArm
              ? "rotate(-28deg) translate(4px, -10px)"
              : curious
                ? "rotate(-10deg)"
                : "none",
        }}
      >
        <path
          d="M68 56c8 2 14 10 12 16-2 4-8 4-12 1"
          stroke="#0f766e"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
        {tipArm ? (
          <circle cx="78" cy="40" r="3.5" fill="#0f766e" />
        ) : null}
      </g>

      {/* body */}
      <ellipse cx="48" cy="58" rx="26" ry="28" fill="#ccfbf1" />
      <ellipse cx="48" cy="58" rx="26" ry="28" fill="#99f6e4" opacity="0.55" />
      <ellipse cx="48" cy="60" rx="20" ry="22" fill="#5eead4" opacity="0.35" />

      {/* belly highlight */}
      <ellipse cx="48" cy="66" rx="12" ry="10" fill="#ffffff" opacity="0.45" />

      {/* leaf sprout */}
      <path
        d="M48 30c0-10 8-16 14-18-2 8-6 14-14 18Z"
        fill="#0f766e"
      />
      <path
        d="M48 30c0-9-8-15-14-17 2 8 6 13 14 17Z"
        fill="#14b8a6"
      />
      <path d="M48 32v8" stroke="#0f766e" strokeWidth="2.5" strokeLinecap="round" />

      {/* face */}
      <g transform={curious ? "translate(0 1)" : undefined}>
        {/* brows */}
        <path
          d={
            proud
              ? "M34 48c3-3 7-3 10 0"
              : curious
                ? "M34 50c3-1 7-2 10-1"
                : "M34 49c3-2 7-2 10 0"
          }
          stroke="#0f766e"
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
          stroke="#0f766e"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
        />

        {/* eyes */}
        <circle cx="39" cy="54" r="3.2" fill="#0f172a" />
        <circle cx="57" cy="54" r="3.2" fill="#0f172a" />
        <circle cx="40.2" cy="53" r="1" fill="#ffffff" />
        <circle cx="58.2" cy="53" r="1" fill="#ffffff" />

        {/* mouth */}
        {pose === "empty" ? (
          <ellipse cx="48" cy="64" rx="3" ry="3.5" fill="#0f766e" opacity="0.75" />
        ) : armsUp || pose === "tip" ? (
          <path
            d="M42 62c3 5 9 5 12 0"
            stroke="#0f766e"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        ) : (
          <path
            d="M43 63c2.5 3 7.5 3 10 0"
            stroke="#0f766e"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
        )}

        {/* blush */}
        <ellipse cx="33" cy="60" rx="3.5" ry="2" fill="#fb7185" opacity="0.35" />
        <ellipse cx="63" cy="60" rx="3.5" ry="2" fill="#fb7185" opacity="0.35" />
      </g>

      {/* tiny flame accent for streak */}
      {pose === "streak" ? (
        <path
          d="M72 34c0 6-4 9-7 9 4-3 3-7 2-10 3 1 5 4 5 1Z"
          fill="#f59e0b"
          opacity="0.9"
        />
      ) : null}
    </svg>
  );
}
