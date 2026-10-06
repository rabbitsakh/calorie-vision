"use client";

import { useEffect, useState } from "react";
import { isRemoteHttpUrl } from "@/lib/avatar-url";
import { isCapacitorNative } from "@/lib/capacitor-bridge";
import { isApkWebView } from "@/lib/capacitor-resume";
import { getImageUrl, withBasePath } from "@/lib/paths";

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

function needsApkAvatarProxy(): boolean {
  if (typeof window === "undefined") return false;
  // OAuth CDNs and cookie-gated /api/uploads often break as <img> in WebView.
  return isApkWebView() || isCapacitorNative();
}

/**
 * Profile/header avatar: OAuth hosts (Google/VK/Yandex) often block hotlinks
 * without referrerPolicy, and a failed img would show the equipped frame
 * gradient through — so we fall back to initials on error.
 *
 * In the RuStore APK WebView we resolve via authenticated `/api/avatar-image`
 * → blob URL (fetch sends cookies; OAuth bytes are proxied server-side).
 */
export function UserAvatar({
  image,
  label,
  className = "h-9 w-9 shrink-0 rounded-full border border-[rgba(13,115,119,0.14)] object-cover bg-[var(--accent-soft)]",
  fallbackClassName = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800",
  initialsClassName,
}: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const [src, setSrc] = useState("");
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setFailed(false);

    const raw = image?.trim() ?? "";
    if (!raw) {
      setSrc("");
      setResolving(false);
      return;
    }

    const direct = getImageUrl(raw);
    const proxy = needsApkAvatarProxy();

    if (!proxy) {
      setResolving(false);
      setSrc(direct);
      return () => {
        cancelled = true;
      };
    }

    setResolving(true);
    setSrc("");
    void (async () => {
      try {
        const res = await fetch(
          withBasePath(`/api/avatar-image?src=${encodeURIComponent(raw)}`),
          { credentials: "include", cache: "force-cache" },
        );
        if (!res.ok) {
          throw new Error(`avatar ${res.status}`);
        }
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setResolving(false);
      } catch {
        if (cancelled) return;
        // Last resort: direct img (may still work for some hosts / uploads).
        if (isRemoteHttpUrl(raw) || raw.startsWith("/")) {
          setSrc(direct);
          setResolving(false);
        } else {
          setFailed(true);
          setResolving(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [image]);

  if (resolving && !src) {
    // Neutral placeholder while APK proxy loads — avoid wrong initials flash.
    return <div className={className} aria-hidden />;
  }

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
