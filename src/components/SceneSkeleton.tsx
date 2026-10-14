/**
 * Shared in-scene loading language (cream/teal panel wash).
 * Prefer this over plain «Загрузка…» / DaisyLoading on product surfaces.
 */

type SceneSkeletonProps = {
  /** Compact for Suspense inside an existing shell. */
  compact?: boolean;
  /** Two skeleton lines only — for list/panel loading slots. */
  inline?: boolean;
  /** Optional label for a11y. */
  label?: string;
};

export function SceneSkeleton({
  compact = false,
  inline = false,
  label = "Загрузка…",
}: SceneSkeletonProps) {
  if (inline) {
    return (
      <div
        className="scene-skeleton-inline"
        role="status"
        aria-live="polite"
        aria-busy
        aria-label={label}
      >
        <div className="skeleton-line w-2/3" />
        <div className="skeleton-line mt-1.5 w-1/2" />
      </div>
    );
  }

  return (
    <div
      className={`scene-skeleton ${compact ? "scene-skeleton--compact" : ""}`}
      role="status"
      aria-live="polite"
      aria-busy
      aria-label={label}
    >
      <div className="scene-skeleton-band">
        <div className="skeleton-line w-28" />
        <div className="skeleton-line mt-2 w-16" />
      </div>
      <div className="scene-skeleton-body space-y-2.5">
        <div className="h-20 animate-pulse rounded-[var(--radius-lg)] bg-[var(--accent-soft)]/70" />
        <div className="skeleton-line w-4/5" />
        <div className="skeleton-line w-3/5" />
        {!compact ? (
          <>
            <div className="mt-3 h-14 animate-pulse rounded-[var(--radius-lg)] bg-[var(--accent-soft)]/60" />
            <div className="skeleton-line w-2/3" />
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Accent pulse dots for buttons / inline busy (replaces daisy-loading on product). */
export function SceneBusy({ className = "" }: { className?: string }) {
  return (
    <span className={`scene-busy ${className}`.trim()} aria-hidden>
      <span />
      <span />
      <span />
    </span>
  );
}
