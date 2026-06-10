"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ApplicationDetailPanel } from "@/components/applications/application-detail-panel";
import {
  DeleteApplicationDialog,
  type DeleteApplicationTarget,
} from "@/components/applications/delete-application-dialog";
import { RequiredDocumentsFields } from "@/components/applications/required-documents-fields";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  adaptApiApplicationListRow,
  extractApplicationDetail,
  type ApplicationViewRow,
} from "@/lib/application-adapters";
import {
  enrichApplicationRow,
  fetchApplicationEnrichmentContext,
} from "@/lib/application-enrichment";
import {
  fetchApplicationDocumentStatus,
  formatRequiredDocumentLabel,
} from "@/lib/application-documents";
import { exportApplicationToPdf } from "@/lib/application-pdf";
import {
  activateApplicationApi,
  runAdminActivateApplicationWorkflow,
} from "@/lib/application-workflow";
import { resolvePortalPath } from "@/lib/portal-paths";
import { useSessionUser } from "@/lib/use-session-user";

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSessionUser();
  const effectiveRole = user?.role ?? "super_admin";
  const scopeBranchId =
    effectiveRole === "branch_manager" || effectiveRole === "loan_officer"
      ? user?.branch_id
      : null;
  const applicationsListPath = resolvePortalPath(user?.role, "/applications");
  const applicationsNewPath = resolvePortalPath(user?.role, "/applications/new");

  const [application, setApplication] = useState<ApplicationViewRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const enrichmentCtxRef = useRef<EnrichmentContext | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteApplicationTarget | null>(null);
  const [activateDocsDialog, setActivateDocsDialog] = useState<{
    appId: string;
    amount: number;
    required: string[];
    missing: string[];
    uploadedTypes: string[];
  } | null>(null);
  const [activateDocFiles, setActivateDocFiles] = useState<Record<string, File | null>>({});
  const [activateUploadedTypes, setActivateUploadedTypes] = useState<string[]>([]);

  const loadApplication = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    // Fire enrichment and application fetches in parallel
    const ctxPromise = enrichmentCtxRef.current
      ? Promise.resolve(enrichmentCtxRef.current)
      : fetchApplicationEnrichmentContext(scopeBranchId, { role: effectiveRole }).then((ctx) => {
          enrichmentCtxRef.current = ctx;
          return ctx;
        });

    try {
      const res = await fetch(`/api/applications/${encodeURIComponent(params.id)}`, {
        credentials: "include",
      });

      // Check status before parsing JSON — a non-OK response may have an HTML body
      // which would cause res.json() to throw and lose the real error information.
      if (!res.ok) {
        let message = `Application not found (${res.status})`;
        try {
          const errJson = await res.json();
          if (typeof errJson.message === "string") message = errJson.message;
          else if (typeof errJson.error === "string") message = errJson.error;
        } catch { /* body was not JSON */ }
        setLoadError(message);
        setApplication(null);
        return;
      }

      const json = await res.json();
      const detail = extractApplicationDetail(json);
      if (!detail) {
        setLoadError("Application not found");
        setApplication(null);
        return;
      }

      // Show application immediately with whatever enrichment is available (may still be loading)
      const rawRow = adaptApiApplicationListRow({ application: detail });
      const immediateCtx = enrichmentCtxRef.current;
      if (immediateCtx) {
        setApplication(enrichApplicationRow(rawRow, immediateCtx));
      } else {
        // Show raw data right away; enrich once context arrives
        setApplication(enrichApplicationRow(rawRow, { productMap: {}, staffMap: {}, customerMap: {} }));
        ctxPromise.then((ctx) => {
          setApplication(enrichApplicationRow(rawRow, ctx));
        }).catch(() => { /* enrichment failed; raw data remains */ });
      }
    } catch {
      setLoadError("Network error loading application");
      setApplication(null);
    } finally {
      setLoading(false);
    }
  }, [params.id, scopeBranchId, effectiveRole]);

  useEffect(() => {
    void loadApplication();
  }, [loadApplication]);

  const runWorkflowAction = async (
    appId: string,
    action: () => Promise<{ ok: boolean; error?: string }>
  ) => {
    setActionBusyId(appId);
    setActionError(null);
    const result = await action();
    if (!result.ok) {
      setActionError(result.error ?? "Action failed");
      setActionBusyId(null);
      return false;
    }
    await loadApplication();
    setActionBusyId(null);
    return true;
  };

  const openActivateDocsDialog = (app: ApplicationViewRow, missing: string[]) => {
    const files: Record<string, File | null> = {};
    for (const t of missing) files[t] = null;
    setActivateDocFiles(files);
    setActivateUploadedTypes([]);
    setActivateDocsDialog({
      appId: app.id,
      amount: app.approved_amount ?? app.requested_amount,
      required: app.required_documents ?? missing,
      missing,
      uploadedTypes: [],
    });
  };

  const handleAdminActivate = async (app: ApplicationViewRow) => {
    setActionError(null);
    const status = await fetchApplicationDocumentStatus(
      app.id,
      app.product_id,
      app.required_documents
    );
    if (!status) {
      setActionError("Could not load required documents for this application.");
      return;
    }
    if (status.missing.length > 0) {
      openActivateDocsDialog(app, status.missing);
      setActivateUploadedTypes(status.uploadedTypes);
      return;
    }
    const ok = await runWorkflowAction(app.id, async () => {
      const r = await activateApplicationApi(app.id, app.approved_amount ?? app.requested_amount);
      if (!r.ok && /missing required documents/i.test(r.error)) {
        const status = await fetchApplicationDocumentStatus(
          app.id,
          app.product_id,
          app.required_documents
        );
        if (status?.missing.length) openActivateDocsDialog(app, status.missing);
      }
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    });
    if (ok) {
      setSuccessMessage(
        "Application activated. Loan is pending disbursement — open Loan Disbursement to release funds."
      );
    }
  };

  const confirmActivateWithDocuments = async () => {
    if (!activateDocsDialog) return;
    const { appId, amount, missing } = activateDocsDialog;
    const stillMissing = missing.filter((t) => !activateDocFiles[t] && !activateUploadedTypes.includes(t));
    if (stillMissing.length > 0) {
      setActionError(
        `Select files for: ${stillMissing.map(formatRequiredDocumentLabel).join(", ")}`
      );
      return;
    }
    const ok = await runWorkflowAction(appId, async () => {
      const r = await runAdminActivateApplicationWorkflow(
        appId,
        amount,
        user?.full_name ?? "User",
        activateDocFiles
      );
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    });
    if (ok) {
      setActivateDocsDialog(null);
      setActivateDocFiles({});
      setSuccessMessage("Application activated. Loan is now active and ready on the Loans page.");
    }
  };

  const exportApplicationPdf = () => {
    if (!application) return;
    exportApplicationToPdf({
      application,
      customerName: application.customerDisplayName,
      customerNumber: application.customerNumber,
      productName: application.productName,
      branchName: application.branchName,
      createdByName: application.creatorName || application.created_by,
    });
  };

  return (
    <>
      <DashboardHeader
        title="Application Details"
        description="Full loan application record with documents, workflow actions, and export."
      />
      <main className="flex min-h-0 flex-1 overflow-y-auto p-4 pb-10 lg:p-6 lg:pb-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
            <Link href={applicationsListPath}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to applications
            </Link>
          </Button>

          {successMessage ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {successMessage}
            </div>
          ) : null}
          {actionError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {actionError}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading application…
            </div>
          ) : loadError || !application ? (
            <div className="rounded-xl border border-dashed p-8 text-center space-y-3">
              <p className="text-muted-foreground">{loadError ?? "Application not found"}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={() => void loadApplication()}>
                  Retry
                </Button>
                <Button variant="ghost" asChild>
                  <Link href={applicationsListPath}>Return to applications</Link>
                </Button>
              </div>
            </div>
          ) : (
            <ApplicationDetailPanel
              application={application}
              assignedOfficer={application.officerName ?? "Unassigned"}
              detailLoading={loading}
              effectiveRole={effectiveRole}
              userId={user?.id}
              userFullName={user?.full_name ?? "User"}
              actionBusyId={actionBusyId}
              applicationsNewPath={applicationsNewPath}
              onAdminActivate={handleAdminActivate}
              onWorkflowAction={runWorkflowAction}
              onDelete={(app) =>
                setDeleteTarget({
                  id: app.id,
                  application_number: app.application_number,
                  customerDisplayName: app.customerDisplayName,
                })
              }
              onExportPdf={exportApplicationPdf}
            />
          )}
        </div>
      </main>

      <DeleteApplicationDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        application={deleteTarget}
        onDeleted={() => {
          setDeleteTarget(null);
          router.push(applicationsListPath);
        }}
      />

      <Dialog
        open={activateDocsDialog != null}
        onOpenChange={(open) => {
          if (!open) {
            setActivateDocsDialog(null);
            setActivateDocFiles({});
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogTitle>Required documents</DialogTitle>
          <DialogDescription>
            Upload the missing files below, then activation will continue automatically.
          </DialogDescription>
          {activateDocsDialog ? (
            <RequiredDocumentsFields
              requiredTypes={activateDocsDialog.missing}
              filesByType={activateDocFiles}
              uploadedTypes={[...activateDocsDialog.uploadedTypes, ...activateUploadedTypes]}
              applicationId={activateDocsDialog.appId}
              uploadOnSelect
              onUploadComplete={(type) =>
                setActivateUploadedTypes((prev) =>
                  prev.includes(type) ? prev : [...prev, type]
                )
              }
              onChange={(type, file) =>
                setActivateDocFiles((prev) => ({ ...prev, [type]: file }))
              }
            />
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setActivateDocsDialog(null);
                setActivateDocFiles({});
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!activateDocsDialog || actionBusyId === activateDocsDialog.appId}
              onClick={() => void confirmActivateWithDocuments()}
            >
              {activateDocsDialog && actionBusyId === activateDocsDialog.appId ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Activate & create loan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
