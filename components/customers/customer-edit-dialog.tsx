"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CustomerAdditionalPhonesFields } from "@/components/customers/customer-additional-phones-fields";
import { CustomerAttachmentsFields } from "@/components/customers/customer-attachments-fields";
import { CustomerCollateralFields } from "@/components/customers/customer-collateral-fields";
import { CustomerGuarantorsFields } from "@/components/customers/customer-guarantors-fields";
import { CustomerReferencesFields } from "@/components/customers/customer-references-fields";
import { Button } from "@/components/ui/button";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from "@/components/ui/dialog";
import { MoneyInput } from "@/components/forms/money-input";
import { TzValidatedInput } from "@/components/forms/tz-validated-input";
import { Input } from "@/components/ui/input";
import { formatMoneyFromNumber, parseMoneyInput } from "@/lib/money-input";

function moneyFieldFromPayload(value: unknown): string {
 if (value == null || value === "") return "";
 if (typeof value === "number") return formatMoneyFromNumber(value);
 const n = parseMoneyInput(String(value));
 return n > 0 ? formatMoneyFromNumber(n) : String(value);
}
import { Label } from "@/components/ui/label";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
 emptyCustomerAttachments,
 extractCustomerAttachmentsFromRow,
 validateCustomerAttachments,
 type CustomerAttachmentFormState,
} from "@/lib/customer-attachments";
import { formatValidationDetails } from "@/lib/falco-api";
import { customerToFormPayload } from "@/lib/customer-payload";
import { adaptApiCustomerRowToCustomer, extractCustomerDetail } from "@/lib/customer-adapters";
import { uploadCustomerPassportPhoto } from "@/lib/customer-photo-uploads";
import {
  customerCollateralApiRecordsToForm,
  collateralMetadataRecordsEqual,
  customerCollateralFormToMetadataRecords,
  customerCollateralRowsWithImages,
  defaultCustomerCollateralForm,
  parseCustomerCollateralFromRow,
  validateCustomerCollateral,
  type CustomerCollateralFormRow,
} from "@/lib/customer-collateral";
import { uploadCustomerCollateralImages } from "@/lib/customer-collateral-uploads";
import { uploadCustomerGuarantorIdDocuments } from "@/lib/customer-guarantor-uploads";
import {
  customerAttachmentFormHasLocationPhotos,
  customerAttachmentFormHasSupportingDocuments,
  uploadCustomerLocationPhotos,
  uploadCustomerSupportingDocuments,
} from "@/lib/customer-location-photo-uploads";
import {
  applyApplicationGuarantorDocuments,
  customerGuarantorApiRecordsToForm,
  customerGuarantorFormToApiRecords,
  customerGuarantorRowsWithIdFiles,
  defaultCustomerGuarantorForm,
  parseCustomerGuarantorApiRecordsFromRow,
  validateCustomerGuarantors,
  type CustomerGuarantorFormRow,
} from "@/lib/customer-guarantors";
import { enrichCustomerApplicationsForMedia } from "@/lib/enrich-customer-applications";
import { getCachedCustomerPortfolio } from "@/lib/customer-portfolio-cache";
import type { ApplicationViewRow } from "@/lib/application-adapters";
import type { CustomerPortfolioData } from "@/lib/customer-portfolio-detail";
import {
  customerReferenceFormToRecords,
  customerReferenceRecordsToForm,
  defaultCustomerReferenceForm,
  parseCustomerReferencesFromRow,
  validateCustomerReferences,
  type CustomerReferenceFormRow,
} from "@/lib/customer-references";
import {
  extractPassportPhotoPreviewUrl,
  extractPassportPhotoUrl,
} from "@/lib/customer-profile-extras";
import {
 activeBranchesForAssignment,
 loanOfficersForBranch,
} from "@/lib/customer-assignment-options";
import { CUSTOMER_ID_TYPE_OPTIONS, normalizeCustomerIdType } from "@/lib/customer-id-types";
import type { Branch, Customer, User } from "@/lib/types";
import { useSessionUser } from "@/lib/use-session-user";

const CustomerLocationMapPicker = dynamic(
  () =>
    import("@/components/customers/business-location-map-picker").then(
      (mod) => mod.CustomerLocationMapPicker
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-48 items-center justify-center rounded-lg border bg-muted/20 text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  }
);

type CustomerStatus =
 | "pending_registration_fee"
 | "active"
 | "suspended"
 | "blacklisted"
 | "inactive";

type RiskLevel = "low" | "medium" | "high" | "critical";

type EditForm = {
 first_name: string;
 middle_name: string;
 last_name: string;
 phone: string;
 additional_phones: string[];
 email: string;
 physical_address: string;
 street: string;
 ward: string;
 district: string;
 region: string;
 home_latitude: number | null;
 home_longitude: number | null;
 national_id: string;
 id_type: string;
 occupation: string;
 employer_name: string;
 employer_address: string;
 employer_phone: string;
 employment_start_date: string;
 monthly_income: string;
 business_name: string;
 business_type: string;
 business_address: string;
 business_latitude: number | null;
 business_longitude: number | null;
 business_registration_no: string;
 years_in_business: string;
 cheque_number: string;
 payment_reference: string;
 registration_fee_paid: boolean;
 registration_fee_amount: string;
 registration_fee_paid_at: string;
 status: CustomerStatus;
 risk_level: RiskLevel;
 risk_score: string;
 notes: string;
 branch_id: string;
 loan_officer_id: string;
 created_by: string;
 date_of_birth: string;
 gender: "male" | "female";
 next_of_kin_name: string;
 next_of_kin_relationship: string;
 next_of_kin_phone: string;
 next_of_kin_address: string;
};

const STATUS_OPTIONS: Array<{ value: CustomerStatus; label: string }> = [
 { value: "pending_registration_fee", label: "Pending Registration Fee" },
 { value: "active", label: "Active" },
 { value: "suspended", label: "Suspended" },
 { value: "blacklisted", label: "Blacklisted" },
 { value: "inactive", label: "Inactive" },
];

const RISK_LEVEL_OPTIONS: Array<{ value: RiskLevel; label: string }> = [
 { value: "low", label: "Low" },
 { value: "medium", label: "Medium" },
 { value: "high", label: "High" },
 { value: "critical", label: "Critical" },
];

function toEditForm(p: Record<string, unknown>): EditForm {
 return {
 first_name: String(p.first_name ?? ""),
 middle_name: String(p.middle_name ?? ""),
 last_name: String(p.last_name ?? ""),
 phone: String(p.phone ?? ""),
 additional_phones: Array.isArray(p.additional_phones)
  ? (p.additional_phones as unknown[]).map((v) => String(v ?? "")).filter(Boolean)
  : p.alt_phone
    ? [String(p.alt_phone)]
    : [],
 email: String(p.email ?? ""),
 physical_address: String(p.physical_address ?? ""),
 street: String(p.street ?? ""),
 ward: String(p.ward ?? ""),
 district: String(p.district ?? ""),
 region: String(p.region ?? ""),
 home_latitude:
  p.home_latitude != null && Number.isFinite(Number(p.home_latitude)) ? Number(p.home_latitude) : null,
 home_longitude:
  p.home_longitude != null && Number.isFinite(Number(p.home_longitude))
   ? Number(p.home_longitude)
   : null,
 national_id: String(p.national_id ?? ""),
 id_type: normalizeCustomerIdType(p.id_type),
 occupation: String(p.occupation ?? ""),
 employer_name: String(p.employer_name ?? ""),
 employer_address: String(p.employer_address ?? ""),
 employer_phone: String(p.employer_phone ?? ""),
 employment_start_date: String(p.employment_start_date ?? ""),
 monthly_income: moneyFieldFromPayload(p.monthly_income),
 business_name: String(p.business_name ?? ""),
 business_type: String(p.business_type ?? ""),
 business_address: String(p.business_address ?? ""),
 business_latitude:
  p.business_latitude != null && Number.isFinite(Number(p.business_latitude))
   ? Number(p.business_latitude)
   : null,
 business_longitude:
  p.business_longitude != null && Number.isFinite(Number(p.business_longitude))
   ? Number(p.business_longitude)
   : null,
 business_registration_no: String(p.business_registration_no ?? ""),
 years_in_business: String(p.years_in_business ?? ""),
 cheque_number: String(p.cheque_number ?? ""),
 payment_reference: String(p.payment_reference ?? ""),
 registration_fee_paid: Boolean(p.registration_fee_paid),
 registration_fee_amount: moneyFieldFromPayload(p.registration_fee_amount),
 registration_fee_paid_at: String(p.registration_fee_paid_at ?? ""),
 status: (p.status as CustomerStatus) || "active",
 risk_level: (p.risk_level as RiskLevel) || "medium",
 risk_score: String(p.risk_score ?? "0"),
 notes: String(p.notes ?? ""),
 branch_id: String(p.branch_id ?? ""),
 loan_officer_id: String(p.loan_officer_id ?? ""),
 created_by: String(p.created_by ?? ""),
 date_of_birth: String(p.date_of_birth ?? ""),
 gender: p.gender === "male" ? "male" : "female",
 next_of_kin_name: String(p.next_of_kin_name ?? ""),
 next_of_kin_relationship: String(p.next_of_kin_relationship ?? ""),
 next_of_kin_phone: String(p.next_of_kin_phone ?? ""),
 next_of_kin_address: String(p.next_of_kin_address ?? ""),
 };
}

/**
 * Excludes home/business lat-lng — direct location edits on an existing customer are
 * restricted by the backend and must go through `POST .../location-change-requests` instead
 * (see `submitChangedLocationRequests`).
 */
function formToPatchBody(form: EditForm): Record<string, unknown> {
 return {
 first_name: form.first_name,
 middle_name: form.middle_name,
 last_name: form.last_name,
 full_name: [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(" "),
 phone: form.phone,
 additional_phones: form.additional_phones.map((p) => p.trim()).filter(Boolean),
 email: form.email,
 physical_address: form.physical_address,
 street: form.street,
 ward: form.ward,
 district: form.district,
 region: form.region,
 national_id: form.national_id,
 id_type: form.id_type,
 occupation: form.occupation,
 employer_name: form.employer_name,
 employer_address: form.employer_address,
 employer_phone: form.employer_phone,
 employment_start_date: form.employment_start_date,
 monthly_income: form.monthly_income ? parseMoneyInput(form.monthly_income) : null,
 business_name: form.business_name,
 business_type: form.business_type,
 business_address: form.business_address,
 business_registration_no: form.business_registration_no,
 years_in_business: form.years_in_business,
 cheque_number: form.cheque_number,
 registration_fee_amount: form.registration_fee_amount
 ? parseMoneyInput(form.registration_fee_amount)
 : null,
 status: form.status,
 risk_level: form.risk_level,
 risk_score: form.risk_score,
 notes: form.notes,
 branch_id: form.branch_id,
 loan_officer_id: form.loan_officer_id,
 created_by: form.created_by,
 date_of_birth: form.date_of_birth,
 gender: form.gender,
 next_of_kin_name: form.next_of_kin_name,
 next_of_kin_relationship: form.next_of_kin_relationship,
 next_of_kin_phone: form.next_of_kin_phone,
 next_of_kin_address: form.next_of_kin_address,
 };
}

type LocationPin = { latitude: number; longitude: number };

function locationPinsFromForm(form: EditForm): { home: LocationPin | null; business: LocationPin | null } {
 return {
 home:
  form.home_latitude != null && form.home_longitude != null
   ? { latitude: form.home_latitude, longitude: form.home_longitude }
   : null,
 business:
  form.business_latitude != null && form.business_longitude != null
   ? { latitude: form.business_latitude, longitude: form.business_longitude }
   : null,
 };
}

function pinsEqual(a: LocationPin | null, b: LocationPin | null): boolean {
 if (a === b) return true;
 if (!a || !b) return false;
 return a.latitude === b.latitude && a.longitude === b.longitude;
}

/**
 * Submits a `location-change-request` per pin that changed since load. Direct PATCH of
 * home/business coordinates is no longer sent for existing customers (see `formToPatchBody`).
 * Failures are surfaced via toast but do not block the rest of the save.
 */
async function submitChangedLocationRequests(
 customerId: string,
 initial: { home: LocationPin | null; business: LocationPin | null },
 next: { home: LocationPin | null; business: LocationPin | null },
 notify: (message: string, ok: boolean) => void
): Promise<void> {
 const targets: Array<{ label: string; pin: LocationPin | null; changed: boolean }> = [
  { label: "Home location", pin: next.home, changed: !pinsEqual(initial.home, next.home) },
  {
   label: "Business location",
   pin: next.business,
   changed: !pinsEqual(initial.business, next.business),
  },
 ];

 for (const target of targets) {
  if (!target.changed || !target.pin) continue;
  try {
   const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}/location-change-requests`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
     latitude: target.pin.latitude,
     longitude: target.pin.longitude,
     location_name: target.label,
     location_captured_at: new Date().toISOString(),
    }),
   });
   const json = (await res.json().catch(() => ({}))) as { message?: string };
   if (!res.ok) {
    notify(`${target.label} change could not be submitted: ${json.message ?? `Error ${res.status}`}`, false);
    continue;
   }
   notify(`${target.label} change submitted for approval.`, true);
  } catch {
   notify(`${target.label} change could not be submitted: network error.`, false);
  }
 }
}

type CustomerEditDialogProps = {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 customerId: string;
 customer: Customer;
 sourceRow: Record<string, unknown> | null;
 onSaved: (next: Customer, row: Record<string, unknown> | null) => void;
 mode?: "dialog" | "page";
};

export function CustomerEditDialog({
 open,
 onOpenChange,
 customerId,
 customer,
 sourceRow,
 onSaved,
 mode = "dialog",
}: CustomerEditDialogProps) {
 const { user } = useSessionUser();
 const isManagerView = user?.role === "branch_manager";
 const isOfficerView = user?.role === "loan_officer";
 const lockedBranchId = isManagerView || isOfficerView ? user?.branch_id ?? "" : "";
 const lockedOfficerId = isOfficerView ? user?.id ?? "" : "";

 const [form, setForm] = useState<EditForm | null>(null);
 const [error, setError] = useState("");
 const [saving, setSaving] = useState(false);
 const [branchRecords, setBranchRecords] = useState<Branch[]>([]);
 const [branchesLoading, setBranchesLoading] = useState(false);
 const [branchesError, setBranchesError] = useState("");
 const [loanOfficers, setLoanOfficers] = useState<User[]>([]);
 const [officersLoading, setOfficersLoading] = useState(false);
 const [officersError, setOfficersError] = useState("");
 const [attachments, setAttachments] = useState<CustomerAttachmentFormState>(emptyCustomerAttachments);
 const [guarantors, setGuarantors] = useState<CustomerGuarantorFormRow[]>(defaultCustomerGuarantorForm);
 const [collateral, setCollateral] = useState<CustomerCollateralFormRow[]>(defaultCustomerCollateralForm);
 const [references, setReferences] = useState<CustomerReferenceFormRow[]>(defaultCustomerReferenceForm);
 const initialReferencesRef = useRef(
  customerReferenceFormToRecords(defaultCustomerReferenceForm())
 );
 const initialLocationRef = useRef<{ home: LocationPin | null; business: LocationPin | null }>({
  home: null,
  business: null,
 });
 const initialCollateralMetadataRef = useRef(
  customerCollateralFormToMetadataRecords(defaultCustomerCollateralForm())
 );
 const initialFormPatchRef = useRef<Record<string, unknown> | null>(null);
 const initialGuarantorsRef = useRef(
  customerGuarantorFormToApiRecords(defaultCustomerGuarantorForm())
 );

 // Mirrors `sourceRow` but can be refreshed in-place after a document delete without waiting
 // for the parent to re-fetch and re-open the dialog.
 const [liveSourceRow, setLiveSourceRow] = useState<Record<string, unknown> | null>(sourceRow);
 const [removingDocumentIds, setRemovingDocumentIds] = useState<Set<string>>(new Set());

 useEffect(() => {
 setLiveSourceRow(sourceRow);
 }, [sourceRow, open]);

 const existingAttachments = useMemo(
 () => extractCustomerAttachmentsFromRow(liveSourceRow),
 [liveSourceRow]
 );
 const existingPassportUrl = useMemo(() => extractPassportPhotoUrl(liveSourceRow), [liveSourceRow]);
 const existingPassportPreviewUrl = useMemo(
  () => extractPassportPhotoPreviewUrl(liveSourceRow),
  [liveSourceRow]
 );

 const deleteCustomerDocument = useCallback(
  async (documentId: string): Promise<boolean> => {
   setRemovingDocumentIds((prev) => new Set(prev).add(documentId));
   try {
    const res = await fetch(
     `/api/customers/${encodeURIComponent(customerId)}/documents/${encodeURIComponent(documentId)}`,
     { method: "DELETE", credentials: "include" }
    );
    if (!res.ok) {
     const json = (await res.json().catch(() => ({}))) as { message?: string };
     toast.error(json.message ?? `Could not remove document (${res.status})`);
     return false;
    }
    const detailRes = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
     credentials: "include",
    });
    const detailBody = (await detailRes.json().catch(() => ({}))) as unknown;
    const refreshed = extractCustomerDetail(detailBody);
    if (refreshed) setLiveSourceRow(refreshed);
    toast.success("Document removed.");
    return true;
   } catch {
    toast.error("Network error while removing document.");
    return false;
   } finally {
    setRemovingDocumentIds((prev) => {
     const next = new Set(prev);
     next.delete(documentId);
     return next;
    });
   }
  },
  [customerId]
 );

 const deleteCustomerGuarantor = useCallback(
  async (guarantorId: string): Promise<boolean> => {
   try {
    const res = await fetch(
     `/api/customers/${encodeURIComponent(customerId)}/guarantors/${encodeURIComponent(guarantorId)}`,
     { method: "DELETE", credentials: "include" }
    );
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      toast.error(json.message ?? `Could not remove guarantor (${res.status})`);
      return false;
    }
    const detailRes = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
      credentials: "include",
    });
    const detailBody = (await detailRes.json().catch(() => ({}))) as unknown;
    const refreshed = extractCustomerDetail(detailBody);
    if (refreshed) {
      setLiveSourceRow(refreshed);
    }
    toast.success("Guarantor removed.");
    return true;
   } catch {
    toast.error("Network error while removing guarantor.");
    return false;
   }
  },
  [customerId]
 );

 const loadBranches = useCallback(async () => {
 setBranchesLoading(true);
 setBranchesError("");
 try {
 const r = await fetch("/api/falco/branches", { credentials: "include" });
 const d = (await r.json()) as { branches?: Branch[]; message?: string };
 if (!r.ok) {
 setBranchesError(d.message ?? "Could not load branches");
 setBranchRecords([]);
 return;
 }
 setBranchRecords(d.branches ?? []);
 } catch {
 setBranchesError("Could not load branches");
 setBranchRecords([]);
 } finally {
 setBranchesLoading(false);
 }
 }, []);

 const loadOfficersForBranch = useCallback(
 async (branchId?: string) => {
 const targetBranchId = String(branchId ?? form?.branch_id ?? "").trim();
 if (!targetBranchId) {
 setLoanOfficers([]);
 return;
 }
 if (lockedOfficerId && user) {
 setLoanOfficers([
 {
 id: user.id,
 email: user.email,
 full_name: user.full_name,
 role: "loan_officer",
 branch_id: user.branch_id ?? "",
 phone: user.phone ?? "",
 employee_id: user.employee_id ?? "",
 is_active: user.is_active ?? true,
 created_at: new Date().toISOString(),
 last_login: null,
 },
 ]);
 return;
 }
 setOfficersLoading(true);
 setOfficersError("");
 try {
 const params = new URLSearchParams({
 branch_id: targetBranchId,
 role: "loan_officer",
 is_active: "true",
 page_size: "100",
 });
 const r = await fetch(`/api/staff/directory?${params.toString()}`, { credentials: "include" });
 const d = (await r.json()) as { users?: User[]; error?: string; message?: string };
 if (!r.ok) {
 setOfficersError(d.error ?? d.message ?? `Could not load officers (${r.status})`);
 setLoanOfficers([]);
 return;
 }
 setLoanOfficers(loanOfficersForBranch(d.users ?? [], targetBranchId));
 } catch {
 setOfficersError("Could not load loan officers");
 setLoanOfficers([]);
 } finally {
 setOfficersLoading(false);
 }
 },
 [form?.branch_id, lockedOfficerId, user]
 );

 useEffect(() => {
 if (!open) return;
 void loadBranches();
 }, [open, loadBranches]);

 useEffect(() => {
 if (!open || !form?.branch_id) return;
 void loadOfficersForBranch();
 }, [open, form?.branch_id, loadOfficersForBranch]);

 useEffect(() => {
 if (!open) {
 setForm(null);
 setError("");
 setAttachments(emptyCustomerAttachments());
 setGuarantors(defaultCustomerGuarantorForm());
 setCollateral(defaultCustomerCollateralForm());
 setReferences(defaultCustomerReferenceForm());
 return;
 }
 const base = customerToFormPayload(customer, sourceRow);
 setAttachments(emptyCustomerAttachments());
 const loadedGuarantors = customerGuarantorApiRecordsToForm(parseCustomerGuarantorApiRecordsFromRow(sourceRow));
 setGuarantors(loadedGuarantors);
 const loadedCollateral = customerCollateralApiRecordsToForm(parseCustomerCollateralFromRow(sourceRow));
 setCollateral(loadedCollateral);
 initialCollateralMetadataRef.current = customerCollateralFormToMetadataRecords(loadedCollateral);
 const loadedReferences = customerReferenceRecordsToForm(parseCustomerReferencesFromRow(sourceRow));
 setReferences(loadedReferences);
 initialReferencesRef.current = customerReferenceFormToRecords(loadedReferences);
 const editForm = toEditForm(base);
 setForm(editForm);
 initialFormPatchRef.current = formToPatchBody(editForm);
  initialGuarantorsRef.current = customerGuarantorFormToApiRecords(loadedGuarantors);
 initialLocationRef.current = locationPinsFromForm(editForm);
 }, [open, customer, sourceRow]);

 // The customer record's own `guarantors[]` only carries a bare id_front/id_back document id —
 // the backend has no route that resolves that id back to a url. The same guarantor recorded on
 // a loan application often has the document fully embedded, so fetch applications and backfill
 // any missing ID-scan preview urls from there (same source the profile page already uses).
 useEffect(() => {
  if (!open || !customerId) return;
  let cancelled = false;

  const applyFromApplications = (applications: ApplicationViewRow[]) => {
   if (cancelled || applications.length === 0) return;
   void enrichCustomerApplicationsForMedia(applications).then((enriched) => {
    if (cancelled) return;
    setGuarantors((prev) => applyApplicationGuarantorDocuments(prev, enriched));
   });
  };

  const cached = getCachedCustomerPortfolio(customerId);
  if (cached?.applications?.length) {
   applyFromApplications(cached.applications);
  } else {
   void fetch(`/api/customers/${encodeURIComponent(customerId)}/portfolio`, { credentials: "include" })
    .then((res) => (res.ok ? res.json() : null))
    .then((body: CustomerPortfolioData | null) => {
     if (!cancelled && body?.applications) applyFromApplications(body.applications);
    })
    .catch(() => undefined);
  }

  return () => {
   cancelled = true;
  };
 }, [open, customerId]);

 const updateField = <K extends keyof EditForm>(key: K, value: EditForm[K]) => {
 setForm((prev) => {
 if (!prev) return prev;
 if (key === "branch_id") {
 return { ...prev, branch_id: value as string, loan_officer_id: "" };
 }
 return { ...prev, [key]: value };
 });
 };

 const branchOptions = useMemo(
 () => activeBranchesForAssignment(branchRecords, lockedBranchId),
 [branchRecords, lockedBranchId]
 );
 const loanOfficerOptions = useMemo(
 () => loanOfficersForBranch(loanOfficers, form?.branch_id ?? ""),
 [loanOfficers, form?.branch_id]
 );

 const validate = () => {
 if (!form) return "Form not ready.";
 if (!form.first_name.trim() || !form.last_name.trim()) return "First and last name are required.";
 if (!form.phone.trim()) return "Primary phone is required.";
 if (!form.physical_address.trim()) return "Physical address is required.";
 if (!form.national_id.trim()) return "National ID is required.";
 if (!form.branch_id) return "Please select a branch.";
 if (!form.loan_officer_id) return "Please assign a loan officer.";
 if (!form.date_of_birth.trim()) return "Date of birth is required.";
 return "";
 };

 const handleSubmit = async (e: FormEvent) => {
 e.preventDefault();
 if (!form) return;
 setError("");
 const msg = validate();
 if (msg) {
 setError(msg);
 return;
 }
 const attachmentValidation = validateCustomerAttachments(attachments);
 if (!attachmentValidation.ok) {
 setError(attachmentValidation.error);
 return;
 }
 const guarantorValidation = validateCustomerGuarantors(guarantors);
 if (!guarantorValidation.ok) {
 setError(guarantorValidation.error);
 return;
 }
 const collateralValidation = validateCustomerCollateral(collateral);
 if (!collateralValidation.ok) {
 setError(collateralValidation.error);
 return;
 }
 const referencesValidation = validateCustomerReferences(references);
 if (!referencesValidation.ok) {
 setError(referencesValidation.error);
 return;
 }
 setSaving(true);
 try {
 const nextCollateralMetadata = customerCollateralFormToMetadataRecords(collateral);
 const collateralMetadataChanged = !collateralMetadataRecordsEqual(
  initialCollateralMetadataRef.current,
  nextCollateralMetadata
 );
 const nextGuarantors = customerGuarantorFormToApiRecords(guarantors);
 const guarantorsChanged =
  JSON.stringify(nextGuarantors) !== JSON.stringify(initialGuarantorsRef.current);
 const nextReferences = customerReferenceFormToRecords(references);
 const referencesChanged =
  JSON.stringify(nextReferences) !== JSON.stringify(initialReferencesRef.current);
 const formPatchChanged =
  JSON.stringify(formToPatchBody(form)) !== JSON.stringify(initialFormPatchRef.current);
 const hasNewCollateralImages = customerCollateralRowsWithImages(collateral).length > 0;
 const collateralImagesOnlySave =
  hasNewCollateralImages &&
  !collateralMetadataChanged &&
  !guarantorsChanged &&
  !referencesChanged &&
  !formPatchChanged &&
  !attachments.passport_photo;

 let savedRow = sourceRow;
 if (!collateralImagesOnlySave) {
 const patchBody: Record<string, unknown> = {
  ...formToPatchBody(form),
  is_blacklisted: customer.is_blacklisted,
 };
 if (guarantorsChanged) patchBody.guarantors = nextGuarantors;
 if (referencesChanged) patchBody.references = nextReferences;
 if (collateralMetadataChanged) {
  patchBody.collateral = nextCollateralMetadata;
 }

 const r = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(patchBody),
 });
 const body = (await r.json().catch(() => ({}))) as {
 message?: string;
 error?: string | { message?: string; details?: { field?: string; message?: string }[] };
 details?: { field?: string; message?: string }[];
 };
 if (!r.ok) {
 const nested =
 typeof body.error === "object" && body.error !== null
 ? (body.error as { message?: string; details?: { field?: string; message?: string }[] })
 : null;
 const baseMsg =
 typeof body.message === "string"
 ? body.message
 : typeof body.error === "string"
 ? body.error
 : nested?.message ?? `Update failed (${r.status})`;
 const rawDetails = body.details ?? nested?.details;
 const detailStr = formatValidationDetails(rawDetails);
 setError(detailStr ? `${baseMsg} ${detailStr}` : baseMsg);
 return;
 }
 const row = extractCustomerDetail(body);
 if (!row) {
 setError("Customer details could not be updated. Please try again.");
 return;
 }
 savedRow = row;
 if (collateralMetadataChanged) {
  const detailRes = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
   credentials: "include",
  });
  const detailBody = (await detailRes.json().catch(() => ({}))) as unknown;
  const refreshed = extractCustomerDetail(detailBody);
  if (refreshed) savedRow = refreshed;
 }
 }

 if (attachments.passport_photo) {
  const photoUpload = await uploadCustomerPassportPhoto(customerId, attachments.passport_photo);
  if (!photoUpload.ok) {
   setError(`Customer saved but passport photo upload failed: ${photoUpload.error}`);
   return;
  }
  const detailRes = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
   credentials: "include",
  });
  const detailBody = (await detailRes.json().catch(() => ({}))) as unknown;
  const refreshed = extractCustomerDetail(detailBody);
  if (refreshed) savedRow = refreshed;
 }

 if (customerAttachmentFormHasLocationPhotos(attachments)) {
  const locationUpload = await uploadCustomerLocationPhotos(customerId, attachments);
  if (!locationUpload.ok) {
   setError(`Customer saved but location photo upload failed: ${locationUpload.error}`);
   return;
  }
  const detailRes = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
   credentials: "include",
  });
  const detailBody = (await detailRes.json().catch(() => ({}))) as unknown;
  const refreshed = extractCustomerDetail(detailBody);
  if (refreshed) savedRow = refreshed;
 }

 if (customerAttachmentFormHasSupportingDocuments(attachments)) {
  const supportingUpload = await uploadCustomerSupportingDocuments(customerId, attachments);
  if (!supportingUpload.ok) {
   setError(`Customer saved but supporting document upload failed: ${supportingUpload.error}`);
   return;
  }
  const detailRes = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
   credentials: "include",
  });
  const detailBody = (await detailRes.json().catch(() => ({}))) as unknown;
  const refreshed = extractCustomerDetail(detailBody);
  if (refreshed) savedRow = refreshed;
 }

 if (customerCollateralRowsWithImages(collateral).length > 0) {
  const collateralUpload = await uploadCustomerCollateralImages(customerId, savedRow, collateral);
  if (!collateralUpload.ok) {
   setError(`Customer saved but collateral image upload failed: ${collateralUpload.error}`);
   return;
  }
  const detailRes = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
   credentials: "include",
  });
  const detailBody = (await detailRes.json().catch(() => ({}))) as unknown;
  const refreshed = extractCustomerDetail(detailBody);
  if (refreshed) savedRow = refreshed;
 }

 if (customerGuarantorRowsWithIdFiles(guarantors).length > 0) {
  const guarantorUpload = await uploadCustomerGuarantorIdDocuments(customerId, savedRow, guarantors);
  if (!guarantorUpload.ok) {
   setError(`Customer saved but guarantor document upload failed: ${guarantorUpload.error}`);
   return;
  }
  const postGuarantorUploadRes = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
   credentials: "include",
  });
  const postGuarantorUploadBody = (await postGuarantorUploadRes.json().catch(() => ({}))) as unknown;
  const refreshedAfterGuarantorUpload = extractCustomerDetail(postGuarantorUploadBody);
  if (refreshedAfterGuarantorUpload) savedRow = refreshedAfterGuarantorUpload;
 }

 if (!savedRow) {
 setError("Customer saved but details could not be refreshed.");
 return;
 }

 await submitChangedLocationRequests(
 customerId,
 initialLocationRef.current,
 locationPinsFromForm(form),
 (message, ok) => (ok ? toast.success(message) : toast.error(message))
 );

 onSaved(adaptApiCustomerRowToCustomer(savedRow), savedRow);
 onOpenChange(false);
 } catch {
 setError("Network error. Try again.");
 } finally {
 setSaving(false);
 }
 };

 const header =
 mode === "page" ? (
 <div className="space-y-2">
 <h2 className="text-xl font-semibold tracking-tight">Edit customer</h2>
 <p className="text-sm text-muted-foreground">
 Update KYC, assignment, guarantors, collateral, and attachment details.
 </p>
 </div>
 ) : (
 <DialogHeader>
 <DialogTitle>Edit customer</DialogTitle>
 <DialogDescription>
 Update KYC, assignment, guarantors, collateral, and attachment details.
 </DialogDescription>
 </DialogHeader>
 );

 const content = (
 <>
 {header}

 {!form ? (
 <p className="text-sm text-muted-foreground">Loading form…</p>
 ) : (
 <form onSubmit={handleSubmit} className="space-y-6">
 {error ? <p className="text-sm text-destructive">{error}</p> : null}

 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="edit-branch">Branch</Label>
 <Select
 value={form.branch_id}
 onValueChange={(v) => {
 updateField("branch_id", v);
 if (!lockedOfficerId) void loadOfficersForBranch(v);
 }}
 onOpenChange={(o) => {
 if (o && !lockedBranchId) void loadBranches();
 }}
 disabled={Boolean(lockedBranchId)}
 >
 <SelectTrigger id="edit-branch">
 <SelectValue placeholder={branchesLoading ? "Loading…" : "Select branch"} />
 </SelectTrigger>
 <SelectContent>
 {branchOptions.map((b) => (
 <SelectItem key={b.id} value={b.id}>
 {b.name} ({b.code})
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 {branchesError ? <p className="text-xs text-destructive">{branchesError}</p> : null}
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-officer">Loan officer</Label>
 <Select
 value={form.loan_officer_id}
 onValueChange={(v) => updateField("loan_officer_id", v)}
 onOpenChange={(o) => {
 if (o && form.branch_id && !lockedOfficerId) void loadOfficersForBranch(form.branch_id);
 }}
 disabled={!form.branch_id || Boolean(lockedOfficerId)}
 >
 <SelectTrigger id="edit-officer">
 <SelectValue placeholder={officersLoading ? "Loading…" : "Select officer"} />
 </SelectTrigger>
 <SelectContent>
 {loanOfficerOptions.map((u) => (
 <SelectItem key={u.id} value={u.id}>
 {u.full_name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 {officersError ? <p className="text-xs text-destructive">{officersError}</p> : null}
 </div>
 </div>

 <div className="grid gap-4 md:grid-cols-3">
 <div className="space-y-2">
 <Label htmlFor="edit-fn">First name</Label>
 <Input id="edit-fn" value={form.first_name} onChange={(e) => updateField("first_name", e.target.value)} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-mn">Middle name</Label>
 <Input id="edit-mn" value={form.middle_name} onChange={(e) => updateField("middle_name", e.target.value)} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-ln">Last name</Label>
 <Input id="edit-ln" value={form.last_name} onChange={(e) => updateField("last_name", e.target.value)} />
 </div>
 </div>

 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="edit-dob">Date of birth</Label>
 <Input
 id="edit-dob"
 type="date"
 value={form.date_of_birth.slice(0, 10)}
 onChange={(e) => updateField("date_of_birth", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label>Gender</Label>
 <Select value={form.gender} onValueChange={(v) => updateField("gender", v as "male" | "female")}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="female">Female</SelectItem>
 <SelectItem value="male">Male</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>

 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="edit-phone">Primary phone</Label>
 <Input id="edit-phone" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
 </div>
 <CustomerAdditionalPhonesFields
 value={form.additional_phones}
 onChange={(additional_phones) => updateField("additional_phones", additional_phones)}
 />
 <div className="space-y-2 md:col-span-2">
 <Label htmlFor="edit-email">Email</Label>
 <Input id="edit-email" type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-id-type">ID type</Label>
 <Select value={form.id_type} onValueChange={(v) => updateField("id_type", v)}>
 <SelectTrigger id="edit-id-type">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {CUSTOMER_ID_TYPE_OPTIONS.map((option) => (
 <SelectItem key={option.value} value={option.value}>
 {option.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-nid">ID number</Label>
 {form.id_type === "NIDA" ? (
  <TzValidatedInput
   id="edit-nid"
   kind="nida"
   value={form.national_id}
   onValueChange={(value) => updateField("national_id", value)}
  />
 ) : (
  <Input
   id="edit-nid"
   value={form.national_id}
   onChange={(e) => updateField("national_id", e.target.value)}
  />
 )}
 </div>
 </div>

 <Separator />

 <div className="space-y-2">
 <Label htmlFor="edit-addr">Physical address</Label>
 <Textarea
 id="edit-addr"
 rows={3}
 value={form.physical_address}
 onChange={(e) => updateField("physical_address", e.target.value)}
 />
 </div>
 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="edit-street">Street</Label>
 <Input id="edit-street" value={form.street} onChange={(e) => updateField("street", e.target.value)} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-ward">Ward</Label>
 <Input id="edit-ward" value={form.ward} onChange={(e) => updateField("ward", e.target.value)} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-district">District</Label>
 <Input id="edit-district" value={form.district} onChange={(e) => updateField("district", e.target.value)} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-region">Region</Label>
 <Input id="edit-region" value={form.region} onChange={(e) => updateField("region", e.target.value)} />
 </div>
 </div>
 <CustomerLocationMapPicker
  purpose="home"
  latitude={form.home_latitude}
  longitude={form.home_longitude}
  onPick={(lat, lng) =>
   setForm((prev) =>
    prev ? { ...prev, home_latitude: lat, home_longitude: lng } : prev
   )
  }
  onClear={() =>
   setForm((prev) =>
    prev ? { ...prev, home_latitude: null, home_longitude: null } : prev
   )
  }
 />

 <Separator />

 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="edit-occ">Occupation</Label>
 <Input id="edit-occ" value={form.occupation} onChange={(e) => updateField("occupation", e.target.value)} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-income">Monthly income</Label>
 <MoneyInput
 id="edit-income"
 value={form.monthly_income}
 onValueChange={(value) => updateField("monthly_income", value)}
 />
 </div>
 <div className="space-y-2 md:col-span-2">
 <Label htmlFor="edit-emp-name">Employer name</Label>
 <Input id="edit-emp-name" value={form.employer_name} onChange={(e) => updateField("employer_name", e.target.value)} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-emp-phone">Employer phone</Label>
 <Input
 id="edit-emp-phone"
 value={form.employer_phone}
 onChange={(e) => updateField("employer_phone", e.target.value)}
 />
 </div>
 <div className="space-y-2 md:col-span-2">
 <Label htmlFor="edit-emp-addr">Employer address</Label>
 <Textarea
 id="edit-emp-addr"
 rows={2}
 value={form.employer_address}
 onChange={(e) => updateField("employer_address", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-emp-start">Employment start</Label>
 <Input
 id="edit-emp-start"
 type="date"
 value={form.employment_start_date.slice(0, 10)}
 onChange={(e) => updateField("employment_start_date", e.target.value)}
 />
 </div>
 </div>

 <Separator />

 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="edit-biz-name">Business name</Label>
 <Input id="edit-biz-name" value={form.business_name} onChange={(e) => updateField("business_name", e.target.value)} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-biz-type">Business type</Label>
 <Input id="edit-biz-type" value={form.business_type} onChange={(e) => updateField("business_type", e.target.value)} />
 </div>
 <div className="space-y-2 md:col-span-2">
 <Label htmlFor="edit-biz-addr">Business address</Label>
 <Textarea
 id="edit-biz-addr"
 rows={2}
 value={form.business_address}
 onChange={(e) => updateField("business_address", e.target.value)}
 />
 </div>
 <CustomerLocationMapPicker
  purpose="business"
  latitude={form.business_latitude}
  longitude={form.business_longitude}
  onPick={(lat, lng) =>
   setForm((prev) =>
    prev ? { ...prev, business_latitude: lat, business_longitude: lng } : prev
   )
  }
  onClear={() =>
   setForm((prev) =>
    prev ? { ...prev, business_latitude: null, business_longitude: null } : prev
   )
  }
 />
 <div className="space-y-2">
 <Label htmlFor="edit-biz-reg">Business registration no.</Label>
 <Input
 id="edit-biz-reg"
 value={form.business_registration_no}
 onChange={(e) => updateField("business_registration_no", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-biz-years">Years in business</Label>
 <Input
 id="edit-biz-years"
 type="number"
 min={0}
 value={form.years_in_business}
 onChange={(e) => updateField("years_in_business", e.target.value)}
 />
 </div>
 </div>

 <Separator />

 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="edit-nok-name">Next of kin name</Label>
 <Input id="edit-nok-name" value={form.next_of_kin_name} onChange={(e) => updateField("next_of_kin_name", e.target.value)} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-nok-rel">Relationship</Label>
 <Input
 id="edit-nok-rel"
 value={form.next_of_kin_relationship}
 onChange={(e) => updateField("next_of_kin_relationship", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-nok-phone">Next of kin phone</Label>
 <Input id="edit-nok-phone" value={form.next_of_kin_phone} onChange={(e) => updateField("next_of_kin_phone", e.target.value)} />
 </div>
 <div className="space-y-2 md:col-span-2">
 <Label htmlFor="edit-nok-addr">Next of kin address</Label>
 <Input
 id="edit-nok-addr"
 value={form.next_of_kin_address}
 onChange={(e) => updateField("next_of_kin_address", e.target.value)}
 />
 </div>
 </div>

 <Separator />

 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label>Status</Label>
 <Select value={form.status} onValueChange={(v) => updateField("status", v as CustomerStatus)}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {STATUS_OPTIONS.map((o) => (
 <SelectItem key={o.value} value={o.value}>
 {o.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-pay-ref">Payment reference</Label>
 <Input
 id="edit-pay-ref"
 value={form.payment_reference}
readOnly
disabled
 />
 </div>
 <div className="space-y-2">
 <Label>Risk level</Label>
 <Select value={form.risk_level} onValueChange={(v) => updateField("risk_level", v as RiskLevel)}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {RISK_LEVEL_OPTIONS.map((o) => (
 <SelectItem key={o.value} value={o.value}>
 {o.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-risk-score">Credit / risk score</Label>
 <Input
 id="edit-risk-score"
 type="number"
 min={0}
 max={999}
 value={form.risk_score}
 onChange={(e) => updateField("risk_score", e.target.value)}
 />
 </div>
 <div className="space-y-2 md:col-span-2">
 <Label htmlFor="edit-notes">Notes</Label>
 <Textarea id="edit-notes" rows={2} value={form.notes} onChange={(e) => updateField("notes", e.target.value)} />
 </div>
 <div className="flex items-center gap-2 md:col-span-2">
 <Checkbox
 id="edit-reg-paid"
 checked={form.registration_fee_paid}
 disabled
 />
 <Label htmlFor="edit-reg-paid" className="font-normal text-muted-foreground">
 Registration fee paid (updated automatically by ClickPesa)
 </Label>
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-reg-amt">Registration fee amount</Label>
 <MoneyInput
 id="edit-reg-amt"
 value={form.registration_fee_amount}
 onValueChange={(value) => updateField("registration_fee_amount", value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-reg-at">Registration fee paid at</Label>
 <Input
 id="edit-reg-at"
 type="datetime-local"
 value={form.registration_fee_paid_at}
 disabled
 />
 <p className="text-xs text-muted-foreground">Set by the backend when ClickPesa confirms payment.</p>
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-cheque">Cheque number</Label>
 <Input id="edit-cheque" value={form.cheque_number} onChange={(e) => updateField("cheque_number", e.target.value)} />
 </div>
 </div>

 <Separator />

 <div className="space-y-1">
 <p className="text-sm font-semibold">Guarantors</p>
          <p className="text-xs text-muted-foreground">
            Add guarantors with ID type, sex, and a circular passport photo upload
            (<span className="font-mono text-[11px]">guarantor_passport_photo</span>).
            ID front and back scans link directly to the guarantor record.
          </p>
        </div>
        <CustomerGuarantorsFields
          value={guarantors}
          onChange={setGuarantors}
          customerId={customerId}
          onDeleteExistingDocument={deleteCustomerDocument}
          removingDocumentIds={removingDocumentIds}
          onDeleteGuarantor={deleteCustomerGuarantor}
        />

 <Separator />

 <div className="space-y-1">
 <p className="text-sm font-semibold">Collateral</p>
 <p className="text-xs text-muted-foreground">
  Optional collateral on this customer profile. Add the type, value, and description.
 </p>
 </div>
 <CustomerCollateralFields
 value={collateral}
 onChange={setCollateral}
 onDeleteExistingImage={deleteCustomerDocument}
 removingDocumentIds={removingDocumentIds}
 />

 <Separator />

 <div className="space-y-1">
 <p className="text-sm font-semibold">References</p>
 <p className="text-xs text-muted-foreground">
  Friends or family contacts who can be reached if the customer is unavailable.
 </p>
 </div>
 <CustomerReferencesFields value={references} onChange={setReferences} />

 <Separator />

 <div className="space-y-1">
 <p className="text-sm font-semibold">Attachments</p>
 <p className="text-xs text-muted-foreground">
  Passport photo, location photos, and supporting documents. New files upload when you save.
 </p>
 </div>
 <CustomerAttachmentsFields
 value={attachments}
 onChange={setAttachments}
 existingPassportUrl={existingPassportUrl}
 existingPassportPreviewUrl={existingPassportPreviewUrl}
 existingHomePhotos={existingAttachments.homeLocationPhotos}
 existingBusinessPhotos={existingAttachments.businessLocationPhotos}
 existingDocuments={existingAttachments.supportingDocuments}
 onRemoveExistingDocument={deleteCustomerDocument}
 removingDocumentIds={removingDocumentIds}
 />

 <DialogFooter className="gap-2 sm:gap-0">
 <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
 Cancel
 </Button>
 <Button type="submit" disabled={saving}>
 {saving ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Saving…
 </>
 ) : (
 "Save changes"
 )}
 </Button>
 </DialogFooter>
 </form>
 )}
 </>
 );

 if (mode === "page") {
 return <div className="space-y-6">{content}</div>;
 }

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
 {content}
 </DialogContent>
 </Dialog>
 );
}
