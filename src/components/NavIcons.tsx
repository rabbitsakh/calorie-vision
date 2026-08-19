import type { NavIconName } from "@/lib/navigation";

type NavIconProps = {
  name: NavIconName;
  className?: string;
};

export function NavIcon({ name, className = "h-6 w-6" }: NavIconProps) {
  switch (name) {
    case "stats":
      return (
        <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19V5" strokeLinecap="round" />
          <path d="M4 19h16" strokeLinecap="round" />
          <rect x="7" y="10" width="3" height="7" rx="0.5" fill="currentColor" stroke="none" />
          <rect x="12" y="7" width="3" height="10" rx="0.5" fill="currentColor" stroke="none" />
          <rect x="17" y="13" width="3" height="4" rx="0.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "ration":
      return (
        <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v18" strokeLinecap="round" />
          <path d="M5 8c0-2.2 3.1-4 7-4s7 1.8 7 4" strokeLinecap="round" />
          <path d="M5 8v2c0 2.2 3.1 4 7 4s7-1.8 7-4V8" strokeLinecap="round" />
          <path d="M5 14v2c0 2.2 3.1 4 7 4s7-1.8 7-4v-2" strokeLinecap="round" />
        </svg>
      );
    case "weight":
      return (
        <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v3" strokeLinecap="round" />
          <path d="M8 6h8" strokeLinecap="round" />
          <path d="M6 10h12l-1.5 11H7.5L6 10z" strokeLinejoin="round" />
          <circle cx="12" cy="14" r="2.5" />
        </svg>
      );
    case "profile":
      return (
        <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}
