"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Home,
  Loader2,
  MapPin,
  Paperclip,
  Save,
  Search,
  Store,
  UserPlus,
  Users,
} from "lucide-react";
import { CustomerAttachmentsFields } from "@/components/customers/customer-attachments-fields";
import { CustomerCollateralFields } from "@/components/customers/customer-collateral-fields";
import { CustomerGuarantorsFields } from "@/components/customers/customer-guarantors-fields";
import { CustomerReferencesFields } from "@/components/customers/customer-references-fields";
import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Branch, User } from "@/lib/types";
import {
 activeBranchesForAssignment,
 loanOfficersForBranch,
} from "@/lib/customer-assignment-options";
import {
 emptyCustomerAttachments,
 type CustomerAttachmentFormState,
} from "@/lib/customer-attachments";
import { useOptionalOfficerSession } from "@/components/officer-session-context";
import { MoneyInput } from "@/components/forms/money-input";
import {
  FormFieldMessage,
  formControlErrorClass,
  formControlErrorProps,
} from "@/components/forms/form-field-message";
import { TzValidatedInput } from "@/components/forms/tz-validated-input";
import { parseMoneyInput } from "@/lib/money-input";
import type { SessionUser } from "@/lib/auth";
import { syntheticBranchFromSession } from "@/lib/branch-scope";
import { validateCustomerCreateForm } from "@/lib/customer-create-form-validation";
import {
  apiDetailsToFieldErrors,
  clearFieldErrorsByPrefix,
  formFieldLabel,
  scrollToFormField,
  summarizeFieldErrors,
  type FormFieldErrors,
} from "@/lib/customer-form-errors";
import { parseLeadPrefillFromSearchParams } from "@/lib/lead-to-customer-prefill";
import {
  customerCollateralFormToMetadataRecords,
  customerCollateralRowsWithImages,
  defaultCustomerCollateralForm,
  type CustomerCollateralFormRow,
} from "@/lib/customer-collateral";
import {
  customerGuarantorFormToApiRecords,
  customerGuarantorRowsWithIdFiles,
  defaultCustomerGuarantorForm,
  type CustomerGuarantorFormRow,
} from "@/lib/customer-guarantors";
import {
  customerReferenceFormToRecords,
  defaultCustomerReferenceForm,
  type CustomerReferenceFormRow,
} from "@/lib/customer-references";
import { uploadCustomerCollateralImages } from "@/lib/customer-collateral-uploads";
import { uploadCustomerGuarantorIdDocuments } from "@/lib/customer-guarantor-uploads";
import {
  customerAttachmentFormHasLocationPhotos,
  uploadCustomerLocationPhotos,
} from "@/lib/customer-location-photo-uploads";
import { uploadCustomerPassportPhoto } from "@/lib/customer-photo-uploads";
import { extractCustomerDetail } from "@/lib/customer-adapters";
import { parseNominatimAddress, reverseGeocodeNominatim } from "@/lib/nominatim";
import { searchPlacesInTanzania, type PlaceSuggestion } from "@/lib/nominatim-search";
import { useSessionUser } from "@/lib/use-session-user";

const CustomerLocationMapPicker = dynamic(
  () =>
    import("@/components/customers/business-location-map-picker").then(
      (mod) => mod.CustomerLocationMapPicker
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[220px] w-full rounded-md border border-border" />,
  }
);

type CustomerStatus =
 | "pending_registration_fee"
 | "active"
 | "suspended"
 | "blacklisted"
 | "inactive";

type RiskLevel = "low" | "medium" | "high" | "critical";

type CustomerCreateForm = {
 full_name: string;
 phone: string;
 alt_phone: string;
 email: string;
 physical_address: string;
 home_latitude: number | null;
 home_longitude: number | null;
 street: string;
 ward: string;
 district: string;
 region: string;
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

const ID_TYPE_OPTIONS = ["NIDA", "Passport", "Driving License", "Voter ID"];

const defaultForm: CustomerCreateForm = {
 full_name: "",
 phone: "",
 alt_phone: "",
 email: "",
 physical_address: "",
 home_latitude: null,
 home_longitude: null,
 street: "",
 ward: "",
 district: "",
 region: "",
 national_id: "",
 id_type: "NIDA",
 occupation: "",
 employer_name: "",
 employer_address: "",
 employer_phone: "",
 employment_start_date: "",
 monthly_income: "",
 business_name: "",
 business_type: "",
 business_address: "",
 business_latitude: null,
 business_longitude: null,
 business_registration_no: "",
 years_in_business: "",
 cheque_number: "",
 payment_reference: "",
 registration_fee_paid: false,
 registration_fee_amount: "",
 registration_fee_paid_at: "",
 status: "pending_registration_fee",
 risk_level: "low",
 risk_score: "0",
 notes: "",
 branch_id: "",
 loan_officer_id: "",
 created_by: "",
};

function sessionUserToLoanOfficer(user: Pick<SessionUser, "id" | "email" | "full_name" | "branch_id">): User {
 return {
 id: user.id,
 email: user.email,
 full_name: user.full_name,
 role: "loan_officer",
 branch_id: user.branch_id ?? "",
 phone: "",
 employee_id: "",
 is_active: true,
 created_at: new Date().toISOString(),
 last_login: null,
 };
}

function officerAssignmentDefaults(user: Pick<SessionUser, "id" | "branch_id">): Partial<CustomerCreateForm> {
 const branchId = user.branch_id?.trim() ?? "";
 if (!branchId) return { created_by: user.id };
 return {
 created_by: user.id,
 branch_id: branchId,
 loan_officer_id: user.id,
 };
}

function NewCustomerPageInner() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const portalOfficer = useOptionalOfficerSession();
 const { user: clientUser, loaded: clientSessionLoaded } = useSessionUser();
 const user = portalOfficer ?? clientUser;
 const sessionLoaded = Boolean(portalOfficer) || clientSessionLoaded;
 const effectiveUserId = user?.id ?? "";
 const isManagerView = user?.role === "branch_manager";
 const isOfficerView = user?.role === "loan_officer";
 const isScopedRole = isManagerView || isOfficerView;
 const lockedBranchId = isScopedRole ? user?.branch_id?.trim() ?? "" : "";
 const lockedOfficerId = isOfficerView ? effectiveUserId : "";
 const customersBasePath = isManagerView ? "/manager/customers" : isOfficerView ? "/officer/customers" : "/customers";
 const [form, setForm] = useState<CustomerCreateForm>(() => ({
 ...defaultForm,
 ...(portalOfficer ? officerAssignmentDefaults(portalOfficer) : {}),
 }));
 const [error, setError] = useState("");
 const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
 const [submitting, setSubmitting] = useState(false);
 const [placeSuggestions, setPlaceSuggestions] = useState<PlaceSuggestion[]>([]);
 const [streetSuggestions, setStreetSuggestions] = useState<PlaceSuggestion[]>([]);
 const [loadingPlaceSuggestions, setLoadingPlaceSuggestions] = useState(false);
 const [loadingStreetSuggestions, setLoadingStreetSuggestions] = useState(false);
 const [activePlaceSuggestionIndex, setActivePlaceSuggestionIndex] = useState(-1);
 const [activeStreetSuggestionIndex, setActiveStreetSuggestionIndex] = useState(-1);
 const [browseLocationQuery, setBrowseLocationQuery] = useState("");
 const [browseSuggestions, setBrowseSuggestions] = useState<PlaceSuggestion[]>([]);
 const [loadingBrowseSuggestions, setLoadingBrowseSuggestions] = useState(false);
 const [resolvingHomeLocation, setResolvingHomeLocation] = useState(false);
 const [branchRecords, setBranchRecords] = useState<Branch[]>(() =>
 portalOfficer?.branch_id?.trim() ? [syntheticBranchFromSession(portalOfficer)] : []
 );
 const [branchesLoading, setBranchesLoading] = useState(false);
 const [branchesError, setBranchesError] = useState("");
 const [loanOfficers, setLoanOfficers] = useState<User[]>(() =>
 portalOfficer?.role === "loan_officer" ? [sessionUserToLoanOfficer(portalOfficer)] : []
 );
 const [officersLoading, setOfficersLoading] = useState(false);
 const [officersError, setOfficersError] = useState("");
 const [attachments, setAttachments] = useState<CustomerAttachmentFormState>(emptyCustomerAttachments);
 const [guarantors, setGuarantors] = useState<CustomerGuarantorFormRow[]>(defaultCustomerGuarantorForm);
 const [collateral, setCollateral] = useState<CustomerCollateralFormRow[]>(defaultCustomerCollateralForm);
 const [references, setReferences] = useState<CustomerReferenceFormRow[]>(defaultCustomerReferenceForm);

 const attachmentCount =
  (attachments.passport_photo ? 1 : 0) +
  attachments.home_location_photos.length +
  attachments.business_location_photos.length +
  attachments.supporting_documents.length;

 const [leadPrefillId, setLeadPrefillId] = useState<string | null>(null);
 const appliedLeadPrefillRef = useRef(false);

 useEffect(() => {
  if (appliedLeadPrefillRef.current) return;
  const { leadId, fields } = parseLeadPrefillFromSearchParams(searchParams);
  if (!leadId) return;
  appliedLeadPrefillRef.current = true;
  setLeadPrefillId(leadId);
  const parsedLat = fields.lat ? Number(fields.lat) : NaN;
  const parsedLng = fields.lng ? Number(fields.lng) : NaN;
  const homeLat = !Number.isNaN(parsedLat) && parsedLat >= -90 && parsedLat <= 90 ? parsedLat : null;
  const homeLng = !Number.isNaN(parsedLng) && parsedLng >= -180 && parsedLng <= 180 ? parsedLng : null;
  setForm((prev) => ({
   ...prev,
   full_name: fields.full_name || prev.full_name,
   phone: fields.phone || prev.phone,
   alt_phone: fields.alt_phone || prev.alt_phone,
   region: fields.region || prev.region,
   district: fields.district || prev.district,
   ward: fields.ward || prev.ward,
   street: fields.street || prev.street,
   notes: fields.notes || prev.notes,
   branch_id: fields.branch_id || prev.branch_id,
   home_latitude: homeLat ?? prev.home_latitude,
   home_longitude: homeLng ?? prev.home_longitude,
  }));
 }, [searchParams]);

 const loadBranches = useCallback(async () => {
 if (lockedBranchId && user) {
 setBranchesError("");
 setBranchRecords([syntheticBranchFromSession(user)]);
 return;
 }
 if (lockedBranchId) {
 setBranchesError("");
 setBranchRecords([
 {
 id: lockedBranchId,
 name: `Branch ${lockedBranchId}`,
 code: lockedBranchId,
 region: "",
 address: "",
 phone: "",
 manager_id: "",
 is_active: true,
 },
 ]);
 return;
 }
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
 }, [lockedBranchId, user]);

 const loadOfficersForBranch = useCallback(
 async (branchId?: string) => {
 if (lockedOfficerId && user) {
 setOfficersError("");
 setOfficersLoading(false);
 setLoanOfficers([sessionUserToLoanOfficer(user)]);
 return;
 }
 const targetBranchId = String(branchId ?? form.branch_id).trim();
 if (!targetBranchId) {
 setLoanOfficers([]);
 setOfficersError("");
 setOfficersLoading(false);
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
 [form.branch_id, lockedOfficerId, user]
 );

 useEffect(() => {
 void loadBranches();
 }, [loadBranches]);

 useEffect(() => {
 void loadOfficersForBranch();
 }, [loadOfficersForBranch]);

 useEffect(() => {
 if (!user) return;
 if (isOfficerView && user.branch_id?.trim()) {
 setBranchRecords([syntheticBranchFromSession(user)]);
 setLoanOfficers([sessionUserToLoanOfficer(user)]);
 }
 setForm((prev) => ({
 ...prev,
 created_by: effectiveUserId,
 branch_id: lockedBranchId || prev.branch_id,
 loan_officer_id: lockedOfficerId || prev.loan_officer_id,
 }));
 }, [effectiveUserId, lockedBranchId, lockedOfficerId, isOfficerView, user]);

 const effectiveBranchId = form.branch_id || lockedBranchId;
 const effectiveOfficerId = form.loan_officer_id || lockedOfficerId;

 const branchOptions = useMemo(
 () => activeBranchesForAssignment(branchRecords, lockedBranchId),
 [branchRecords, lockedBranchId]
 );
 const loanOfficerOptions = useMemo(
 () => loanOfficersForBranch(loanOfficers, effectiveBranchId),
 [loanOfficers, effectiveBranchId]
 );
 const selectedBranch = branchOptions.find((branch) => branch.id === effectiveBranchId);
 const selectedOfficer = loanOfficerOptions.find((officer) => officer.id === effectiveOfficerId);

 const updateField = <K extends keyof CustomerCreateForm>(key: K, value: CustomerCreateForm[K]) => {
 setFieldErrors((prev) => {
  if (!prev[String(key)]) return prev;
  const next = { ...prev };
  delete next[String(key)];
  return next;
 });
 setForm((prev) => {
 if (key === "branch_id") {
 return { ...prev, branch_id: value as string, loan_officer_id: "" };
 }
 return { ...prev, [key]: value };
 });
 };

 const handleGuarantorsChange = (rows: CustomerGuarantorFormRow[]) => {
  setGuarantors(rows);
  setFieldErrors((prev) => clearFieldErrorsByPrefix(prev, "guarantors."));
 };

 const handleCollateralChange = (rows: CustomerCollateralFormRow[]) => {
  setCollateral(rows);
  setFieldErrors((prev) => clearFieldErrorsByPrefix(prev, "collateral."));
 };

 const handleReferencesChange = (rows: CustomerReferenceFormRow[]) => {
  setReferences(rows);
  setFieldErrors((prev) => clearFieldErrorsByPrefix(prev, "references."));
 };

 const handleAttachmentsChange = (next: CustomerAttachmentFormState) => {
  setAttachments(next);
  setFieldErrors((prev) => clearFieldErrorsByPrefix(prev, "attachments."));
 };

 const applyValidationErrors = (errors: FormFieldErrors) => {
  setFieldErrors(errors);
  setError(summarizeFieldErrors(errors));
  const firstKey = Object.keys(errors).find((key) => key !== "_form") ?? Object.keys(errors)[0];
  if (firstKey) scrollToFormField(firstKey);
 };

 const applyAddressPartsToForm = (
 suggestion: PlaceSuggestion | { address?: PlaceSuggestion["address"]; display_name: string; lat?: string; lon?: string },
 options?: { includeCoordinates?: boolean }
 ) => {
 const place = parseNominatimAddress(suggestion.address, suggestion.display_name);
 const lat = suggestion.lat != null ? Number(suggestion.lat) : NaN;
 const lng = suggestion.lon != null ? Number(suggestion.lon) : NaN;
 const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

 setForm((prev) => ({
 ...prev,
 physical_address: place.displayName || suggestion.display_name || prev.physical_address,
 street: place.locationName || prev.street,
 ward: place.ward || prev.ward,
 district: place.district || prev.district,
 region: place.region || prev.region,
 ...(options?.includeCoordinates !== false && hasCoords
 ? { home_latitude: lat, home_longitude: lng }
 : {}),
 }));
 };

 const handleHomeLocationPick = async (lat: number, lng: number) => {
 setForm((prev) => ({ ...prev, home_latitude: lat, home_longitude: lng }));
 setResolvingHomeLocation(true);
 try {
 const place = await reverseGeocodeNominatim(lat, lng);
 setForm((prev) => ({
 ...prev,
 home_latitude: lat,
 home_longitude: lng,
 physical_address: place.displayName || prev.physical_address,
 street: place.locationName || prev.street,
 ward: place.ward || prev.ward,
 district: place.district || prev.district,
 region: place.region || prev.region,
 }));
 } catch {
 /* keep coordinates even if reverse geocode fails */
 } finally {
 setResolvingHomeLocation(false);
 }
 };

 useEffect(() => {
 const value = browseLocationQuery.trim();
 if (value.length < 3) {
 setBrowseSuggestions([]);
 setLoadingBrowseSuggestions(false);
 return;
 }
 const timeout = setTimeout(async () => {
 setLoadingBrowseSuggestions(true);
 try {
 const results = await searchPlacesInTanzania(value, { limit: 6 });
 setBrowseSuggestions(results);
 } catch {
 setBrowseSuggestions([]);
 } finally {
 setLoadingBrowseSuggestions(false);
 }
 }, 350);
 return () => clearTimeout(timeout);
 }, [browseLocationQuery]);

 useEffect(() => {
 const value = form.physical_address.trim();
 if (value.length < 3) {
 setPlaceSuggestions([]);
 setActivePlaceSuggestionIndex(-1);
 setLoadingPlaceSuggestions(false);
 return;
 }
 const timeout = setTimeout(async () => {
 setLoadingPlaceSuggestions(true);
 try {
 const results = await searchPlacesInTanzania(value, { limit: 5 });
 setPlaceSuggestions(results);
 setActivePlaceSuggestionIndex(results.length > 0 ? 0 : -1);
 } catch {
 setPlaceSuggestions([]);
 setActivePlaceSuggestionIndex(-1);
 } finally {
 setLoadingPlaceSuggestions(false);
 }
 }, 350);
 return () => clearTimeout(timeout);
 }, [form.physical_address]);

 useEffect(() => {
 const value = form.street.trim();
 if (value.length < 2) {
 setStreetSuggestions([]);
 setActiveStreetSuggestionIndex(-1);
 setLoadingStreetSuggestions(false);
 return;
 }
 const timeout = setTimeout(async () => {
 setLoadingStreetSuggestions(true);
 const context = [form.district, form.region, "Tanzania"].filter(Boolean).join(", ");
 try {
 const results = await searchPlacesInTanzania(value, { context, limit: 5 });
 setStreetSuggestions(results);
 setActiveStreetSuggestionIndex(results.length > 0 ? 0 : -1);
 } catch {
 setStreetSuggestions([]);
 setActiveStreetSuggestionIndex(-1);
 } finally {
 setLoadingStreetSuggestions(false);
 }
 }, 350);
 return () => clearTimeout(timeout);
 }, [form.street, form.district, form.region]);

 const applySuggestionToForm = (suggestion: PlaceSuggestion) => {
 applyAddressPartsToForm(suggestion);
 };

 const handlePhysicalAddressKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
 if (placeSuggestions.length === 0) return;
 if (event.key === "ArrowDown") {
 event.preventDefault();
 setActivePlaceSuggestionIndex((prev) => (prev + 1) % placeSuggestions.length);
 return;
 }
 if (event.key === "ArrowUp") {
 event.preventDefault();
 setActivePlaceSuggestionIndex((prev) => (prev <= 0 ? placeSuggestions.length - 1 : prev - 1));
 return;
 }
 if (event.key === "Enter" && activePlaceSuggestionIndex >= 0) {
 event.preventDefault();
 applySuggestionToForm(placeSuggestions[activePlaceSuggestionIndex]);
 setPlaceSuggestions([]);
 setActivePlaceSuggestionIndex(-1);
 return;
 }
 if (event.key === "Escape") {
 setPlaceSuggestions([]);
 setActivePlaceSuggestionIndex(-1);
 }
 };

 const handleStreetKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
 if (streetSuggestions.length === 0) return;
 if (event.key === "ArrowDown") {
 event.preventDefault();
 setActiveStreetSuggestionIndex((prev) => (prev + 1) % streetSuggestions.length);
 return;
 }
 if (event.key === "ArrowUp") {
 event.preventDefault();
 setActiveStreetSuggestionIndex((prev) => (prev <= 0 ? streetSuggestions.length - 1 : prev - 1));
 return;
 }
 if (event.key === "Enter" && activeStreetSuggestionIndex >= 0) {
 event.preventDefault();
 applySuggestionToForm(streetSuggestions[activeStreetSuggestionIndex]);
 setStreetSuggestions([]);
 setActiveStreetSuggestionIndex(-1);
 return;
 }
 if (event.key === "Escape") {
 setStreetSuggestions([]);
 setActiveStreetSuggestionIndex(-1);
 }
 };

 const buildPayload = () => ({
 full_name: form.full_name.trim(),
 phone: form.phone.trim(),
 alt_phone: form.alt_phone.trim() || null,
 email: form.email.trim() || null,
 physical_address: form.physical_address.trim(),
 home_latitude: form.home_latitude,
 home_longitude: form.home_longitude,
 street: form.street.trim() || null,
 ward: form.ward.trim() || null,
 district: form.district.trim() || null,
 region: form.region.trim() || null,
 national_id: form.national_id.trim(),
 id_type: form.id_type,
 occupation: form.occupation.trim() || null,
 employer_name: form.employer_name.trim() || null,
 employer_address: form.employer_address.trim() || null,
 employer_phone: form.employer_phone.trim() || null,
 employment_start_date: form.employment_start_date || null,
 monthly_income: form.monthly_income ? parseMoneyInput(form.monthly_income) : null,
 business_name: form.business_name.trim() || null,
 business_type: form.business_type.trim() || null,
 business_address: form.business_address.trim() || null,
 business_latitude: form.business_latitude,
 business_longitude: form.business_longitude,
 business_registration_no: form.business_registration_no.trim() || null,
 years_in_business: form.years_in_business ? Number(form.years_in_business) : null,
 cheque_number: form.cheque_number.trim() || null,
 payment_reference: form.payment_reference.trim(),
 registration_fee_paid: form.registration_fee_paid,
 registration_fee_amount: form.registration_fee_amount
 ? parseMoneyInput(form.registration_fee_amount)
 : null,
 registration_fee_paid_at: form.registration_fee_paid_at || null,
 status: form.status,
 risk_level: form.risk_level,
 risk_score: Number(form.risk_score || 0),
 notes: form.notes.trim() || null,
 loan_officer_id: effectiveOfficerId || form.loan_officer_id,
 branch_id: effectiveBranchId || form.branch_id,
 created_by: form.created_by,
 guarantors: customerGuarantorFormToApiRecords(guarantors),
 collateral: customerCollateralFormToMetadataRecords(collateral),
 references: customerReferenceFormToRecords(references),
 });

 const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
 event.preventDefault();
 setError("");
 setFieldErrors({});

 const validationErrors = validateCustomerCreateForm({
  form,
  sessionLoaded,
  user,
  isOfficerView,
  lockedBranchId,
  guarantors,
  collateral,
  references,
  attachments,
 });
 if (Object.keys(validationErrors).length > 0) {
  applyValidationErrors(validationErrors);
  return;
 }

 const payload = buildPayload();
 const customerEndpoint = process.env.NEXT_PUBLIC_CUSTOMERS_API_URL || "/api/customers";

 setSubmitting(true);
 try {
 const response = await fetch(customerEndpoint, {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(payload),
 });

 const responseBody = (await response.json().catch(() => ({}))) as {
 message?: string;
 error?: string | { message?: string; details?: { field?: string; message?: string }[] };
 details?: { field?: string; message?: string }[];
 code?: string;
 customer?: unknown;
 };
 if (!response.ok) {
 const nested =
 typeof responseBody.error === "object" && responseBody.error !== null
 ? (responseBody.error as { message?: string; details?: { field?: string; message?: string }[] })
 : null;
 const baseMsg =
 typeof responseBody.message === "string"
 ? responseBody.message
 : typeof responseBody.error === "string"
 ? responseBody.error
 : nested?.message ?? `Customer create failed (${response.status})`;
 const rawDetails = responseBody.details ?? nested?.details;
 const apiFieldErrors = apiDetailsToFieldErrors(rawDetails);
 if (Object.keys(apiFieldErrors).length > 0) {
  applyValidationErrors(apiFieldErrors);
  if (apiFieldErrors._form) {
   setError(apiFieldErrors._form);
  } else {
   setError(baseMsg);
  }
  return;
 }
 setError(baseMsg);
 return;
 }

 const createdRow = extractCustomerDetail(responseBody);
 const createdId = createdRow?.id != null ? String(createdRow.id) : "";
 if (createdId && attachments.passport_photo) {
  const photoUpload = await uploadCustomerPassportPhoto(createdId, attachments.passport_photo);
  if (!photoUpload.ok) {
   setError(`Customer created but passport photo upload failed: ${photoUpload.error}`);
   return;
  }
 }
 if (createdId && customerAttachmentFormHasLocationPhotos(attachments)) {
  const locationUpload = await uploadCustomerLocationPhotos(createdId, attachments);
  if (!locationUpload.ok) {
   setError(`Customer created but location photo upload failed: ${locationUpload.error}`);
   return;
  }
 }
 if (createdId && customerCollateralRowsWithImages(collateral).length > 0) {
  const detailRes = await fetch(`/api/customers/${encodeURIComponent(createdId)}`, {
   credentials: "include",
  });
  const detailBody = (await detailRes.json().catch(() => ({}))) as unknown;
  const detailRow = extractCustomerDetail(detailBody);
  const collateralUpload = await uploadCustomerCollateralImages(createdId, detailRow, collateral);
  if (!collateralUpload.ok) {
   setError(`Customer created but collateral image upload failed: ${collateralUpload.error}`);
   return;
  }
 }
 if (createdId && customerGuarantorRowsWithIdFiles(guarantors).length > 0) {
  const detailRes = await fetch(`/api/customers/${encodeURIComponent(createdId)}`, {
   credentials: "include",
  });
  const detailBody = (await detailRes.json().catch(() => ({}))) as unknown;
  const detailRow = extractCustomerDetail(detailBody);
  const guarantorUpload = await uploadCustomerGuarantorIdDocuments(createdId, detailRow, guarantors);
  if (!guarantorUpload.ok) {
   setError(`Customer created but guarantor ID upload failed: ${guarantorUpload.error}`);
   return;
  }
 }

 router.replace(customersBasePath);
 } catch (submitError) {
 console.error("create customer request", payload, submitError);
 setError("Unable to create customer. Check your connection and try again.");
 } finally {
 setSubmitting(false);
 }
 };

 return (
 <>
 <DashboardHeader
 title="Create Customer"
 description="Capture complete customer details for onboarding."
 />
 {!sessionLoaded ? (
 <main className="flex-1 p-4 lg:p-6">
 <p className="text-sm text-muted-foreground">Loading your session…</p>
 </main>
 ) : isOfficerView && !user?.branch_id?.trim() ? (
 <main className="flex-1 p-4 lg:p-6">
 <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
 Your account is not linked to a branch. You cannot register customers until an administrator assigns you to a branch.
 </p>
 <Button variant="outline" className="mt-4" asChild>
 <Link href={customersBasePath}>Back to Customers</Link>
 </Button>
 </main>
 ) : (
 <main className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-smooth p-4 pb-10 lg:p-6 lg:pb-8">
 <div className="mx-auto max-w-6xl space-y-6">
 <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-background p-4">
 <div className="space-y-1">
 <p className="text-sm font-semibold text-emerald-800">Customer Onboarding Workspace</p>
 <p className="text-xs text-muted-foreground">
 Smart assignment enabled: selecting a branch automatically filters available loan officers.
 </p>
 </div>
 <Button variant="outline" asChild>
 <Link href={customersBasePath}>
 <ArrowLeft className="mr-2 h-4 w-4" />
 Back to Customers
 </Link>
 </Button>
 </div>

 {leadPrefillId ? (
  <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
   <p className="font-medium">Pre-filled from lead</p>
   <p className="mt-0.5 text-xs text-amber-800">
    Details from lead {leadPrefillId} were copied into this form. Complete the remaining fields and save to register the customer.
   </p>
  </div>
 ) : null}

 <form onSubmit={handleSubmit} className="space-y-6">
 <div className="grid gap-6 lg:grid-cols-3">
 <div className="space-y-6 lg:col-span-2">
 {Object.keys(fieldErrors).length > 0 ? (
  <Card className="border-destructive/30 bg-destructive/5">
   <CardHeader className="pb-2">
    <CardTitle className="text-sm text-destructive">Please fix the following fields</CardTitle>
    <CardDescription className="text-destructive/90">
     {error || summarizeFieldErrors(fieldErrors)}
    </CardDescription>
   </CardHeader>
   <CardContent>
    <ul className="space-y-1 text-xs text-destructive">
     {Object.entries(fieldErrors).map(([field, message]) => (
      <li key={field}>
       <button
        type="button"
        className="text-left underline-offset-2 hover:underline"
        onClick={() => scrollToFormField(field)}
       >
        <span className="font-medium">{formFieldLabel(field)}:</span> {message}
       </button>
      </li>
     ))}
    </ul>
   </CardContent>
  </Card>
 ) : null}
 <Card>
 <CardHeader>
 <CardTitle>Assignment & System Controls</CardTitle>
 <CardDescription>
 Choose the branch where this customer will be served and the loan officer who will manage the relationship.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2" data-form-field="branch_id">
 <Label htmlFor="branch">Branch</Label>
 <p className="text-xs text-muted-foreground">
 Select the branch that will manage this customer. Reopen the list if a branch you expect is missing.
 </p>
 <Select
 value={effectiveBranchId || undefined}
 onValueChange={(value) => {
 updateField("branch_id", value);
 if (!lockedOfficerId) void loadOfficersForBranch(value);
 }}
 onOpenChange={(open) => {
 if (open && !lockedBranchId) void loadBranches();
 }}
 disabled={Boolean(lockedBranchId)}
 >
 <SelectTrigger
 id="branch"
 className={formControlErrorClass(Boolean(fieldErrors.branch_id))}
 {...formControlErrorProps(fieldErrors.branch_id)}
 >
 <SelectValue placeholder={branchesLoading ? "Loading branches…" : "Select branch"} />
 </SelectTrigger>
 <SelectContent>
 {branchOptions.length === 0 && !branchesLoading ? (
 <div className="px-2 py-3 text-sm text-muted-foreground">No branches available.</div>
 ) : null}
 {branchOptions.map((branch) => (
 <SelectItem key={branch.id} value={branch.id}>
 {branch.name} ({branch.code})
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 {branchesError ? <p className="text-xs text-destructive">{branchesError}</p> : null}
 <FormFieldMessage message={fieldErrors.branch_id} />
 </div>
 <div className="space-y-2" data-form-field="loan_officer_id">
 <Label htmlFor="loan-officer">Loan Officer</Label>
 <p className="text-xs text-muted-foreground">
 Only loan officers assigned to the selected branch are listed. Pick the officer responsible for this customer.
 </p>
 <Select
 value={effectiveOfficerId || undefined}
 onValueChange={(value) => updateField("loan_officer_id", value)}
 onOpenChange={(open) => {
 if (open && effectiveBranchId && !lockedOfficerId) void loadOfficersForBranch(effectiveBranchId);
 }}
 disabled={!effectiveBranchId || Boolean(lockedOfficerId)}
 >
 <SelectTrigger
 id="loan-officer"
 className={formControlErrorClass(Boolean(fieldErrors.loan_officer_id))}
 {...formControlErrorProps(fieldErrors.loan_officer_id)}
 >
 <SelectValue
 placeholder={
 !effectiveBranchId
 ? "Select branch first"
 : officersLoading
 ? "Loading officers…"
 : selectedOfficer?.full_name ?? "Select loan officer"
 }
 />
 </SelectTrigger>
 <SelectContent>
 {loanOfficerOptions.length === 0 && !officersLoading ? (
 <div className="px-2 py-3 text-sm text-muted-foreground">
 No active loan officers for this branch in the directory.
 </div>
 ) : null}
 {loanOfficerOptions.map((officer) => (
 <SelectItem key={officer.id} value={officer.id}>
 {officer.full_name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 {officersError ? <p className="text-xs text-destructive">{officersError}</p> : null}
 <FormFieldMessage message={fieldErrors.loan_officer_id} />
 </div>
 </div>
 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="status">Status</Label>
 <Select value={form.status} onValueChange={(value) => updateField("status", value as CustomerStatus)}>
 <SelectTrigger id="status">
 <SelectValue placeholder="Status" />
 </SelectTrigger>
 <SelectContent>
 {STATUS_OPTIONS.map((item) => (
 <SelectItem key={item.value} value={item.value}>
 {item.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2" data-form-field="payment_reference">
 <Label htmlFor="payment-reference">Payment Reference</Label>
 <Input
 id="payment-reference"
 value={form.payment_reference}
 className={formControlErrorClass(Boolean(fieldErrors.payment_reference))}
 {...formControlErrorProps(fieldErrors.payment_reference)}
 onChange={(event) => updateField("payment_reference", event.target.value)}
 placeholder="e.g., REF-FFS-2026-00012"
 />
 <FormFieldMessage message={fieldErrors.payment_reference} />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Personal & Contact Information</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2 md:col-span-2" data-form-field="full_name">
 <Label htmlFor="full-name">Full Name</Label>
 <Input
 id="full-name"
 value={form.full_name}
 className={formControlErrorClass(Boolean(fieldErrors.full_name))}
 {...formControlErrorProps(fieldErrors.full_name)}
 onChange={(event) => updateField("full_name", event.target.value)}
 placeholder="Customer full name"
 />
 <FormFieldMessage message={fieldErrors.full_name} />
 </div>
 <div className="space-y-2" data-form-field="phone">
 <Label htmlFor="phone">Primary Phone</Label>
 <TzValidatedInput
 id="phone"
 kind="phone"
 value={form.phone}
 className={formControlErrorClass(Boolean(fieldErrors.phone))}
 {...formControlErrorProps(fieldErrors.phone)}
 onValueChange={(value) => updateField("phone", value)}
 />
 <FormFieldMessage message={fieldErrors.phone} />
 </div>
 <div className="space-y-2" data-form-field="alt_phone">
 <Label htmlFor="alt-phone">Alternative Phone</Label>
 <TzValidatedInput
 id="alt-phone"
 kind="phone"
 value={form.alt_phone}
 className={formControlErrorClass(Boolean(fieldErrors.alt_phone))}
 {...formControlErrorProps(fieldErrors.alt_phone)}
 onValueChange={(value) => updateField("alt_phone", value)}
 />
 <FormFieldMessage message={fieldErrors.alt_phone} />
 </div>
 <div className="space-y-2" data-form-field="email">
 <Label htmlFor="email">Email</Label>
 <Input
 id="email"
 type="email"
 value={form.email}
 className={formControlErrorClass(Boolean(fieldErrors.email))}
 {...formControlErrorProps(fieldErrors.email)}
 onChange={(event) => updateField("email", event.target.value)}
 placeholder="name@email.com"
 />
 <FormFieldMessage message={fieldErrors.email} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="id-type">ID Type</Label>
 <Select value={form.id_type} onValueChange={(value) => updateField("id_type", value)}>
 <SelectTrigger id="id-type">
 <SelectValue placeholder="Choose ID type" />
 </SelectTrigger>
 <SelectContent>
 {ID_TYPE_OPTIONS.map((idType) => (
 <SelectItem key={idType} value={idType}>
 {idType}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2 md:col-span-2" data-form-field="national_id">
 <Label htmlFor="national-id">National ID / Identifier</Label>
 {form.id_type === "NIDA" ? (
 <TzValidatedInput
 id="national-id"
 kind="nida"
 value={form.national_id}
 className={formControlErrorClass(Boolean(fieldErrors.national_id))}
 {...formControlErrorProps(fieldErrors.national_id)}
 onValueChange={(value) => updateField("national_id", value)}
 />
 ) : (
 <Input
 id="national-id"
 value={form.national_id}
 className={formControlErrorClass(Boolean(fieldErrors.national_id))}
 {...formControlErrorProps(fieldErrors.national_id)}
 onChange={(event) => updateField("national_id", event.target.value)}
 placeholder="Unique national identification"
 />
 )}
 <FormFieldMessage message={fieldErrors.national_id} />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Address Information</CardTitle>
 <CardDescription>
 Text address is required. Optionally record where the customer lives on the map (green pin) — separate
 from business location below.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="browse-location">Browse location</Label>
 <p className="text-xs text-muted-foreground">
 Search a place in Tanzania to fill street, ward, district, and region automatically.
 </p>
 <div className="relative">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 id="browse-location"
 value={browseLocationQuery}
 onChange={(event) => setBrowseLocationQuery(event.target.value)}
 placeholder="Search ward, street, landmark, or area…"
 className="pl-9"
 />
 </div>
 {loadingBrowseSuggestions ? (
 <p className="flex items-center gap-2 text-xs text-muted-foreground">
 <Loader2 className="h-3.5 w-3.5 animate-spin" />
 Searching locations…
 </p>
 ) : null}
 {browseSuggestions.length > 0 ? (
 <ul className="max-h-44 overflow-y-auto rounded-md border bg-background text-sm shadow-sm">
 {browseSuggestions.map((suggestion) => (
 <li key={`${suggestion.lat}-${suggestion.lon}-${suggestion.display_name}`}>
 <button
 type="button"
 className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/60"
 onClick={() => {
 applyAddressPartsToForm(suggestion);
 setBrowseLocationQuery("");
 setBrowseSuggestions([]);
 }}
 >
 <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
 <span className="text-xs sm:text-sm">{suggestion.display_name}</span>
 </button>
 </li>
 ))}
 </ul>
 ) : null}
 </div>
 <div className="space-y-2" data-form-field="physical_address">
 <Label htmlFor="physical-address">Physical Address</Label>
 <div className="relative">
 <Textarea
 id="physical-address"
 value={form.physical_address}
 className={formControlErrorClass(Boolean(fieldErrors.physical_address))}
 {...formControlErrorProps(fieldErrors.physical_address)}
 onChange={(event) => updateField("physical_address", event.target.value)}
 onKeyDown={handlePhysicalAddressKeyDown}
 rows={3}
 placeholder="Type area/place, e.g. Dar, and select suggestion"
 />
 {form.physical_address.trim().length >= 3 ? (
 <div className="mt-2 rounded-md border bg-background shadow-sm">
 {loadingPlaceSuggestions ? (
 <p className="px-3 py-2 text-xs text-muted-foreground">Searching places...</p>
 ) : placeSuggestions.length > 0 ? (
 placeSuggestions.map((suggestion) => (
 <button
 key={suggestion.display_name}
 type="button"
 onClick={() => {
 applySuggestionToForm(suggestion);
 setPlaceSuggestions([]);
 setActivePlaceSuggestionIndex(-1);
 }}
 className={`block w-full border-b px-3 py-2 text-left text-xs last:border-b-0 ${
 placeSuggestions[activePlaceSuggestionIndex]?.display_name === suggestion.display_name
 ? "bg-emerald-100"
 : "hover:bg-emerald-50"
 }`}
 >
 {suggestion.display_name}
 </button>
 ))
 ) : (
 <p className="px-3 py-2 text-xs text-muted-foreground">No matching places found.</p>
 )}
 </div>
 ) : null}
 </div>
 <FormFieldMessage message={fieldErrors.physical_address} />
 </div>
 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="street">Street</Label>
 <div className="relative">
 <Input
 id="street"
 value={form.street}
 onChange={(event) => updateField("street", event.target.value)}
 onKeyDown={handleStreetKeyDown}
 placeholder={form.region ? `Street in ${form.region}` : "Type street"}
 />
 {form.street.trim().length >= 2 ? (
 <div className="mt-2 rounded-md border bg-background shadow-sm">
 {loadingStreetSuggestions ? (
 <p className="px-3 py-2 text-xs text-muted-foreground">Searching streets...</p>
 ) : streetSuggestions.length > 0 ? (
 streetSuggestions.map((suggestion) => (
 <button
 key={`street-${suggestion.display_name}`}
 type="button"
 onClick={() => {
 applySuggestionToForm(suggestion);
 setStreetSuggestions([]);
 setActiveStreetSuggestionIndex(-1);
 }}
 className={`block w-full border-b px-3 py-2 text-left text-xs last:border-b-0 ${
 streetSuggestions[activeStreetSuggestionIndex]?.display_name === suggestion.display_name
 ? "bg-emerald-100"
 : "hover:bg-emerald-50"
 }`}
 >
 {suggestion.display_name}
 </button>
 ))
 ) : (
 <p className="px-3 py-2 text-xs text-muted-foreground">No matching streets found.</p>
 )}
 </div>
 ) : null}
 </div>
 </div>
 <div className="space-y-2">
 <Label htmlFor="ward">Ward</Label>
 <Input
 id="ward"
 value={form.ward}
 onChange={(event) => updateField("ward", event.target.value)}
 placeholder={form.district ? `Ward in ${form.district}` : "Ward"}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="district">District</Label>
 <Input
 id="district"
 value={form.district}
 onChange={(event) => updateField("district", event.target.value)}
 placeholder={form.region ? `District in ${form.region}` : "District"}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="region">Region</Label>
 <Input
 id="region"
 value={form.region}
 onChange={(event) => updateField("region", event.target.value)}
 placeholder="Region e.g. Dar es Salaam"
 />
 </div>
 <div className="space-y-2 md:col-span-2">
 {resolvingHomeLocation ? (
 <p className="flex items-center gap-2 text-xs text-muted-foreground">
 <Loader2 className="h-3.5 w-3.5 animate-spin" />
 Filling address from map location…
 </p>
 ) : null}
 <CustomerLocationMapPicker
 purpose="home"
 latitude={form.home_latitude}
 longitude={form.home_longitude}
 onPick={(lat, lng) => void handleHomeLocationPick(lat, lng)}
 onClear={() =>
 setForm((prev) => ({
 ...prev,
 home_latitude: null,
 home_longitude: null,
 }))
 }
 />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Employment & Business Profile</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="occupation">Occupation</Label>
 <Input
 id="occupation"
 value={form.occupation}
 onChange={(event) => updateField("occupation", event.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="monthly-income">Monthly Income</Label>
 <MoneyInput
 id="monthly-income"
 value={form.monthly_income}
 onValueChange={(value) => updateField("monthly_income", value)}
 placeholder="e.g., 1,000,000"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="employer-name">Employer Name</Label>
 <Input
 id="employer-name"
 value={form.employer_name}
 onChange={(event) => updateField("employer_name", event.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="employer-phone">Employer Phone</Label>
 <TzValidatedInput
 id="employer-phone"
 kind="phone"
 value={form.employer_phone}
 onValueChange={(value) => updateField("employer_phone", value)}
 />
 </div>
 <div className="space-y-2 md:col-span-2">
 <Label htmlFor="employer-address">Employer Address</Label>
 <Textarea
 id="employer-address"
 value={form.employer_address}
 onChange={(event) => updateField("employer_address", event.target.value)}
 rows={2}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="employment-start-date">Employment Start Date</Label>
 <Input
 id="employment-start-date"
 type="date"
 value={form.employment_start_date}
 onChange={(event) => updateField("employment_start_date", event.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="cheque-number">Cheque Number (Govt Employees)</Label>
 <Input
 id="cheque-number"
 value={form.cheque_number}
 onChange={(event) => updateField("cheque_number", event.target.value)}
 />
 </div>
 </div>

 <Separator />

 <div className="space-y-1 rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-2">
 <p className="text-sm font-semibold text-amber-950">Business location</p>
 <p className="text-xs text-amber-900/80">
 Record where this customer&apos;s business operates (orange pin). This is independent of home — many
 customers live and work at different addresses.
 </p>
 </div>

 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="business-name">Business Name</Label>
 <Input
 id="business-name"
 value={form.business_name}
 onChange={(event) => updateField("business_name", event.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="business-type">Business Type</Label>
 <Input
 id="business-type"
 value={form.business_type}
 onChange={(event) => updateField("business_type", event.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="business-registration-no">Business Registration No</Label>
 <Input
 id="business-registration-no"
 value={form.business_registration_no}
 onChange={(event) => updateField("business_registration_no", event.target.value)}
 />
 </div>
 <div className="space-y-2" data-form-field="years_in_business">
 <Label htmlFor="years-in-business">Years in Business</Label>
 <Input
 id="years-in-business"
 type="number"
 min="0"
 value={form.years_in_business}
 className={formControlErrorClass(Boolean(fieldErrors.years_in_business))}
 {...formControlErrorProps(fieldErrors.years_in_business)}
 onChange={(event) => updateField("years_in_business", event.target.value)}
 />
 <FormFieldMessage message={fieldErrors.years_in_business} />
 </div>
 <div className="space-y-2 md:col-span-2">
 <Label htmlFor="business-address">Business Address</Label>
 <Textarea
 id="business-address"
 value={form.business_address}
 onChange={(event) => updateField("business_address", event.target.value)}
 rows={2}
 />
 </div>
 <div className="space-y-2 md:col-span-2">
 <CustomerLocationMapPicker
 purpose="business"
 latitude={form.business_latitude}
 longitude={form.business_longitude}
 onPick={(lat, lng) =>
 setForm((prev) => ({
 ...prev,
 business_latitude: lat,
 business_longitude: lng,
 }))
 }
 onClear={() =>
 setForm((prev) => ({
 ...prev,
 business_latitude: null,
 business_longitude: null,
 }))
 }
 />
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Guarantors</CardTitle>
 <CardDescription>
 Add up to two guarantors and attach their ID photos or supporting documents.
 </CardDescription>
 </CardHeader>
 <CardContent>
 <CustomerGuarantorsFields
  value={guarantors}
  onChange={handleGuarantorsChange}
  fieldErrors={fieldErrors}
 />
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Collateral</CardTitle>
 <CardDescription>
 Add any collateral the customer or guarantor has offered, including photos when available.
 </CardDescription>
 </CardHeader>
 <CardContent>
 <CustomerCollateralFields
  value={collateral}
  onChange={handleCollateralChange}
  fieldErrors={fieldErrors}
 />
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>References</CardTitle>
 <CardDescription>
 Add friends or family contacts who can be reached if the customer is unavailable.
 </CardDescription>
 </CardHeader>
 <CardContent>
 <CustomerReferencesFields
  value={references}
  onChange={handleReferencesChange}
  fieldErrors={fieldErrors}
 />
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Attachments</CardTitle>
 <CardDescription>
 Optional photos and documents for field verification. Add multiple home or business photos and
 supporting files as needed.
 </CardDescription>
 </CardHeader>
 <CardContent>
 <CustomerAttachmentsFields
  value={attachments}
  onChange={handleAttachmentsChange}
  fieldErrors={fieldErrors}
 />
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Risk & Registration</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="risk-level">Risk Level</Label>
 <Select
 value={form.risk_level}
 onValueChange={(value) => updateField("risk_level", value as RiskLevel)}
 >
 <SelectTrigger id="risk-level">
 <SelectValue placeholder="Select risk level" />
 </SelectTrigger>
 <SelectContent>
 {RISK_LEVEL_OPTIONS.map((riskLevel) => (
 <SelectItem key={riskLevel.value} value={riskLevel.value}>
 {riskLevel.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2" data-form-field="risk_score">
 <Label htmlFor="risk-score">Risk Score</Label>
 <Input
 id="risk-score"
 type="number"
 min="0"
 value={form.risk_score}
 className={formControlErrorClass(Boolean(fieldErrors.risk_score))}
 {...formControlErrorProps(fieldErrors.risk_score)}
 onChange={(event) => updateField("risk_score", event.target.value)}
 />
 <FormFieldMessage message={fieldErrors.risk_score} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="registration-fee-amount">Registration Fee Amount</Label>
 <MoneyInput
 id="registration-fee-amount"
 value={form.registration_fee_amount}
 onValueChange={(value) => updateField("registration_fee_amount", value)}
 placeholder="e.g., 50,000"
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="registration-fee-paid-at">Registration Fee Paid At</Label>
 <Input
 id="registration-fee-paid-at"
 type="datetime-local"
 value={form.registration_fee_paid_at}
 onChange={(event) => updateField("registration_fee_paid_at", event.target.value)}
 />
 </div>
 </div>
 <div className="flex items-center gap-2 rounded-md border border-border p-3">
 <Checkbox
 id="registration-fee-paid"
 checked={form.registration_fee_paid}
 onCheckedChange={(checked) => updateField("registration_fee_paid", checked === true)}
 />
 <Label htmlFor="registration-fee-paid" className="cursor-pointer">
 Registration fee paid
 </Label>
 </div>
 <div className="space-y-2">
 <Label htmlFor="notes">Notes</Label>
 <Textarea
 id="notes"
 value={form.notes}
 onChange={(event) => updateField("notes", event.target.value)}
 rows={3}
 placeholder="Any notes for analysts, operations, or collections teams."
 />
 </div>
 </CardContent>
 </Card>
 </div>

        <div className="space-y-6 self-start">
            <Card className="sticky top-6">
 <CardHeader>
 <CardTitle>Submit Summary</CardTitle>
 <CardDescription>Review the assignment and key details, then register the customer.</CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
 <p className="font-semibold text-emerald-900">Branch Context</p>
 <p className="text-xs text-emerald-800">
 {selectedBranch
 ? `${selectedBranch.name} (${selectedBranch.code})`
 : "No branch selected yet"}
 </p>
 </div>

 <div className="grid gap-2">
 <div className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
 <span className="inline-flex items-center gap-1 text-muted-foreground">
 <Building2 className="h-3 w-3" />
 Branches
 </span>
 <Badge variant="secondary">{branchOptions.length}</Badge>
 </div>
 <div className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
 <span className="inline-flex items-center gap-1 text-muted-foreground">
 <Users className="h-3 w-3" />
 Loan officers (filtered)
 </span>
 <Badge variant="secondary">{loanOfficerOptions.length}</Badge>
 </div>
 <div className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
 <span className="inline-flex items-center gap-1 text-muted-foreground">
 <Home className="h-3 w-3 text-emerald-700" />
 Where customer lives
 </span>
 <Badge variant={form.home_latitude != null ? "default" : "outline"}>
 {form.home_latitude != null ? "Recorded" : "Not set"}
 </Badge>
 </div>
 <div className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
 <span className="inline-flex items-center gap-1 text-muted-foreground">
 <Store className="h-3 w-3 text-amber-700" />
 Where business is
 </span>
 <Badge variant={form.business_latitude != null ? "default" : "outline"}>
 {form.business_latitude != null ? "Recorded" : "Not set"}
 </Badge>
 </div>
 <div className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
 <span className="inline-flex items-center gap-1 text-muted-foreground">
 <Paperclip className="h-3 w-3" />
 Attachments selected
 </span>
 <Badge variant={attachmentCount > 0 ? "default" : "outline"}>
 {attachmentCount > 0 ? attachmentCount : "None"}
 </Badge>
 </div>
 </div>

 {error && Object.keys(fieldErrors).length === 0 ? (
 <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
 {error}
 </p>
 ) : null}

 <Separator />

 <Button className="w-full" type="submit" disabled={submitting || !sessionLoaded}>
 <UserPlus className="mr-2 h-4 w-4" />
 {submitting ? "Submitting..." : "Create Customer"}
 </Button>
 <Button
 type="button"
 variant="outline"
 className="w-full"
 onClick={() => {
 setForm({
 ...defaultForm,
 created_by: effectiveUserId,
 branch_id: lockedBranchId,
 loan_officer_id: lockedOfficerId,
 });
 setAttachments(emptyCustomerAttachments());
 setFieldErrors({});
 setError("");
 }}
 >
 <Save className="mr-2 h-4 w-4" />
 Reset Form
 </Button>
 </CardContent>
 </Card>
 </div>
 </div>
  </form>
  </div>
  </main>
  )}
  </>
  );
}

export default function NewCustomerPage() {
  return (
    <Suspense>
      <NewCustomerPageInner />
    </Suspense>
  );
}
