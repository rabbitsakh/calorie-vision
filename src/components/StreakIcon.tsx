export function FlameIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2c.4 3.2-1.4 5.1-3.2 6.8C7 10.5 5.5 12.2 5.5 15.1 5.5 18.6 8.3 22 12 22s6.5-3.4 6.5-6.9c0-2.4-1.1-4.2-2.3-5.6-.4 1.6-1.3 2.6-2.5 3.1.6-2.3.3-4.6-1.7-10.6Z" />
    </svg>
  );
}

export function CalendarGlyph({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" strokeLinecap="round" />
    </svg>
  );
}

export function StreakGlyph({ streak, className = "h-7 w-7" }: { streak: number; className?: string }) {
  if (streak < 1) {
    return <CalendarGlyph className={`${className} text-amber-700`} />;
  }
  return <FlameIcon className={`${className} ${streak >= 14 ? "text-amber-600" : "text-amber-500"}`} />;
}
