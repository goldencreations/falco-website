"use client";

import { Download, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CachedMediaPreview,
  resolveMediaViewUrl,
} from "@/components/media/cached-media-preview";
import type { CustomerAttachmentDocument } from "@/lib/customer-attachments";
import { toProxyUrl } from "@/lib/document-proxy";

type Props = {
  documents: CustomerAttachmentDocument[];
};

function isImageDocument(doc: CustomerAttachmentDocument): boolean {
  if (doc.previewUrl?.trim()) return true;
  return (
    /\.(jpe?g|png|webp)(?:[?#].*)?$/i.test(doc.name) ||
    /\.(jpe?g|png|webp)(?:[?#].*)?$/i.test(doc.url)
  );
}

export function CustomerSupportingDocumentsList({ documents }: Props) {
  if (documents.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-dashed pt-4">
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <FileText className="h-4 w-4" aria-hidden />
        Supporting documents
      </p>
      <ul className="space-y-2">
        {documents.map((doc, index) => {
          const viewUrl = resolveMediaViewUrl(doc.previewUrl, doc.url);
          const downloadUrl = toProxyUrl(doc.url) ?? doc.url;
          const showPreview = isImageDocument(doc);

          return (
            <li
              key={`${doc.url}-${index}`}
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
              {showPreview && viewUrl ? (
                <div className="border-t px-3 pb-3 pt-2">
                  <CachedMediaPreview
                    previewUrl={doc.previewUrl}
                    authUrl={doc.url}
                    alt={doc.name}
                    maxHeight="max-h-40"
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
