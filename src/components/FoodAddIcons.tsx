import type { FoodAddModeIcon } from "@/lib/food-add-modes";

type IconProps = {
  name: FoodAddModeIcon;
  className?: string;
};

/** Small line icons for the «+» picker / desktop menu. */
export function FoodAddIcon({ name, className = "h-6 w-6" }: IconProps) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.85,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "photo":
      return (
        <svg {...common}>
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h2l1.2-1.5A1.5 1.5 0 0 1 10.9 3h2.2a1.5 1.5 0 0 1 1.2.5L15.5 5h2A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9z" strokeLinejoin="round" />
          <circle cx="12" cy="12.5" r="3.25" />
        </svg>
      );
    case "gallery":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="14" rx="2" />
          <circle cx="8.5" cy="10" r="1.5" />
          <path d="M3.5 15.5l4.2-3.5 3.3 2.5 4-4.5 5.5 5.5" strokeLinejoin="round" />
        </svg>
      );
    case "text":
      return (
        <svg {...common}>
          <path d="M5 6.5h14M8 6.5V18M16 6.5V18M9.5 18h5" strokeLinecap="round" />
        </svg>
      );
    case "barcode":
      return (
        <svg {...common}>
          <path d="M4 7v10M7.5 7v10M10 7v10M12.5 7v10M16 7v10M19 7v10" strokeLinecap="round" />
        </svg>
      );
    case "water":
      return (
        <svg {...common}>
          <path
            d="M12 3.5c2.8 3.4 5.5 6.6 5.5 9.4a5.5 5.5 0 1 1-11 0C6.5 10.1 9.2 6.9 12 3.5z"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "weight":
      return (
        <svg {...common}>
          <path d="M7 8.5h10l1.5 11H5.5L7 8.5z" strokeLinejoin="round" />
          <path d="M10 8.5a2 2 0 1 1 4 0" strokeLinecap="round" />
        </svg>
      );
    case "workout":
      return (
        <svg {...common}>
          <path d="M6.5 9.5v5M17.5 9.5v5" strokeLinecap="round" />
          <path d="M4 11v2M20 11v2" strokeLinecap="round" />
          <path d="M8 12h8" strokeLinecap="round" />
          <rect x="2.5" y="8.5" width="2.5" height="7" rx="1" />
          <rect x="19" y="8.5" width="2.5" height="7" rx="1" />
          <rect x="5.5" y="9.5" width="2" height="5" rx="0.5" />
          <rect x="16.5" y="9.5" width="2" height="5" rx="0.5" />
        </svg>
      );
    default:
      return null;
  }
}
