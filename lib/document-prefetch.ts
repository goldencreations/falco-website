import { toProxyUrl } from "@/lib/document-proxy";
import type { ApplicationViewRow } from "@/lib/application-adapters";

const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 80;

function collectMediaUrls(application: ApplicationViewRow): string[] {
  const urls: string[] = [];

  for (const doc of application.documents ?? []) {
    if (doc.preview_url?.trim()) urls.push(doc.preview_url.trim());
    else if (doc.url?.trim()) {
      const proxied = toProxyUrl(doc.url);
      if (proxied) urls.push(proxied);
    }
  }

  for (const col of application.collaterals ?? []) {
    if (col.image_preview_url?.trim()) urls.push(col.image_preview_url.trim());
    else if (col.image_url?.trim()) {
      const proxied = toProxyUrl(col.image_url);
      if (proxied) urls.push(proxied);
    }
  }

  for (const g of application.guarantors ?? []) {
    for (const preview of [g.id_front_preview_url, g.id_back_preview_url]) {
      if (preview?.trim()) urls.push(preview.trim());
    }
  }

  return [...new Set(urls)];
}

/** Warm browser cache for images in small batches (avoids network spikes). */
export function prefetchApplicationMedia(application: ApplicationViewRow) {
  if (typeof window === "undefined") return;

  const urls = collectMediaUrls(application);
  if (urls.length === 0) return;

  let index = 0;

  const runBatch = () => {
    const slice = urls.slice(index, index + BATCH_SIZE);
    index += BATCH_SIZE;
    for (const url of slice) {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
    }
    if (index < urls.length) {
      window.setTimeout(runBatch, BATCH_DELAY_MS);
    }
  };

  runBatch();
}
