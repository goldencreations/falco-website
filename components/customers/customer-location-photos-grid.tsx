"use client";

import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CachedMediaPreview,
  resolveMediaViewUrl,
} from "@/components/media/cached-media-preview";
import type { CustomerAttachmentDocument } from "@/lib/customer-attachments";
import { toProxyUrl } from "@/lib/document-proxy";

type Props = {
  photos: CustomerAttachmentDocument[];
  label?: string;
};

export function CustomerLocationPhotosGrid({ photos, label = "Location photos" }: Props) {
  if (photos.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-dashed pt-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {photos.map((photo, index) => {
          const title = photos.length > 1 ? `${label} (${index + 1})` : label;
          const viewUrl = resolveMediaViewUrl(photo.previewUrl, photo.url);
          const downloadUrl = toProxyUrl(photo.url) ?? photo.url;

          return (
            <div key={`${photo.url}-${index}`} className="space-y-2 rounded-lg border border-border p-2">
              <CachedMediaPreview
                previewUrl={photo.previewUrl}
                authUrl={photo.url}
                alt={photo.name || title}
                maxHeight="max-h-40"
                imageClassName="object-cover"
              />
              {viewUrl ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      View
                    </a>
                  </Button>
                  <Button type="button" variant="secondary" size="sm" asChild>
                    <a href={downloadUrl} download>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download
                    </a>
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
