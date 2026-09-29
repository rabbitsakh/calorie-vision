"use client";

import { useEffect, useState } from "react";
import { getImageUrl } from "@/lib/paths";

type UserAvatarProps = {
  image: string | null | undefined;
  label: string;
  className?: string;
  /** Initials fallback container classes when image is missing or fails. */
  fallbackClassName?: string;
  /** Letter size for the initials fallback. */
  initialsClassName?: string;
};

function initialsFrom(label: string): string {
  const trimmed = label.trim();
  return (trimmed.charAt(0) || "?").toUpperCase();
}

/**
 * Profile/header avatar: OAuth hosts (Google/VK/Yandex) often block hotlinks
 * without referrerPolicy, and a failed img would show the equipped frame
 * gradient through — so we fall back to initials on error.
 */
export function UserAvatar({
  image,
  label,
  className = "h-9 w-9 shrink-0 rounded-full border border-slate-200 object-cover bg-slate-100",
  fallbackClassName = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800",
  initialsClassName,
}: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const src = image?.trim() ? getImageUrl(image.trim()) : "";

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div className={fallbackClassName} aria-hidden>
        <span className={initialsClassName}>{initialsFrom(label)}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
