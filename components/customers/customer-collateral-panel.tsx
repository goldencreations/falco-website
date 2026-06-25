"use client";

import { Download, ExternalLink, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CachedMediaPreview,
  resolveMediaViewUrl,
} from "@/components/media/cached-media-preview";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CustomerCollateralRow } from "@/lib/customer-profile-extras";
import { dedupeMediaUrls } from "@/lib/customer-collateral";
import { toProxyUrl } from "@/lib/document-proxy";
import { formatCurrency } from "@/lib/formatters";

function CollateralPhotoBlock({
  title,
  authUrl,
  previewUrl,
}: {
  title: string;
  authUrl: string;
  previewUrl?: string | null;
}) {
  const viewUrl = resolveMediaViewUrl(previewUrl, authUrl);
  const downloadUrl = toProxyUrl(authUrl) ?? authUrl;

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Shield className="h-4 w-4 text-primary" aria-hidden />
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

export function CustomerCollateralPanel({ rows }: { rows: CustomerCollateralRow[] }) {
  const rowsWithImages = rows.filter(
    (row) =>
      (Array.isArray(row.image_urls) && row.image_urls.length > 0) ||
      row.image_url ||
      row.image_preview_url
  );

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Collateral</CardTitle>
          <CardDescription>No collateral records linked to this customer&apos;s applications yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Collateral from loan applications will appear here when available.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4 text-primary" />
          Collateral
        </CardTitle>
        <CardDescription>
          Collateral registered on this customer profile and from loan applications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-0 sm:p-6 sm:pt-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Application</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.applicationNumber}-${row.type}-${row.description}`}>
                <TableCell className="font-mono text-xs">{row.applicationNumber}</TableCell>
                <TableCell>{row.type}</TableCell>
                <TableCell className="max-w-xs truncate">{row.description}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(row.value)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {row.status.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {rowsWithImages.length > 0 ? (
          <div className="space-y-3 border-t px-6 pb-6 pt-4 sm:px-0 sm:pb-0">
            <p className="text-sm font-medium">Collateral photos</p>
            <div className="grid gap-4 md:grid-cols-2">
              {rowsWithImages.map((row) => {
                const title = row.description
                  ? `${row.type}: ${row.description}`
                  : row.type;
                const imageUrls = dedupeMediaUrls(
                  row.image_urls && row.image_urls.length > 0
                    ? row.image_urls
                    : [row.image_url ?? row.image_preview_url ?? ""].filter(Boolean)
                );
                return imageUrls.map((authUrl, idx) => (
                  <CollateralPhotoBlock
                    key={`${row.applicationNumber}-${row.type}-${row.description}-photo-${idx}`}
                    title={imageUrls.length > 1 ? `${title} (${idx + 1})` : title}
                    authUrl={authUrl}
                    previewUrl={authUrl}
                  />
                ));
              })}
            </div>
          </div>
        ) : (
          <p className="border-t px-6 pb-6 pt-4 text-xs text-muted-foreground sm:px-0 sm:pb-0">
            No collateral photos on file yet. Add an image when registering the customer or on a loan
            application.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
