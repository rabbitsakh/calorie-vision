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
    default:
      return null;
  }
}
