"use client";

import { Download, ExternalLink, FileText, Home, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CachedMediaPreview,
  resolveMediaViewUrl,
} from "@/components/media/cached-media-preview";
import type { CustomerAttachmentDisplay } from "@/lib/customer-attachments";
import { toProxyUrl } from "@/lib/document-proxy";

type Props = {
  attachments: CustomerAttachmentDisplay;
};

function PhotoBlock({
  title,
  authUrl,
  previewUrl,
  icon,
}: {
  title: string;
  authUrl: string;
  previewUrl?: string | null;
  icon: React.ReactNode;
}) {
  const viewUrl = resolveMediaViewUrl(previewUrl, authUrl);
  const downloadUrl = toProxyUrl(authUrl) ?? authUrl;

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {title}
      </p>
      <CachedMediaPreview
        previewUrl={previewUrl}
        authUrl={authUrl}
        alt={title}
        maxHeight="max-h-56"
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
}

function DocumentRow({
  name,
  url,
  previewUrl,
}: {
  name: string;
  url: string;
  previewUrl?: string | null;
}) {
  const viewUrl = resolveMediaViewUrl(previewUrl, url);
  const downloadUrl = toProxyUrl(url) ?? url;

  return (
    <li className="overflow-hidden rounded-lg border">
      <div className="flex flex-col gap-2 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0 truncate font-medium">{name}</span>
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
      {viewUrl ? (
        <div className="border-t px-3 pb-3 pt-2">
          <CachedMediaPreview previewUrl={previewUrl} authUrl={url} alt={name} />
        </div>
      ) : null}
    </li>
  );
}

export function CustomerAttachmentsDisplay({ attachments }: Props) {
  const {
    homeLocationPhotoUrl,
    homeLocationPhotoPreviewUrl,
    businessLocationPhotoUrl,
    businessLocationPhotoPreviewUrl,
    supportingDocuments,
  } = attachments;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Attachments</CardTitle>
        <CardDescription>Home and business location photos and supporting documents on file.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {homeLocationPhotoUrl ? (
            <PhotoBlock
              title="Home location photo"
              authUrl={homeLocationPhotoUrl}
              previewUrl={homeLocationPhotoPreviewUrl}
              icon={<Home className="h-4 w-4 text-emerald-700" aria-hidden />}
            />
          ) : null}
          {businessLocationPhotoUrl ? (
            <PhotoBlock
              title="Business location photo"
              authUrl={businessLocationPhotoUrl}
              previewUrl={businessLocationPhotoPreviewUrl}
              icon={<Store className="h-4 w-4 text-amber-700" aria-hidden />}
            />
          ) : null}
        </div>

        {supportingDocuments.length > 0 ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
              Supporting documents
            </p>
            <ul className="space-y-2">
              {supportingDocuments.map((doc) => (
                <DocumentRow
                  key={doc.url}
                  name={doc.name}
                  url={doc.url}
                  previewUrl={doc.previewUrl}
                />
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
