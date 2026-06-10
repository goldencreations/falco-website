"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  Phone,
  Shield,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ApplicationViewRow, CollateralRow, GuarantorRow, ReferenceRow } from "@/lib/application-adapters";
import {
  documentTypeFromRow,
  formatRequiredDocumentLabel,
} from "@/lib/application-documents";
import {
  buildApplicationChecklist,
  canDeleteApplication,
  getApplicationWorkflowActions,
} from "@/lib/application-workflow";
import { toProxyUrl } from "@/lib/document-proxy";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import type { LoanApplicationStatus } from "@/lib/types";

/**
 * Renders an image preview.
 * - `src` is tried first (e.g. backend preview_url, usable without auth).
 * - If `src` fails (expired signed URL, CORS, etc.) and `fallbackSrc` is
 *   provided, falls back to it automatically (e.g. proxy URL with Bearer token).
 * - Collapses to nothing if both fail, or if the content is not an image (PDF).
 */
function DocumentPreview({
  src,
  fallbackSrc,
  alt,
}: {
  src: string;
  fallbackSrc?: string | null;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  const [triedFallback, setTriedFallback] = useState(false);

  if (failed) return null;

  const activeSrc = triedFallback && fallbackSrc ? fallbackSrc : src;

  return (
    <div className="border-t bg-muted/20 px-3 pb-3 pt-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={activeSrc}
        alt={alt}
        className="max-h-48 w-full rounded-md object-contain"
        onError={() => {
          if (!triedFallback && fallbackSrc) {
            setTriedFallback(true);
          } else {
            setFailed(true);
          }
        }}
      />
    </div>
  );
}

export const applicationStatusConfig: Record<
  LoanApplicationStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }
> = {
  draft: { label: "Draft", variant: "outline", icon: FileText },
  submitted: { label: "Submitted", variant: "secondary", icon: Clock },
  under_review: { label: "Under Review", variant: "secondary", icon: Clock },
  approved: { label: "Approved", variant: "default", icon: CheckCircle },
  pending_disbursement: { label: "Pending disbursement", variant: "default", icon: CheckCircle },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
  disbursed: { label: "Disbursed", variant: "default", icon: CheckCircle },
  cancelled: { label: "Cancelled", variant: "outline", icon: XCircle },
};

type ApplicationDetailPanelProps = {
  application: ApplicationViewRow;
  assignedOfficer: string;
  detailLoading: boolean;
  effectiveRole: string;
  userId?: string;
  userFullName: string;
  actionBusyId: string | null;
  applicationsNewPath: string;
  onAdminActivate: (app: ApplicationViewRow) => void;
  onWorkflowAction: (
    appId: string,
    action: () => Promise<{ ok: boolean; error?: string }>
  ) => void;
  onDelete: (app: ApplicationViewRow) => void;
  onExportPdf: () => void;
};

export function ApplicationDetailPanel({
  application,
  assignedOfficer,
  detailLoading,
  effectiveRole,
  userId,
  userFullName,
  actionBusyId,
  applicationsNewPath,
  onAdminActivate,
  onWorkflowAction,
  onDelete,
  onExportPdf,
}: ApplicationDetailPanelProps) {
  const status = applicationStatusConfig[application.status];

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="relative border-b bg-gradient-to-r from-emerald-950/95 via-emerald-900 to-emerald-950 px-4 pb-5 pt-5 text-primary-foreground sm:px-6 sm:pb-6 sm:pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-widest text-emerald-100/90">
              Loan application record
            </p>
            <h1 className="text-left text-xl font-semibold tracking-tight text-white">
              {application.application_number}
            </h1>
            <p className="text-left text-sm text-emerald-100/90">
              {application.customerDisplayName} · {application.productName}
            </p>
          </div>
          <Badge
            className="w-fit border-white/20 bg-white/15 text-white backdrop-blur-sm hover:bg-white/20"
            variant="outline"
          >
            {status.label}
          </Badge>
        </div>
        <p className="pointer-events-none absolute bottom-2 right-4 hidden rotate-[-10deg] select-none border-2 border-white/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.25em] text-white/25 sm:right-6 sm:block">
          Falco Financial
        </p>
      </div>

      <div className="px-4 py-5 sm:px-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Amount & terms
              </h4>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                {formatCurrency(application.requested_amount)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Requested over {application.term_days} days
              </p>
            </div>
            <Separator />
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Purpose</dt>
                <dd className="text-right font-medium">
                  {application.purpose?.trim() &&
                  application.purpose.trim().toLowerCase() !== "general purpose" ? (
                    application.purpose
                  ) : (
                    <Badge variant="outline" className="font-normal">
                      Required — add purpose
                    </Badge>
                  )}
                </dd>
              </div>
            </dl>
          </div>
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Applicant & workflow
            </h4>
            <dl className="grid gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Customer</dt>
                <dd className="font-medium">{application.customerDisplayName}</dd>
                <dd className="text-xs text-muted-foreground">{application.customerNumber}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Branch</dt>
                <dd>{application.branchName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Loan product</dt>
                <dd className="font-medium">
                  {application.productName || "—"}
                  {application.product_id ? (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      (#{application.product_id})
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created by</dt>
                <dd>{application.creatorName || application.created_by}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Assigned loan officer</dt>
                <dd>{assignedOfficer}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDateTime(application.created_at)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Collateral section */}
        {application.collaterals && application.collaterals.length > 0 ? (
          <>
            <Separator className="my-5" />
            <div className="space-y-3">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                Collateral
              </h4>
              <ul className="space-y-2 text-sm">
                {application.collaterals.map((col: CollateralRow, i: number) => {
                  const downloadUrl = col.image_url ? toProxyUrl(col.image_url) : null;
                  return (
                    <li key={col.id ?? i} className="overflow-hidden rounded-lg border">
                      <div className="flex flex-wrap items-start justify-between gap-2 bg-muted/20 px-3 py-2.5">
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-medium capitalize">{col.type}</p>
                          {col.description && col.description !== col.type ? (
                            <p className="text-xs text-muted-foreground">{col.description}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {col.estimated_value != null && col.estimated_value > 0 ? (
                            <span className="text-sm font-semibold tabular-nums">
                              {formatCurrency(col.estimated_value)}
                            </span>
                          ) : null}
                          {downloadUrl ? (
                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" asChild>
                              <a href={downloadUrl} download aria-label="Download collateral image">
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      {col.image_preview_url ? (
                        // preview_url works directly; if it expires, fall back to proxy
                        <DocumentPreview
                          src={col.image_preview_url}
                          fallbackSrc={downloadUrl}
                          alt={col.type}
                        />
                      ) : downloadUrl ? (
                        <DocumentPreview src={downloadUrl} alt={col.type} />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        ) : null}

        {/* Guarantors section */}
        {application.guarantors && application.guarantors.length > 0 ? (
          <>
            <Separator className="my-5" />
            <div className="space-y-3">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                Guarantors
              </h4>
              <ul className="space-y-2 text-sm">
                {application.guarantors.map((g: GuarantorRow, i: number) => {
                  const frontDownloadUrl = g.id_front_url ? toProxyUrl(g.id_front_url) : null;
                  const backDownloadUrl = g.id_back_url ? toProxyUrl(g.id_back_url) : null;
                  const legacyProxyUrl = !g.id_front_preview_url && g.document_url ? toProxyUrl(g.document_url) : null;
                  return (
                    <li key={g.id ?? i} className="overflow-hidden rounded-lg border">
                      <div className="px-3 py-2.5 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{g.full_name}</p>
                          {g.relationship ? (
                            <Badge variant="outline" className="text-xs capitalize">
                              {g.relationship}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {g.phone ? (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {g.phone}
                            </span>
                          ) : null}
                          {g.national_id ? (
                            <span>ID: {g.national_id}</span>
                          ) : null}
                          {g.address ? (
                            <span>{g.address}</span>
                          ) : null}
                        </div>
                      </div>
                      {/* ID front */}
                      {g.id_front_preview_url || frontDownloadUrl ? (
                        <div className="border-t">
                          <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground">
                            <span>ID Front</span>
                            {frontDownloadUrl ? (
                              <Button type="button" variant="ghost" size="sm" className="h-6 px-2" asChild>
                                <a href={frontDownloadUrl} download aria-label="Download ID front">
                                  <Download className="h-3 w-3" />
                                </a>
                              </Button>
                            ) : null}
                          </div>
                          {g.id_front_preview_url ? (
                            <DocumentPreview
                              src={g.id_front_preview_url}
                              fallbackSrc={frontDownloadUrl}
                              alt={`${g.full_name} ID front`}
                            />
                          ) : frontDownloadUrl ? (
                            <DocumentPreview src={frontDownloadUrl} alt={`${g.full_name} ID front`} />
                          ) : null}
                        </div>
                      ) : null}
                      {/* ID back */}
                      {g.id_back_preview_url || backDownloadUrl ? (
                        <div className="border-t">
                          <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground">
                            <span>ID Back</span>
                            {backDownloadUrl ? (
                              <Button type="button" variant="ghost" size="sm" className="h-6 px-2" asChild>
                                <a href={backDownloadUrl} download aria-label="Download ID back">
                                  <Download className="h-3 w-3" />
                                </a>
                              </Button>
                            ) : null}
                          </div>
                          {g.id_back_preview_url ? (
                            <DocumentPreview
                              src={g.id_back_preview_url}
                              fallbackSrc={backDownloadUrl}
                              alt={`${g.full_name} ID back`}
                            />
                          ) : backDownloadUrl ? (
                            <DocumentPreview src={backDownloadUrl} alt={`${g.full_name} ID back`} />
                          ) : null}
                        </div>
                      ) : null}
                      {/* Legacy single-document fallback for older API responses */}
                      {legacyProxyUrl ? (
                        <DocumentPreview src={legacyProxyUrl} alt={`${g.full_name} document`} />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        ) : null}

        {/* References section */}
        {application.references && application.references.length > 0 ? (
          <>
            <Separator className="my-5" />
            <div className="space-y-3">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                References
              </h4>
              <ul className="space-y-2 text-sm">
                {application.references.map((r: ReferenceRow, i: number) => (
                  <li key={r.id ?? i} className="rounded-lg border px-3 py-2.5 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{r.full_name}</p>
                      {r.relationship ? (
                        <Badge variant="outline" className="text-xs capitalize">
                          {r.relationship}
                        </Badge>
                      ) : null}
                    </div>
                    {r.phone ? (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {r.phone}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}

        {/* Uploaded documents — shown last so collateral/guarantor images appear first */}
        <Separator className="my-5" />
        <div className="space-y-3">
          {detailLoading ? (
            <p className="text-sm text-muted-foreground">Loading documents…</p>
          ) : application.documents?.length ? (
            <ul className="space-y-3 text-sm">
              {[...application.documents]
                .sort((a, b) =>
                  formatRequiredDocumentLabel(documentTypeFromRow(a)).localeCompare(
                    formatRequiredDocumentLabel(documentTypeFromRow(b))
                  )
                )
                .map((doc) => {
                const hasUrl = Boolean(doc.url);
                const proxyUrl = hasUrl ? toProxyUrl(doc.url) : null;
                const label = formatRequiredDocumentLabel(documentTypeFromRow(doc));
                return (
                  <li
                    key={doc.id || `${doc.type}-${doc.name}`}
                    className="overflow-hidden rounded-lg border"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{label}</p>
                          {doc.name ? (
                            <p className="text-xs text-muted-foreground truncate">{doc.name}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {doc.verified ? (
                          <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-300">
                            Pending
                          </Badge>
                        )}
                        {proxyUrl ? (
                          <>
                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" asChild>
                              <a href={proxyUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" />
                                <span className="sr-only">View</span>
                              </a>
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2" asChild>
                              <a href={proxyUrl} download={doc.name ?? true}>
                                <Download className="h-3.5 w-3.5" />
                                <span className="sr-only">Download</span>
                              </a>
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                    {proxyUrl ? <DocumentPreview src={proxyUrl} alt={label} /> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
          )}
        </div>

        {application.status === "draft" ? (
          <>
            <Separator className="my-5" />
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Application checklist
              </h4>
              <div className="flex flex-wrap gap-2">
                {buildApplicationChecklist(
                  application,
                  effectiveRole,
                  application.required_documents
                ).map((item) => (
                  <Badge
                    key={item.key}
                    variant={item.complete ? "default" : "outline"}
                    className={
                      item.complete
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "border-amber-300 text-amber-900"
                    }
                  >
                    {item.complete ? "✓ " : "○ "}
                    {item.label}
                    {!item.complete && item.hint ? ` — ${item.hint}` : ""}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {(application.review_notes || application.rejection_reason) && (
          <>
            <Separator className="my-5" />
            <div className="space-y-3">
              {application.review_notes && (
                <div className="rounded-lg border bg-background p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Review notes
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm">{application.review_notes}</p>
                </div>
              )}
              {application.rejection_reason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                    Rejection reason
                  </p>
                  <p className="mt-1 text-sm text-destructive">{application.rejection_reason}</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-4 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-6">
        {application.status === "draft" ? (
          <Button asChild variant="secondary">
            <Link href={`${applicationsNewPath}?edit=${application.id}`}>
              <Pencil className="mr-2 h-4 w-4" />
              Continue draft
            </Link>
          </Button>
        ) : null}
        {application.status === "pending_disbursement" ? (
          <Button className="bg-emerald-600 hover:bg-emerald-700" asChild>
            <Link
              href={
                application.loan_id
                  ? `/disbursements?loanId=${encodeURIComponent(application.loan_id)}`
                  : "/disbursements"
              }
            >
              Create disbursement
            </Link>
          </Button>
        ) : null}
        {getApplicationWorkflowActions(application, effectiveRole, userFullName).map((wf) => (
          <Button
            key={wf.id}
            variant={wf.variant === "destructive" ? "destructive" : "default"}
            className={wf.variant === "destructive" ? undefined : "bg-emerald-600 hover:bg-emerald-700"}
            disabled={actionBusyId === application.id}
            onClick={() =>
              void (wf.id === "admin_activate"
                ? onAdminActivate(application)
                : onWorkflowAction(application.id, wf.run))
            }
          >
            {actionBusyId === application.id ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {wf.label}
          </Button>
        ))}
        <Button variant="outline" onClick={onExportPdf}>
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
        {canDeleteApplication(effectiveRole, application, userId) ? (
          <Button
            variant="destructive"
            disabled={actionBusyId === application.id}
            onClick={() => onDelete(application)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete application
          </Button>
        ) : null}
      </div>
    </div>
  );
}
