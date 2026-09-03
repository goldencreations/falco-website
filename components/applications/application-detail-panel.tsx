"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CachedMediaPreview, resolveMediaViewUrl } from "@/components/media/cached-media-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApplicationViewRow, CollateralRow, GuarantorRow, ReferenceRow } from "@/lib/application-adapters";
import {
  documentTypeFromRow,
  formatRequiredDocumentLabel,
} from "@/lib/application-documents";
import {
  buildApplicationChecklist,
  canEditApplicationLoanDetails,
  canDeleteApplication,
  getApplicationWorkflowActions,
  type ApplicationWorkflowAction,
} from "@/lib/application-workflow";
import {
  applicationAgingBucketLabel,
  applicationOperationalStatusLabel,
} from "@/lib/application-status";
import {
  dedupeCollateralRows,
  dedupeGuarantorRows,
  filterDocumentsForDetailPanel,
  shouldShowGuarantorLegacyDocument,
} from "@/lib/application-detail-display";
import { toProxyUrl } from "@/lib/document-proxy";
import { formatCurrency, formatDateTime, formatTermDays } from "@/lib/formatters";
import { resolvePortalPath } from "@/lib/portal-paths";
import type { LoanApplicationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Banknote,
  Building2,
  Calendar,
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

function DocumentPreview({
  previewUrl,
  authUrl,
  alt,
}: {
  previewUrl?: string | null;
  authUrl?: string | null;
  alt: string;
}) {
  if (!previewUrl && !authUrl) return null;
  return (
    <div className="border-t bg-muted/20 px-3 pb-3 pt-2">
      <CachedMediaPreview
        previewUrl={previewUrl}
        authUrl={authUrl}
        alt={alt}
        className="border-0 bg-transparent"
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
  approved: { label: "Awaiting Treasury", variant: "default", icon: CheckCircle },
  pending_disbursement: { label: "Ready for Disbursement", variant: "default", icon: CheckCircle },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
  disbursed: { label: "Disbursed", variant: "default", icon: CheckCircle },
  cancelled: { label: "Cancelled", variant: "outline", icon: XCircle },
};

function statusBadgeClass(status: LoanApplicationStatus): string {
  switch (status) {
    case "approved":
    case "pending_disbursement":
    case "disbursed":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "rejected":
      return "border-red-200 bg-red-50 text-red-800";
    case "under_review":
    case "submitted":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "draft":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-muted bg-muted/50 text-muted-foreground";
  }
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("text-right font-medium", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Banknote;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          <p className="truncate text-lg font-bold tabular-nums tracking-tight text-foreground sm:text-xl">
            {value}
          </p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
    </div>
  );
}

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
  onRejectRequest: (app: ApplicationViewRow, run: ApplicationWorkflowAction["run"]) => void;
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
  onRejectRequest,
}: ApplicationDetailPanelProps) {
  const status = applicationStatusConfig[application.status];
  const StatusIcon = status.icon;
  const statusLabel = applicationOperationalStatusLabel(
    application.status,
    application.operational_state,
    status.label
  );
  const agingLabel = applicationAgingBucketLabel(application.aging_bucket);
  const customerPhotoUrl = resolveMediaViewUrl(
    application.customerPassportPhotoPreviewUrl,
    application.customerPassportPhotoUrl
  );
  const customerInitials = application.customerDisplayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "C";
  const customerHref = resolvePortalPath(
    effectiveRole as Parameters<typeof resolvePortalPath>[0],
    `/customers/${application.customer_id}`
  );
  const canEditLoanDetails = canEditApplicationLoanDetails(application);
  const editLoanDetailsHref = `${applicationsNewPath}?edit=${encodeURIComponent(application.id)}&mode=loan-details`;

  const collaterals = useMemo(
    () => dedupeCollateralRows(application.collaterals ?? []),
    [application.collaterals]
  );
  const guarantors = useMemo(
    () => dedupeGuarantorRows(application.guarantors ?? []),
    [application.guarantors]
  );
  const standaloneDocuments = useMemo(
    () =>
      filterDocumentsForDetailPanel(application.documents ?? [], collaterals, guarantors).sort(
        (a, b) =>
          formatRequiredDocumentLabel(documentTypeFromRow(a)).localeCompare(
            formatRequiredDocumentLabel(documentTypeFromRow(b))
          )
      ),
    [application.documents, collaterals, guarantors]
  );

  const securityCount = collaterals.length + guarantors.length + (application.references?.length ?? 0);
  const verifiedDocCount = standaloneDocuments.filter((d) => d.verified).length;

  const summaryMetrics = useMemo(() => {
    const items: { label: string; value: string; hint?: string; icon: typeof Banknote }[] = [
      {
        label: "Requested amount",
        value: formatCurrency(application.requested_amount),
        icon: Banknote,
      },
    ];
    if (application.approved_amount != null) {
      items.push({
        label: "Approved amount",
        value: formatCurrency(application.approved_amount),
        icon: CheckCircle,
      });
    }
    items.push({
      label: "Loan term",
      value: formatTermDays(application.term_days),
      hint: `${application.term_days} days`,
      icon: Calendar,
    });
    if (application.installment_amount) {
      items.push({
        label: "Installment",
        value: formatCurrency(application.installment_amount),
        icon: Banknote,
      });
    }
    items.push({
      label: "Documents",
      value: `${standaloneDocuments.length} uploaded`,
      hint:
        standaloneDocuments.length > 0
          ? `${verifiedDocCount} verified`
          : "None uploaded yet",
      icon: FileText,
    });
    return items.slice(0, 4);
  }, [
    application.approved_amount,
    application.installment_amount,
    application.requested_amount,
    application.term_days,
    standaloneDocuments.length,
    verifiedDocCount,
  ]);

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <Card className="overflow-hidden border-border/80 py-0 shadow-sm">
        <CardContent className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
              <Avatar className="h-16 w-16 shrink-0 ring-2 ring-primary/15 sm:h-20 sm:w-20">
                {customerPhotoUrl ? (
                  <AvatarImage
                    src={customerPhotoUrl}
                    alt={`${application.customerDisplayName} profile photo`}
                    className="object-cover"
                    loading="lazy"
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                  {customerInitials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-2">
                <p className="font-mono text-xs text-muted-foreground">{application.application_number}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="break-words text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                    {application.customerDisplayName}
                  </h1>
                  <Badge
                    variant="outline"
                    className={cn("gap-1", statusBadgeClass(application.status))}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {statusLabel}
                  </Badge>
                  {agingLabel ? (
                    <Badge variant="outline" className="gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {agingLabel}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {application.productName}
                  {application.branchName ? ` · ${application.branchName}` : ""}
                </p>
                <Button variant="link" className="h-auto p-0 text-sm" asChild>
                  <Link href={customerHref}>View customer profile</Link>
                </Button>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {canEditLoanDetails ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={editLoanDetailsHref}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit application
                  </Link>
                </Button>
              ) : null}
              {detailLoading ? (
                <Badge variant="secondary" className="w-fit gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Updating
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryMetrics.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                hint={metric.hint}
                icon={metric.icon}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-muted/40 p-1 sm:w-auto">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">
            Overview
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs sm:text-sm">
            Security & people
            {securityCount > 0 ? (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                {securityCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-xs sm:text-sm">
            Documents
            {standaloneDocuments.length > 0 ? (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                {standaloneDocuments.length}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/80 py-0 shadow-sm">
              <CardHeader className="border-b px-4 py-4 sm:px-5">
                <CardTitle className="text-base">Loan details</CardTitle>
                <CardDescription>Amount, purpose, and repayment terms</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-5">
                <dl className="divide-y">
                  <DetailRow label="Requested amount" value={formatCurrency(application.requested_amount)} />
                  {application.approved_amount != null ? (
                    <DetailRow label="Approved amount" value={formatCurrency(application.approved_amount)} />
                  ) : null}
                  <DetailRow label="Term" value={formatTermDays(application.term_days)} />
                  <DetailRow
                    label="Repayment frequency"
                    value={
                      application.repayment_frequency === "daily"
                        ? "Daily"
                        : application.repayment_frequency === "weekly"
                          ? "Weekly"
                          : application.repayment_frequency === "bi_weekly"
                            ? "Bi-weekly"
                            : application.repayment_frequency === "monthly"
                              ? "Monthly"
                              : "—"
                    }
                  />
                  {application.installment_amount ? (
                    <DetailRow
                      label="Installment"
                      value={formatCurrency(application.installment_amount)}
                    />
                  ) : null}
                  {application.total_repayment ? (
                    <DetailRow
                      label="Total repayment"
                      value={formatCurrency(application.total_repayment)}
                    />
                  ) : null}
                  <DetailRow
                    label="Purpose"
                    value={
                      application.purpose?.trim() &&
                      application.purpose.trim().toLowerCase() !== "general purpose" ? (
                        application.purpose
                      ) : (
                        <Badge variant="outline" className="font-normal">
                          Required — add purpose
                        </Badge>
                      )
                    }
                  />
                  {application.businessName ? (
                    <DetailRow label="Business" value={application.businessName} />
                  ) : null}
                  {application.monthlyIncome ? (
                    <DetailRow
                      label="Monthly income"
                      value={formatCurrency(application.monthlyIncome)}
                    />
                  ) : null}
                  {application.creditScore ? (
                    <DetailRow label="Credit score" value={String(application.creditScore)} />
                  ) : null}
                  {application.riskGrade ? (
                    <DetailRow label="Risk grade" value={String(application.riskGrade)} />
                  ) : null}
                </dl>
              </CardContent>
            </Card>

            <Card className="border-border/80 py-0 shadow-sm">
              <CardHeader className="border-b px-4 py-4 sm:px-5">
                <CardTitle className="text-base">Assignment & workflow</CardTitle>
                <CardDescription>Branch, product, and processing history</CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-5">
                <dl className="divide-y">
                  <DetailRow
                    label="Customer"
                    value={
                      <span>
                        {application.customerDisplayName}
                        <span className="mt-0.5 block font-mono text-xs font-normal text-muted-foreground">
                          {application.customerNumber}
                        </span>
                      </span>
                    }
                  />
                  <DetailRow
                    label="Branch"
                    value={
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {application.branchName}
                      </span>
                    }
                  />
                  <DetailRow
                    label="Loan product"
                    value={
                      <>
                        {application.productName || "—"}
                        {application.product_id ? (
                          <span className="mt-0.5 block font-mono text-xs font-normal text-muted-foreground">
                            #{application.product_id}
                          </span>
                        ) : null}
                      </>
                    }
                  />
                  <DetailRow label="Created by" value={application.creatorName || application.created_by} />
                  <DetailRow label="Assigned officer" value={assignedOfficer} />
                  <DetailRow label="Created" value={formatDateTime(application.created_at)} />
                  {application.submitted_at ? (
                    <DetailRow label="Submitted" value={formatDateTime(application.submitted_at)} />
                  ) : null}
                  {application.reviewed_at ? (
                    <DetailRow label="Reviewed" value={formatDateTime(application.reviewed_at)} />
                  ) : null}
                  {application.loan_number ? (
                    <DetailRow label="Loan number" value={application.loan_number} mono />
                  ) : null}
                </dl>
              </CardContent>
            </Card>
          </div>

          {application.status === "draft" ? (
            <Card className="border-border/80 py-0 shadow-sm">
              <CardHeader className="border-b px-4 py-4 sm:px-5">
                <CardTitle className="text-base">Application checklist</CardTitle>
                <CardDescription>Complete these items before submitting for review</CardDescription>
              </CardHeader>
              <CardContent className="px-4 py-4 sm:px-5">
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
              </CardContent>
            </Card>
          ) : null}

          {(application.review_notes || application.rejection_reason) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {application.review_notes ? (
                <Card className="border-border/80 py-0 shadow-sm">
                  <CardHeader className="px-4 py-4 sm:px-5">
                    <CardTitle className="text-base">Review notes</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 sm:px-5">
                    <p className="whitespace-pre-line text-sm text-foreground">
                      {application.review_notes}
                    </p>
                  </CardContent>
                </Card>
              ) : null}
              {application.rejection_reason ? (
                <Card className="border-destructive/30 bg-destructive/5 py-0 shadow-sm">
                  <CardHeader className="px-4 py-4 sm:px-5">
                    <CardTitle className="text-base text-destructive">Rejection reason</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 sm:px-5">
                    <p className="text-sm text-destructive">{application.rejection_reason}</p>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )}
        </TabsContent>

        <TabsContent value="security" className="mt-0 space-y-4">
          {collaterals.length > 0 ? (
            <Card className="border-border/80 py-0 shadow-sm">
              <CardHeader className="border-b px-4 py-4 sm:px-5">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Collateral
                </CardTitle>
                <CardDescription>{collaterals.length} item(s) pledged</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4 sm:p-5">
                <ul className="space-y-3 text-sm">
                  {collaterals.map((col: CollateralRow, i: number) => {
                    const downloadUrl = col.image_url ? toProxyUrl(col.image_url) : null;
                    return (
                      <li key={col.id ?? i} className="overflow-hidden rounded-lg border">
                        <div className="flex flex-wrap items-start justify-between gap-2 bg-muted/20 px-3 py-2.5">
                          <div className="min-w-0 space-y-0.5">
                            <p className="font-medium capitalize">{col.type}</p>
                            {col.description && col.description !== col.type ? (
                              <p className="text-xs text-muted-foreground">{col.description}</p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
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
                        {col.image_preview_url || col.image_url ? (
                          <DocumentPreview
                            previewUrl={col.image_preview_url}
                            authUrl={col.image_url}
                            alt={col.type}
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {guarantors.length > 0 ? (
            <Card className="border-border/80 py-0 shadow-sm">
              <CardHeader className="border-b px-4 py-4 sm:px-5">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Guarantors
                </CardTitle>
                <CardDescription>{guarantors.length} guarantor(s) on record</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-4 sm:p-5">
                <ul className="space-y-3 text-sm">
                  {guarantors.map((g: GuarantorRow, i: number) => {
                    const frontDownloadUrl = g.id_front_url ? toProxyUrl(g.id_front_url) : null;
                    const backDownloadUrl = g.id_back_url ? toProxyUrl(g.id_back_url) : null;
                    const photoDownloadUrl = g.photo_url ? toProxyUrl(g.photo_url) : null;
                    const photoWithCustomerDownloadUrl = g.photo_with_customer_url
                      ? toProxyUrl(g.photo_with_customer_url)
                      : null;
                    const wardLetterDownloadUrl = g.ward_letter_url ? toProxyUrl(g.ward_letter_url) : null;
                    const renderDocBlock = (
                      label: string,
                      previewUrl?: string,
                      authUrl?: string | null,
                      alt?: string
                    ) =>
                      previewUrl || authUrl ? (
                        <div className="border-t">
                          <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground">
                            <span>{label}</span>
                            {authUrl ? (
                              <Button type="button" variant="ghost" size="sm" className="h-6 px-2" asChild>
                                <a href={authUrl} download aria-label={`Download ${label}`}>
                                  <Download className="h-3 w-3" />
                                </a>
                              </Button>
                            ) : null}
                          </div>
                          <DocumentPreview
                            previewUrl={previewUrl}
                            authUrl={authUrl ?? undefined}
                            alt={alt ?? label}
                          />
                        </div>
                      ) : null;
                    return (
                      <li key={g.id ?? i} className="overflow-hidden rounded-lg border">
                        <div className="space-y-1 px-3 py-2.5">
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
                            {g.national_id ? <span>ID: {g.national_id}</span> : null}
                            {g.address ? <span>{g.address}</span> : null}
                          </div>
                          {g.collateral_type || g.collateral_description || g.collateral_estimated_value ? (
                            <div className="space-y-0.5 pt-1 text-xs text-muted-foreground">
                              {g.collateral_type ? <p>Collateral: {g.collateral_type}</p> : null}
                              {g.collateral_description ? <p>{g.collateral_description}</p> : null}
                              {g.collateral_estimated_value != null && g.collateral_estimated_value > 0 ? (
                                <p>Value: {formatCurrency(g.collateral_estimated_value)}</p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {renderDocBlock(
                          "ID Front",
                          g.id_front_preview_url,
                          frontDownloadUrl,
                          `${g.full_name} ID front`
                        )}
                        {renderDocBlock(
                          "ID Back",
                          g.id_back_preview_url,
                          backDownloadUrl,
                          `${g.full_name} ID back`
                        )}
                        {renderDocBlock(
                          "Guarantor photo",
                          g.photo_preview_url,
                          photoDownloadUrl,
                          `${g.full_name} photo`
                        )}
                        {renderDocBlock(
                          "Photo with customer",
                          g.photo_with_customer_preview_url,
                          photoWithCustomerDownloadUrl,
                          `${g.full_name} with customer`
                        )}
                        {renderDocBlock(
                          "Ward letter",
                          g.ward_letter_preview_url,
                          wardLetterDownloadUrl,
                          `${g.full_name} ward letter`
                        )}
                        {(g.attachment_urls ?? []).map((url, attachmentIndex) =>
                          renderDocBlock(
                            `Attachment ${attachmentIndex + 1}`,
                            undefined,
                            toProxyUrl(url),
                            `${g.full_name} attachment ${attachmentIndex + 1}`
                          )
                        )}
                        {shouldShowGuarantorLegacyDocument(g) ? (
                          <DocumentPreview authUrl={g.document_url} alt={`${g.full_name} document`} />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {application.references && application.references.length > 0 ? (
            <Card className="border-border/80 py-0 shadow-sm">
              <CardHeader className="border-b px-4 py-4 sm:px-5">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4 text-muted-foreground" />
                  References
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 sm:p-5">
                <ul className="space-y-2 text-sm">
                  {application.references.map((r: ReferenceRow, i: number) => (
                    <li key={r.id ?? i} className="space-y-1 rounded-lg border px-3 py-2.5">
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
              </CardContent>
            </Card>
          ) : null}

          {securityCount === 0 ? (
            <Card className="border-dashed py-0 shadow-none">
              <CardContent className="flex flex-col items-center justify-center gap-2 p-10 text-center">
                <Shield className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">No collateral or guarantors</p>
                <p className="text-xs text-muted-foreground">
                  Security details will appear here when added to the application.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="documents" className="mt-0">
          <Card className="border-border/80 py-0 shadow-sm">
            <CardHeader className="border-b px-4 py-4 sm:px-5">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Application documents
              </CardTitle>
              <CardDescription>
                Required files attached to this application (collateral and guarantor IDs are under Security)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              {standaloneDocuments.length > 0 ? (
                <ul className="space-y-3 text-sm">
                  {standaloneDocuments.map((doc) => {
                    const hasUrl = Boolean(doc.url);
                    const proxyUrl = hasUrl ? toProxyUrl(doc.url) : null;
                    const viewUrl = doc.preview_url ?? proxyUrl;
                    const label = formatRequiredDocumentLabel(documentTypeFromRow(doc));
                    return (
                      <li
                        key={doc.id || `${doc.type}-${doc.name}`}
                        className="overflow-hidden rounded-lg border"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{label}</p>
                              {doc.name ? (
                                <p className="truncate text-xs text-muted-foreground">{doc.name}</p>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {doc.verified ? (
                              <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Verified
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-amber-300 text-amber-700">
                                Pending
                              </Badge>
                            )}
                            {viewUrl ? (
                              <>
                                <Button type="button" variant="ghost" size="sm" className="h-7 px-2" asChild>
                                  <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    <span className="sr-only">View</span>
                                  </a>
                                </Button>
                                {proxyUrl ? (
                                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2" asChild>
                                    <a href={proxyUrl} download={doc.name ?? true}>
                                      <Download className="h-3.5 w-3.5" />
                                      <span className="sr-only">Download</span>
                                    </a>
                                  </Button>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </div>
                        {viewUrl ? (
                          <DocumentPreview
                            previewUrl={doc.preview_url}
                            authUrl={doc.url}
                            alt={label}
                          />
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium text-foreground">No documents uploaded yet</p>
                  <p className="text-xs text-muted-foreground">
                    Upload required documents when editing or activating this application.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <Card className="border-border/80 py-0 shadow-sm">
        <CardFooter className="flex flex-col-reverse gap-2 px-4 py-4 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3 sm:px-5">
          {application.status === "pending_disbursement" ? (
            <Button className="bg-emerald-600 hover:bg-emerald-700" asChild>
              <Link
                href={
                  application.loan_id
                    ? `${resolvePortalPath(
                        effectiveRole as Parameters<typeof resolvePortalPath>[0],
                        "/disbursements/new"
                      )}?loanId=${encodeURIComponent(application.loan_id)}`
                    : resolvePortalPath(
                        effectiveRole as Parameters<typeof resolvePortalPath>[0],
                        "/disbursements/new"
                      )
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
                  : wf.requiresRejectionReason
                    ? onRejectRequest(application, wf.run)
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
        </CardFooter>
      </Card>
    </div>
  );
}
