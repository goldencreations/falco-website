"use client";

import { useEffect, useState } from "react";
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

/** Image preview: preview URL first, same-origin proxy fallback for authenticated files. */
export function CachedMediaPreview({
  previewUrl,
  authUrl,
  alt,
  className,
  imageClassName,
  maxHeight = "max-h-48",
}: CachedMediaPreviewProps) {
  const [useProxy, setUseProxy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const proxyUrl = authUrl?.trim() ? toProxyUrl(authUrl) : null;
  const preview = previewUrl?.trim() || null;
  const activeSrc = useProxy ? proxyUrl : preview ?? proxyUrl;

  useEffect(() => {
    setUseProxy(false);
    setFailed(false);
    setLoaded(false);
  }, [preview, authUrl]);

  if (!activeSrc) return null;

  if (failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border bg-muted/20 px-3 text-center text-xs text-muted-foreground",
          maxHeight === "max-h-48" ? "min-h-32" : "min-h-40",
          className
        )}
      >
        Preview unavailable — use View or Download
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border bg-muted/20",
        maxHeight === "max-h-48" ? "min-h-32" : "min-h-40",
        className
      )}
    >
      {!loaded ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-muted/30 text-xs text-muted-foreground"
          aria-hidden
        >
          Loading…
        </div>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={activeSrc}
        src={activeSrc}
        alt={alt}
        decoding="async"
        className={cn("w-full object-contain", maxHeight, imageClassName)}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!useProxy && proxyUrl && activeSrc !== proxyUrl) {
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
