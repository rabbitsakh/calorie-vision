"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { formatApkReleaseLabel, parseApkManifest } from "@/lib/apk-manifest";

type Props = {
  apkUrl: string;
  manifestUrl: string | null;
  className?: string;
  children: ReactNode;
  /** Подпись с сервера, если файл уже лежал на диске в момент сборки страницы. */
  initialLabel?: string | null;
};

export function ApkDownloadLink({
  apkUrl,
  manifestUrl,
  className,
  children,
  initialLabel = null,
}: Props) {
  const [label, setLabel] = useState<string | null>(initialLabel);
  const metaId = useId();

  useEffect(() => {
    if (!manifestUrl) {
      setLabel(null);
      return;
    }
    const controller = new AbortController();
    fetch(manifestUrl, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return parseApkManifest(await res.json());
      })
      .then((manifest) => {
        setLabel(manifest ? formatApkReleaseLabel(manifest) : null);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [manifestUrl]);

  return (
    <div className="apk-download">
      <a href={apkUrl} className={className} download aria-describedby={label ? metaId : undefined}>
        {children}
      </a>
      {label ? (
        <p id={metaId} className="apk-download-meta" data-testid="apk-release-meta">
          {label}
        </p>
      ) : null}
    </div>
  );
}
