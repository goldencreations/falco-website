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
  /** Shrink-wrap to the image aspect ratio; whole image visible within max bounds. */
  fit?: boolean;
};

/** Tailwind classes for responsive attachment previews in forms. */
export const FORM_ATTACHMENT_PREVIEW_MAX_HEIGHT = "max-h-44 sm:max-h-56";
export const FORM_ATTACHMENT_PREVIEW_IMAGE_CLASS = cn(
  "h-auto w-auto max-w-full object-contain",
  FORM_ATTACHMENT_PREVIEW_MAX_HEIGHT
);

function candidateUrls(
  previewUrl?: string | null,
  authUrl?: string | null,
  filenameHint?: string | null
): string[] {
  const hint = filenameHint?.trim();
  const withHint = (url: string | null) => {
    if (!url || !hint) return url;
    if (url.includes("name=")) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}name=${encodeURIComponent(hint)}`;
  };
  const preview = previewUrl?.trim() ? withHint(toProxyUrl(previewUrl)) : null;
  const auth = authUrl?.trim() ? withHint(toProxyUrl(authUrl)) : null;
  const out: string[] = [];
  for (const url of [preview, auth]) {
    if (url && !out.includes(url)) out.push(url);
  }
  return out;
}

/**
 * Same-origin proxy URLs that View already opens successfully.
 * Use them directly as <img src> — do not re-fetch into a blob (that path was
 * rejecting valid phone photos when Content-Type sniffing failed).
 */
export function CachedMediaPreview({
  previewUrl,
  authUrl,
  alt,
  className,
  imageClassName,
  maxHeight = "max-h-48",
  fit = false,
}: CachedMediaPreviewProps) {
  const urls = candidateUrls(previewUrl, authUrl, alt);
  const [urlIndex, setUrlIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  const activeSrc = !failed && urls[urlIndex] ? `${urls[urlIndex]}${retryToken ? `&_r=${retryToken}` : ""}` : null;

  useEffect(() => {
    setUrlIndex(0);
    setFailed(urls.length === 0);
    setLoaded(false);
    setRetryToken(0);
  }, [previewUrl, authUrl, urls.length]);

  if (failed || !activeSrc) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border bg-muted/20 px-3 text-center text-xs text-muted-foreground",
          fit ? "min-h-24 w-fit max-w-full" : maxHeight === "max-h-48" ? "min-h-32" : "min-h-40",
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
        fit
          ? "inline-block w-fit max-w-full min-h-0"
          : maxHeight === "max-h-48"
            ? "min-h-32"
            : "min-h-40",
        className
      )}
    >
      {!loaded ? (
        <div
          className={cn(
            "absolute inset-0 z-10 flex items-center justify-center bg-muted/30 text-xs text-muted-foreground",
            fit && "min-h-24 min-w-24"
          )}
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
        loading="lazy"
        className={cn(
          fit
            ? cn("h-auto w-auto max-w-full object-contain", maxHeight)
            : cn("w-full object-contain", maxHeight),
          imageClassName
        )}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(false);
          if (urlIndex + 1 < urls.length) {
            setUrlIndex((i) => i + 1);
            return;
          }
          // One soft retry on the last URL (handles brief upstream blips).
          if (retryToken < 1) {
            setRetryToken((t) => t + 1);
            return;
          }
          setFailed(true);
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
  if (preview) return toProxyUrl(preview) ?? preview;
  if (authUrl?.trim()) return toProxyUrl(authUrl) ?? authUrl;
  return null;
}
