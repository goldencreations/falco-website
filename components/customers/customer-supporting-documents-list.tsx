"use client";

import { Download, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CachedMediaPreview,
  resolveMediaViewUrl,
} from "@/components/media/cached-media-preview";
import type { CustomerAttachmentDocument } from "@/lib/customer-attachments";
import { toProxyUrl } from "@/lib/document-proxy";
import { cn } from "@/lib/utils";

type Props = {
  documents: CustomerAttachmentDocument[];
  /** Prefer a wide multi-column gallery when the parent card is full width. */
  wide?: boolean;
};

export function isSupportingImageDocument(doc: CustomerAttachmentDocument): boolean {
  if (doc.previewUrl?.trim()) return true;
  return (
    /\.(jpe?g|png|webp)(?:[?#].*)?$/i.test(doc.name) ||
    /\.(jpe?g|png|webp)(?:[?#].*)?$/i.test(doc.url)
  );
}

export function countSupportingImageDocuments(
  documents: CustomerAttachmentDocument[]
): number {
  return documents.filter(isSupportingImageDocument).length;
}

export function CustomerSupportingDocumentsList({ documents, wide = false }: Props) {
  if (documents.length === 0) return null;

  const imageDocs = documents.filter(isSupportingImageDocument);
  const otherDocs = documents.filter((doc) => !isSupportingImageDocument(doc));
  const galleryWide = wide || imageDocs.length > 1;

  return (
    <div className="space-y-3 border-t border-dashed pt-4">
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <FileText className="h-4 w-4" aria-hidden />
        Supporting documents
      </p>

      {imageDocs.length > 0 ? (
        <div
          className={cn(
            "grid gap-3",
            galleryWide
              ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
              : "sm:grid-cols-2"
          )}
        >
          {imageDocs.map((doc, index) => {
            const viewUrl = resolveMediaViewUrl(doc.previewUrl, doc.url);
            const downloadUrl = toProxyUrl(doc.url) ?? doc.url;

            return (
              <div
                key={`${doc.url}-img-${index}`}
                className="overflow-hidden rounded-lg border border-border bg-background"
              >
                <div className="flex items-center justify-between gap-2 px-2.5 py-2 text-xs">
                  <span className="min-w-0 truncate font-medium">{doc.name}</span>
                  {viewUrl ? (
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" variant="outline" size="sm" className="h-7 px-2" asChild>
                        <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span className="sr-only">View</span>
                        </a>
                      </Button>
                      <Button type="button" variant="secondary" size="sm" className="h-7 px-2" asChild>
                        <a href={downloadUrl} download>
                          <Download className="h-3.5 w-3.5" />
                          <span className="sr-only">Download</span>
                        </a>
                      </Button>
                    </div>
                  ) : null}
                </div>
                {viewUrl ? (
                  <div className="border-t px-2 pb-2 pt-2">
                    <CachedMediaPreview
                      previewUrl={doc.previewUrl ?? doc.url}
                      authUrl={doc.url}
                      alt={doc.name}
                      maxHeight="max-h-36 sm:max-h-44"
                      imageClassName="object-cover"
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {otherDocs.length > 0 ? (
        <ul className="space-y-2">
          {otherDocs.map((doc, index) => {
            const viewUrl = resolveMediaViewUrl(doc.previewUrl, doc.url);
            const downloadUrl = toProxyUrl(doc.url) ?? doc.url;

            return (
              <li
                key={`${doc.url}-file-${index}`}
                className="overflow-hidden rounded-lg border border-border bg-background"
              >
                <div className="flex flex-col gap-2 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0 truncate font-medium">{doc.name}</span>
                  {viewUrl ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
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
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
