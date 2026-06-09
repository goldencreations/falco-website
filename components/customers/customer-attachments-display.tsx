"use client";

import { Download, ExternalLink, FileText, Home, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CustomerAttachmentDisplay } from "@/lib/customer-attachments";

type Props = {
  attachments: CustomerAttachmentDisplay;
};

function PhotoBlock({ title, url, icon }: { title: string; url: string; icon: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {title}
      </p>
      <div className="overflow-hidden rounded-md border bg-muted/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={title} className="max-h-56 w-full object-cover" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            View
          </a>
        </Button>
        <Button type="button" variant="secondary" size="sm" asChild>
          <a href={url} download>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download
          </a>
        </Button>
      </div>
    </div>
  );
}

export function CustomerAttachmentsDisplay({ attachments }: Props) {
  const { homeLocationPhotoUrl, businessLocationPhotoUrl, supportingDocuments } = attachments;

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
              url={homeLocationPhotoUrl}
              icon={<Home className="h-4 w-4 text-emerald-700" aria-hidden />}
            />
          ) : null}
          {businessLocationPhotoUrl ? (
            <PhotoBlock
              title="Business location photo"
              url={businessLocationPhotoUrl}
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
            <ul className="divide-y rounded-md border">
              {supportingDocuments.map((doc) => (
                <li
                  key={doc.url}
                  className="flex flex-col gap-2 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0 truncate font-medium">{doc.name}</span>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <a href={doc.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        View
                      </a>
                    </Button>
                    <Button type="button" variant="secondary" size="sm" asChild>
                      <a href={doc.url} download>
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Download
                      </a>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
