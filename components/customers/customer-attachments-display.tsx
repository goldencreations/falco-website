"use client";

import {
  Download,
  ExternalLink,
  FileText,
  Home,
  Shield,
  Store,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  CachedMediaPreview,
  resolveMediaViewUrl,
} from "@/components/media/cached-media-preview";
import { documentTypeFromRow, formatRequiredDocumentLabel } from "@/lib/application-documents";
import { shouldShowGuarantorLegacyDocument } from "@/lib/application-detail-display";
import type { CustomerProfileAttachments } from "@/lib/customer-profile-attachments";
import { toProxyUrl } from "@/lib/document-proxy";

type Props = {
  attachments: CustomerProfileAttachments;
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
    passportPhotoUrl,
    passportPhotoPreviewUrl,
    homeLocationPhotos,
    businessLocationPhotos,
    supportingDocuments,
    applicationAttachments,
  } = attachments;

  const hasProfilePhotos = Boolean(
    passportPhotoUrl || homeLocationPhotos.length > 0 || businessLocationPhotos.length > 0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Attachment / Uploads</CardTitle>
        <CardDescription>
          Customer profile photos, supporting documents, and files from loan applications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasProfilePhotos ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {passportPhotoUrl ? (
              <PhotoBlock
                title="Passport photo"
                authUrl={passportPhotoUrl}
                previewUrl={passportPhotoPreviewUrl}
                icon={<User className="h-4 w-4 text-sky-700" aria-hidden />}
              />
            ) : null}
            {homeLocationPhotos.map((photo, index) => (
              <PhotoBlock
                key={`${photo.url}-${index}`}
                title={
                  homeLocationPhotos.length > 1
                    ? `Home location photo (${index + 1})`
                    : "Home location photo"
                }
                authUrl={photo.url}
                previewUrl={photo.previewUrl}
                icon={<Home className="h-4 w-4 text-emerald-700" aria-hidden />}
              />
            ))}
            {businessLocationPhotos.map((photo, index) => (
              <PhotoBlock
                key={`${photo.url}-${index}`}
                title={
                  businessLocationPhotos.length > 1
                    ? `Business location photo (${index + 1})`
                    : "Business location photo"
                }
                authUrl={photo.url}
                previewUrl={photo.previewUrl}
                icon={<Store className="h-4 w-4 text-amber-700" aria-hidden />}
              />
            ))}
          </div>
        ) : null}

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

        {applicationAttachments.map((app, index) => {
          const collateralPhotos = app.collaterals.filter(
            (c) => c.image_url || c.image_preview_url
          );
          const guarantorPhotos = app.guarantors.flatMap((g) => {
            const items: Array<{
              key: string;
              title: string;
              authUrl: string;
              previewUrl?: string | null;
            }> = [];
            if (g.id_front_url || g.id_front_preview_url) {
              items.push({
                key: `${g.id ?? g.full_name}-front`,
                title: `${g.full_name} — ID front`,
                authUrl: g.id_front_url ?? g.id_front_preview_url ?? "",
                previewUrl: g.id_front_preview_url ?? g.id_front_url,
              });
            }
            if (g.id_back_url || g.id_back_preview_url) {
              items.push({
                key: `${g.id ?? g.full_name}-back`,
                title: `${g.full_name} — ID back`,
                authUrl: g.id_back_url ?? g.id_back_preview_url ?? "",
                previewUrl: g.id_back_preview_url ?? g.id_back_url,
              });
            }
            if (g.photo_url || g.photo_preview_url) {
              items.push({
                key: `${g.id ?? g.full_name}-photo`,
                title: `${g.full_name} — Photo`,
                authUrl: g.photo_url ?? g.photo_preview_url ?? "",
                previewUrl: g.photo_preview_url ?? g.photo_url,
              });
            }
            if (g.photo_with_customer_url || g.photo_with_customer_preview_url) {
              items.push({
                key: `${g.id ?? g.full_name}-with-customer`,
                title: `${g.full_name} — Passport photo`,
                authUrl: g.photo_with_customer_url ?? g.photo_with_customer_preview_url ?? "",
                previewUrl: g.photo_with_customer_preview_url ?? g.photo_with_customer_url,
              });
            }
            if (g.ward_letter_url || g.ward_letter_preview_url) {
              items.push({
                key: `${g.id ?? g.full_name}-ward-letter`,
                title: `${g.full_name} — Ward letter`,
                authUrl: g.ward_letter_url ?? g.ward_letter_preview_url ?? "",
                previewUrl: g.ward_letter_preview_url ?? g.ward_letter_url,
              });
            }
            for (const [attachmentIndex, url] of (g.attachment_urls ?? []).entries()) {
              items.push({
                key: `${g.id ?? g.full_name}-attachment-${attachmentIndex}`,
                title: `${g.full_name} — Attachment ${attachmentIndex + 1}`,
                authUrl: url,
              });
            }
            if (shouldShowGuarantorLegacyDocument(g) && g.document_url) {
              items.push({
                key: `${g.id ?? g.full_name}-legacy`,
                title: `${g.full_name} — ID document`,
                authUrl: g.document_url,
              });
            }
            return items;
          });
          const appDocuments = app.documents.filter((d) => d.url || d.preview_url);

          return (
            <div key={app.applicationId} className="space-y-4">
              {index > 0 || hasProfilePhotos || supportingDocuments.length > 0 ? (
                <Separator />
              ) : null}
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  Application {app.applicationNumber}
                </p>
                {app.productName ? (
                  <p className="text-xs text-muted-foreground">{app.productName}</p>
                ) : null}
              </div>

              {collateralPhotos.length > 0 ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Shield className="h-4 w-4 text-primary" aria-hidden />
                    Collateral
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    {collateralPhotos.map((col, i) => {
                      const authUrl = col.image_url ?? col.image_preview_url ?? "";
                      const title = col.description
                        ? `Collateral — ${col.type}: ${col.description}`
                        : `Collateral — ${col.type}`;
                      return (
                        <PhotoBlock
                          key={col.id ?? `${col.type}-${i}`}
                          title={title}
                          authUrl={authUrl}
                          previewUrl={col.image_preview_url}
                          icon={<Shield className="h-4 w-4 text-primary" aria-hidden />}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {guarantorPhotos.length > 0 ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <User className="h-4 w-4 text-muted-foreground" aria-hidden />
                    Guarantor ID documents
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    {guarantorPhotos.map((item) => (
                      <PhotoBlock
                        key={item.key}
                        title={item.title}
                        authUrl={item.authUrl}
                        previewUrl={item.previewUrl}
                        icon={<User className="h-4 w-4 text-muted-foreground" aria-hidden />}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {appDocuments.length > 0 ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
                    Application documents
                  </p>
                  <ul className="space-y-2">
                    {appDocuments.map((doc) => {
                      const url = doc.url ?? doc.preview_url!;
                      const name =
                        doc.name?.trim() ||
                        formatRequiredDocumentLabel(documentTypeFromRow(doc));
                      return (
                        <DocumentRow
                          key={doc.id ?? `${name}-${url}`}
                          name={name}
                          url={url}
                          previewUrl={doc.preview_url}
                        />
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
