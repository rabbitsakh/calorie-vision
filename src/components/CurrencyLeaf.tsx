"use client";

import { useId } from "react";

export type CurrencyLeafKind = "mascot" | "gloss" | "wink";

/**
 * Валюта повторок. Имена в базе не меняются.
 * mascot — основной: мордочка, блик, прожилка.
 * gloss — без лица, сильнее блик и искра.
 * wink — подмигивание и румянец.
 */
export function CurrencyLeaf({
  kind = "mascot",
  className = "collection-mini-leaf",
}: {
  kind?: CurrencyLeafKind;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const fill = `url(#${uid}-g)`;
  const shine = `url(#${uid}-s)`;
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-g`} x1="16%" y1="0%" x2="84%" y2="100%">
          <stop offset="0%" stopColor="#f3ff8a" />
          <stop offset="38%" stopColor="#46d64c" />
          <stop offset="100%" stopColor="#0f7d2e" />
        </linearGradient>
        <radialGradient id={`${uid}-s`} cx="28%" cy="18%" r="42%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="70%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="16.2" cy="30.2" rx="8.4" ry="1.25" fill="#04180c" opacity="0.42" />
      <path
        d="M16.4 1.6c3.4 1.5 9.4 4.6 10.8 10.2 1.5 6-1.6 12.2-7.6 14.1-.8.2-1.7.3-2.5.2-6.2-.7-11.4-6.2-10.6-12.8C7.2 7.6 12 3.4 15.6 1.9c.3-.1.6-.2.8-.3Z"
        fill={fill}
        stroke="#0a5c20"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M14.6 25.6c-.9 1.6-2.4 2.6-4 2.3"
        fill="none"
        stroke="#0a5c20"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M16.2 4.6c-.4 2.2-.8 4.2-1.1 6.2"
        fill="none"
        stroke="#0c5e22"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.85"
      />
      <ellipse cx="11.2" cy="7.1" rx="4.2" ry="2.15" fill={shine} transform="rotate(-32 11.2 7.1)" />
      {kind === "gloss" ? <Sparkle /> : null}
      {kind === "mascot" ? <Face wink={false} /> : null}
      {kind === "wink" ? <Face wink /> : null}
    </svg>
  );
}

function Sparkle() {
  return (
    <path
      d="M24.2 5.2 25 7.2 27 8l-2 0.8-0.8 2-0.8-2-2-0.8 2-0.8Z"
      fill="#fff"
    />
  );
}

function Face({ wink }: { wink: boolean }) {
  return (
    <g>
      {wink ? (
        <path
          d="M9.2 15.6q2.4 2.3 4.8-.2"
          fill="none"
          stroke="#102816"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      ) : (
        <g>
          <circle cx="11.6" cy="15.2" r="2.85" fill="#102816" />
          <circle cx="10.7" cy="14.2" r="1.05" fill="#fff" />
        </g>
      )}
      <g>
        <circle cx="20.2" cy="14.8" r="2.85" fill="#102816" />
        <circle cx="19.3" cy="13.8" r="1.05" fill="#fff" />
      </g>
      <path
        d="M11.2 19.2q4.8 3.6 9.6-.5"
        fill="none"
        stroke="#102816"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
      {wink ? (
        <>
          <ellipse cx="8.6" cy="18.4" rx="1.9" ry="1.05" fill="#ff7b9c" opacity="0.95" />
          <ellipse cx="23.2" cy="17.8" rx="1.9" ry="1.05" fill="#ff7b9c" opacity="0.95" />
        </>
      ) : null}
    </g>
  );
}
