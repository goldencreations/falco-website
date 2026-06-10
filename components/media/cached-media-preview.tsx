"use client";

import { useState } from "react";
import { toProxyUrl } from "@/lib/document-proxy";
import { cn } from "@/lib/utils";

type CachedMediaPreviewProps = {
  /** Signed or public URL — loaded first (fast). */
  previewUrl?: string | null;
  /** Authenticated URL — proxied when preview fails or is absent. */
  authUrl?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  maxHeight?: string;
};

/** Image preview: preview URL first, proxy fallback, lazy-loaded with placeholder. */
export function CachedMediaPreview({
  previewUrl,
  authUrl,
  alt,
  className,
  imageClassName,
  maxHeight = "max-h-48",
}: CachedMediaPreviewProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [useProxy, setUseProxy] = useState(false);

  const proxyUrl = authUrl ? toProxyUrl(authUrl) : null;
  const primary = previewUrl?.trim() || null;
  const activeSrc = useProxy ? proxyUrl : primary ?? proxyUrl;

  if (!activeSrc || failed) return null;

  return (
    <div className={cn("overflow-hidden rounded-md border bg-muted/20", className)}>
      {!loaded ? (
        <div
          className={cn(
            "flex items-center justify-center bg-muted/30 text-xs text-muted-foreground",
            maxHeight === "max-h-48" ? "h-32" : "h-40"
          )}
          aria-hidden
        >
          Loading…
        </div>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={activeSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn(
          "w-full object-contain",
          maxHeight,
          imageClassName,
          loaded ? "block" : "sr-only"
        )}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!useProxy && proxyUrl && primary) {
            setUseProxy(true);
            setLoaded(false);
          } else {
            setFailed(true);
          }
        }}
      />
    </div>
  );
}

export function resolveMediaViewUrl(
  previewUrl?: string | null,
  authUrl?: string | null
): string | null {
  const preview = previewUrl?.trim();
  if (preview) return preview;
  if (authUrl?.trim()) return toProxyUrl(authUrl) ?? authUrl;
  return null;
}
