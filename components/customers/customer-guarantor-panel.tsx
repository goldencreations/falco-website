"use client";

import { Download, ExternalLink, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import {
  CachedMediaPreview,
  resolveMediaViewUrl,
} from "@/components/media/cached-media-preview";
import type { CustomerGuarantorRow } from "@/lib/customer-profile-extras";
import { toProxyUrl } from "@/lib/document-proxy";

function GuarantorPhotoBlock({
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
        <User className="h-4 w-4 text-muted-foreground" aria-hidden />
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

export function CustomerGuarantorPanel({ rows }: { rows: CustomerGuarantorRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Guarantor details & attachment</CardTitle>
          <CardDescription>
            Guarantors registered at customer onboarding and from loan applications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Guarantor information from loan applications will appear here when available.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <Card key={`${row.applicationNumber}-${row.name}-${row.phone}`}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              {row.name}
            </CardTitle>
            <CardDescription>Application {row.applicationNumber}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="w-40 text-muted-foreground">National ID</TableCell>
                  <TableCell className="font-mono text-sm">{row.nationalId}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Phone</TableCell>
                  <TableCell>{row.phone}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Relationship</TableCell>
                  <TableCell className="capitalize">{row.relationship}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Address</TableCell>
                  <TableCell>{row.address}</TableCell>
                </TableRow>
                {row.collateralType ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground">Collateral type</TableCell>
                    <TableCell>{row.collateralType}</TableCell>
                  </TableRow>
                ) : null}
                {row.collateralDescription ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground">Collateral description</TableCell>
                    <TableCell>{row.collateralDescription}</TableCell>
                  </TableRow>
                ) : null}
                {row.collateralEstimatedValue != null && row.collateralEstimatedValue > 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground">Collateral value</TableCell>
                    <TableCell>
                      TSh {row.collateralEstimatedValue.toLocaleString("en-TZ")}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>

            {row.documents.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">National ID photos</p>
                <div className="grid gap-4 md:grid-cols-2">
                  {row.documents.map((doc) => (
                    <GuarantorPhotoBlock
                      key={`${doc.name}-${doc.url}`}
                      title={doc.name}
                      authUrl={doc.url}
                      previewUrl={doc.previewUrl}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No guarantor ID photos on this customer record yet. Add ID front and back when
                registering or editing the customer; they are stored on{" "}
                <span className="font-mono text-[11px]">id_front_document_id</span> /{" "}
                <span className="font-mono text-[11px]">id_back_document_id</span>.
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
