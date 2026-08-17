type BrandMarkProps = {
  size?: number;
  className?: string;
  decorative?: boolean;
};

export function BrandMark({ size = 48, className = "", decorative = true }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`.trim()}
      aria-hidden={decorative}
      focusable="false"
      {...(decorative
        ? { role: "presentation" }
        : { role: "img", "aria-label": "Calorie Vision" })}
    >
      <g fill="none" stroke="#4BE0BC" strokeWidth="2.25" strokeLinecap="square">
        <path d="M4 16V4h12" />
        <path d="M60 16V4H48" />
        <path d="M4 48v12h12" />
        <path d="M60 48v12H48" />
      </g>
      <path
        d="M46.4 20.1a16.2 16.2 0 1 0 0 23.8"
        fill="none"
        stroke="#027678"
        strokeWidth="8.4"
        strokeLinecap="butt"
      />
      <path
        d="M25.2 21.2 32 41.6 38.8 21.2h-4.1L32 31.8 29.3 21.2z"
        fill="#10192E"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinejoin="miter"
      />
    </svg>
  );
}
