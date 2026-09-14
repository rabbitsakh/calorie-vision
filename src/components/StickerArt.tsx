import { stickerGlyph } from "@/lib/rewards";

const STICKER_KEYS = [
  "sticker_sprout",
  "sticker_cup",
  "sticker_sunrise",
  "sticker_plate",
  "sticker_moon",
  "sticker_leaf",
  "sticker_berry",
  "sticker_steam",
  "sticker_path",
  "sticker_star",
] as const;

export type StickerArtKey = (typeof STICKER_KEYS)[number];

export function isStickerArtKey(key: string | null | undefined): key is StickerArtKey {
  return Boolean(key && (STICKER_KEYS as readonly string[]).includes(key));
}

type StickerArtProps = {
  stickerKey: string | null | undefined;
  className?: string;
  /** Pixel size of the SVG viewBox render. Default 28. */
  size?: number;
  title?: string;
};

/** Soft inline SVG for diary stickers (emoji remains a11y / fallback via stickerGlyph). */
export function StickerArt({
  stickerKey,
  className = "",
  size = 28,
  title,
}: StickerArtProps) {
  if (!stickerKey || !isStickerArtKey(stickerKey)) return null;

  const label = title ?? "Наклейка из коллекции";
  const glyph = stickerGlyph(stickerKey);

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`.trim()}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
      title={label}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        {renderStickerBody(stickerKey)}
      </svg>
      <span className="sr-only">{glyph}</span>
    </span>
  );
}

function renderStickerBody(key: StickerArtKey) {
  switch (key) {
    case "sticker_sprout":
      return (
        <>
          <ellipse cx="16" cy="26" rx="8" ry="3" fill="#A7F3D0" opacity="0.7" />
          <path
            d="M16 24 V12"
            stroke="#0F766E"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M16 16 C12 14 9 11 10 8 C14 8 16 11 16 14"
            fill="#34D399"
            stroke="#0F766E"
            strokeWidth="1.2"
          />
          <path
            d="M16 15 C20 13 23 10 22 7 C18 7 16 10 16 13"
            fill="#6EE7B7"
            stroke="#0F766E"
            strokeWidth="1.2"
          />
        </>
      );
    case "sticker_cup":
      return (
        <>
          <path
            d="M9 10 H20 C21.5 10 22.5 11.5 22 14 L20.5 22 C20.2 24 18.5 25.5 16.5 25.5 H12.5 C10.5 25.5 8.8 24 8.5 22 L7 14 C6.5 11.5 7.5 10 9 10 Z"
            fill="#99F6E4"
            stroke="#0F766E"
            strokeWidth="1.4"
          />
          <path
            d="M22 13 H24.5 C26 13 27 14.2 26.7 15.6 L25.8 19.2 C25.5 20.4 24.4 21.2 23.2 21.2 H21.2"
            stroke="#0F766E"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M11 14 H18"
            stroke="#5EEAD4"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.85"
          />
        </>
      );
    case "sticker_sunrise":
      return (
        <>
          <circle cx="16" cy="18" r="7" fill="#FCD34D" stroke="#B45309" strokeWidth="1.2" />
          <path
            d="M6 22 H26"
            stroke="#0F766E"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path d="M16 6 V9" stroke="#F59E0B" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M8 10 L10 12" stroke="#F59E0B" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M24 10 L22 12" stroke="#F59E0B" strokeWidth="1.4" strokeLinecap="round" />
          <path
            d="M6 22 C10 18 14 17 16 17 C18 17 22 18 26 22"
            fill="#FEF3C7"
            opacity="0.9"
          />
        </>
      );
    case "sticker_plate":
      return (
        <>
          <ellipse
            cx="16"
            cy="17"
            rx="11"
            ry="8"
            fill="#FEF3C7"
            stroke="#0F766E"
            strokeWidth="1.4"
          />
          <ellipse
            cx="16"
            cy="17"
            rx="7"
            ry="5"
            fill="#FDE68A"
            stroke="#B45309"
            strokeWidth="1"
            opacity="0.85"
          />
          <circle cx="14" cy="16" r="1.6" fill="#F97316" opacity="0.9" />
          <circle cx="18" cy="17.5" r="1.3" fill="#FB7185" opacity="0.85" />
        </>
      );
    case "sticker_moon":
      return (
        <>
          <circle cx="16" cy="16" r="10" fill="#E0E7FF" opacity="0.55" />
          <path
            d="M18 7 C12 8 9 13 10 18 C11 23 16 26 21 24 C17 24 13 20 14 15 C14.5 12 16 9 18 7 Z"
            fill="#C7D2FE"
            stroke="#4338CA"
            strokeWidth="1.2"
          />
          <circle cx="22" cy="10" r="1" fill="#FDE68A" />
          <circle cx="25" cy="14" r="0.7" fill="#FDE68A" opacity="0.8" />
        </>
      );
    case "sticker_leaf":
      return (
        <>
          <path
            d="M16 26 C10 22 7 16 9 10 C15 8 20 12 23 18 C20 23 18 25 16 26 Z"
            fill="#6EE7B7"
            stroke="#0F766E"
            strokeWidth="1.3"
          />
          <path
            d="M16 24 C14 18 13 14 14 10"
            stroke="#0F766E"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path
            d="M15 16 C17 15 19 16 20 18"
            stroke="#047857"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.7"
          />
        </>
      );
    case "sticker_berry":
      return (
        <>
          <circle cx="13" cy="18" r="5.5" fill="#818CF8" stroke="#3730A3" strokeWidth="1.2" />
          <circle cx="20" cy="17" r="5" fill="#A78BFA" stroke="#5B21B6" strokeWidth="1.2" />
          <circle cx="16.5" cy="13" r="4.2" fill="#C4B5FD" stroke="#5B21B6" strokeWidth="1.1" />
          <path
            d="M16 9 C16 7 17.5 5.5 19 6"
            stroke="#0F766E"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          <ellipse cx="14" cy="16" rx="0.7" ry="0.9" fill="#EEF2FF" opacity="0.7" />
        </>
      );
    case "sticker_steam":
      return (
        <>
          <path
            d="M10 14 H22 C23 14 23.5 15 23 16.5 L21.5 24 C21.2 25.5 19.8 26.5 18.2 26.5 H13.8 C12.2 26.5 10.8 25.5 10.5 24 L9 16.5 C8.5 15 9 14 10 14 Z"
            fill="#FED7AA"
            stroke="#9A3412"
            strokeWidth="1.3"
          />
          <path
            d="M13 11 C13 9 14.5 8 14.5 6.5"
            stroke="#94A3B8"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M16.5 12 C16.5 10 18 9 18 7"
            stroke="#94A3B8"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M20 11 C20 9.5 21 8.5 21 7"
            stroke="#94A3B8"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </>
      );
    case "sticker_path":
      return (
        <>
          <path
            d="M8 24 C11 20 12 16 11 12 C10 9 12 7 15 7 C18 7 20 10 19 14 C18 18 20 21 24 24"
            stroke="#0F766E"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="11" cy="23" r="2.2" fill="#5EEAD4" stroke="#0F766E" strokeWidth="1" />
          <circle cx="15" cy="18" r="2" fill="#99F6E4" stroke="#0F766E" strokeWidth="1" />
          <circle cx="18" cy="12" r="1.8" fill="#CCFBF1" stroke="#0F766E" strokeWidth="1" />
        </>
      );
    case "sticker_star":
      return (
        <>
          <path
            d="M16 5 L18.4 12.2 L26 12.5 L20 17.2 L22 24.5 L16 20.5 L10 24.5 L12 17.2 L6 12.5 L13.6 12.2 Z"
            fill="#FCD34D"
            stroke="#B45309"
            strokeWidth="1.2"
          />
          <circle cx="16" cy="15" r="2.2" fill="#FEF3C7" opacity="0.85" />
        </>
      );
    default:
      return null;
  }
}
