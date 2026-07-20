"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  LocateFixed,
  MapPin,
  MoreHorizontal,
  Navigation,
  Pencil,
  Phone,
  Plus,
  RefreshCcw,
  UserPlus,
  X,
} from "lucide-react";
import { TzValidatedInput } from "@/components/forms/tz-validated-input";
import {
  formControlErrorClass,
  formControlErrorProps,
} from "@/components/forms/form-field-message";
import { DashboardHeader } from "@/components/dashboard-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { extractBranchesList } from "@/lib/branch-adapters";
import { formatApiResponseError } from "@/lib/falco-api";
import { forceCachedReload } from "@/lib/client-fetch-cache";
import {
  extractLeadDetail,
  extractLeadsList,
  mapUiLeadCreateToApi,
  stripLocationTagFromNotes,
  type LeadLocationType,
  type LeadStatus,
  type LeadView,
} from "@/lib/lead-adapters";
import {
 leadHasMapTarget,
 leadMapDirectionsUrl,
 leadMapEmbedUrl,
 leadMapViewUrl,
 parseLeadCoordinates,
} from "@/lib/lead-map";
import { reverseGeocodeNominatim } from "@/lib/nominatim";
import { apiFetch, apiErrorMessage, isSessionExpiredResponse } from "@/lib/api-client";
import { parseJsonResponse } from "@/lib/parse-json-response";
import { digitsOnly, TZ_PHONE_MAX_DIGITS } from "@/lib/tz-form-inputs";
import type { Branch } from "@/lib/types";
import {
  buildNewCustomerUrlFromLead,
  leadViewFromEditForm,
} from "@/lib/lead-to-customer-prefill";
import { useSessionUser } from "@/lib/use-session-user";
import { cn } from "@/lib/utils";

const statusLabel: Record<LeadStatus, string> = {
 new: "New",
 follow_up: "Follow Up",
 contacted: "Contacted",
 converted: "Converted",
};

const locationTypeLabel: Record<LeadLocationType, string> = {
 home: "Home",
 work: "Work",
 sponsor: "Sponsor",
};

function roleDisplayLabel(role: string): string {
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function leadCreatorLabel(lead: LeadView): string {
  return lead.createdByName || lead.createdBy || "-";
}

function leadCreatorRoleLabel(lead: LeadView): string | null {
  return lead.createdByRole ? roleDisplayLabel(lead.createdByRole) : null;
}

/** Local calendar date for `<input type="date">` (YYYY-MM-DD). */
function todayInputDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Same-format date `daysAgo` days before today, for the report's default start date. */
function daysAgoInputDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type LeadFormErrors = Record<string, string>;

function leadFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    branchId: "Branch",
    fullName: "Full name",
    phoneNumber: "Phone number",
    alternatePhone: "Alternate number",
    locationName: "Street / location",
    latitude: "Latitude",
    longitude: "Longitude",
    followUpDate: "Date added",
  };
  return labels[field] ?? field;
}

function summarizeLeadErrors(errors: LeadFormErrors): string {
  const count = Object.keys(errors).length;
  if (count === 0) return "";
  if (count === 1) return Object.values(errors)[0];
  return `Please fix ${count} fields highlighted below.`;
}

const PROHIBITED_FIELD_LABELS: Record<string, string> = {
  latitude: "GPS latitude",
  longitude: "GPS longitude",
  follow_up_date: "date added",
};

function humanizeProhibitedField(field: string): string {
  return PROHIBITED_FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}

/** Backend validation `details` entries whose message says the field is "prohibited" for this account/role. */
function extractProhibitedFields(data: unknown): string[] {
  const details =
    data && typeof data === "object" ? (data as { details?: unknown }).details : undefined;
  if (!Array.isArray(details)) return [];
  const fields: string[] = [];
  for (const entry of details) {
    if (!entry || typeof entry !== "object") continue;
    const field = (entry as { field?: unknown }).field;
    const message = (entry as { message?: unknown }).message;
    if (typeof field === "string" && typeof message === "string" && /prohibited/i.test(message)) {
      fields.push(field);
    }
  }
  return fields;
}

/**
 * POSTs/PATCHes a lead payload. Some accounts are blocked by the backend from setting fields
 * like `latitude`/`longitude`/`follow_up_date` (422 "field is prohibited"). When that happens,
 * this drops just those fields and retries once so the rest of the lead still saves.
 */
async function submitLeadPayload(
  url: string,
  method: "POST" | "PATCH",
  payload: Record<string, unknown>
): Promise<{ res: Response; data: unknown; droppedFields: string[] }> {
  const send = (body: Record<string, unknown>) =>
    apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const res = await send(payload);
  const { data } = await parseJsonResponse<unknown>(res);
  if (res.ok || res.status !== 422) return { res, data, droppedFields: [] };

  const prohibited = extractProhibitedFields(data).filter((field) => field in payload);
  if (prohibited.length === 0) return { res, data, droppedFields: [] };

  const retryPayload = { ...payload };
  for (const field of prohibited) delete retryPayload[field];

  const retryRes = await send(retryPayload);
  const retryParsed = await parseJsonResponse<unknown>(retryRes);
  return {
    res: retryRes,
    data: retryParsed.data,
    droppedFields: retryRes.ok ? prohibited : [],
  };
}

function validateLeadForm(
  form: typeof initialLeadFormData,
  options: { needsBranchPicker: boolean; fallbackBranchId?: string | null }
): LeadFormErrors {
  const errors: LeadFormErrors = {};
  const phoneDigits = digitsOnly(form.phoneNumber);
  const altDigits = digitsOnly(form.alternatePhone);
  const branchId = form.branchId.trim() || options.fallbackBranchId?.trim() || "";

  if (options.needsBranchPicker && !branchId) errors.branchId = "Select the branch for this lead.";
  if (!form.fullName.trim()) errors.fullName = "Enter the customer's full name.";
  if (!form.phoneNumber.trim()) {
    errors.phoneNumber = "Enter the customer's phone number.";
  } else if (phoneDigits.length !== TZ_PHONE_MAX_DIGITS) {
    errors.phoneNumber = "Enter a 10 digit phone number, for example 0712345678.";
  }
  if (form.alternatePhone.trim() && altDigits.length !== TZ_PHONE_MAX_DIGITS) {
    errors.alternatePhone = "Enter a 10 digit phone number, or leave this field empty.";
  }
  if (!form.locationName.trim()) errors.locationName = "Enter the street, area, or landmark.";

  const latitude = form.latitude.trim();
  const longitude = form.longitude.trim();
  if (latitude) {
    const value = Number(latitude);
    if (!Number.isFinite(value) || value < -90 || value > 90) {
      errors.latitude = "Latitude must be a number between -90 and 90.";
    }
  }
  if (longitude) {
    const value = Number(longitude);
    if (!Number.isFinite(value) || value < -180 || value > 180) {
      errors.longitude = "Longitude must be a number between -180 and 180.";
    }
  }
  if ((latitude && !longitude) || (!latitude && longitude)) {
    if (!latitude) errors.latitude = "Enter latitude too, or clear longitude.";
    if (!longitude) errors.longitude = "Enter longitude too, or clear latitude.";
  }
  if (!form.followUpDate.trim()) errors.followUpDate = "Choose the date this lead was added.";

  return errors;
}

const initialLeadFormData = {
  branchId: "",
  fullName: "",
  phoneNumber: "",
  alternatePhone: "",
  locationType: "home" as LeadLocationType,
  locationName: "",
  region: "",
  district: "",
  ward: "",
  latitude: "",
  longitude: "",
  notes: "",
  followUpDate: todayInputDate(),
  status: "new" as LeadStatus,
};

const leadFormGridClass =
  "grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 [&_[data-slot=field]]:min-w-0 [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-trigger]]:max-w-full [&_[data-slot=select-value]]:truncate [&_input]:max-w-full [&_textarea]:max-w-full";

const leadSelectTriggerClass = "w-full max-w-full min-w-0 [&_[data-slot=select-value]]:truncate";


export default function LeadsPage() {
  const router = useRouter();
  const { user, loaded: sessionLoaded } = useSessionUser();
  const scopeBranchId =
    user?.role === "branch_manager" || user?.role === "loan_officer" ? user.branch_id : null;
  const [leads, setLeads] = useState<LeadView[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const mapSectionRef = useRef<HTMLDivElement | null>(null);
  const editFormRef = useRef<HTMLDivElement | null>(null);
  const addLeadFormRef = useRef<HTMLDivElement | null>(null);
  const [showAddLeadForm, setShowAddLeadForm] = useState(false);
  const [editingLead, setEditingLead] = useState<LeadView | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [leadFieldErrors, setLeadFieldErrors] = useState<LeadFormErrors>({});
  const [reportOpen, setReportOpen] = useState(false);
  const [reportFrom, setReportFrom] = useState(() => daysAgoInputDate(30));
  const [reportTo, setReportTo] = useState(() => todayInputDate());
  const [reportError, setReportError] = useState<string | null>(null);
  const needsBranchPicker = user?.role === "super_admin";
  const [editFormData, setEditFormData] = useState({
    fullName: "",
    phoneNumber: "",
    alternatePhone: "",
    locationType: "home" as LeadLocationType,
    locationName: "",
    region: "",
    district: "",
    ward: "",
    latitude: "",
    longitude: "",
    notes: "",
    followUpDate: "",
    status: "new" as LeadStatus,
  });
  const [formData, setFormData] = useState(initialLeadFormData);

  const visibleLeads = leads;

  const updateLeadField = <K extends keyof typeof initialLeadFormData>(
    key: K,
    value: (typeof initialLeadFormData)[K]
  ) => {
    setLeadFieldErrors((prev) => {
      if (!prev[String(key)]) return prev;
      const next = { ...prev };
      delete next[String(key)];
      return next;
    });
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const applyLeadFieldErrors = (errors: LeadFormErrors) => {
    setLeadFieldErrors(errors);
    setError(summarizeLeadErrors(errors));
    const firstField = Object.keys(errors)[0];
    if (firstField) {
      requestAnimationFrame(() => {
        const target = document.querySelector(`[data-lead-field="${CSS.escape(firstField)}"]`);
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
        const focusable = target?.querySelector<HTMLElement>(
          "input:not([type=hidden]), textarea, button[role=combobox]"
        );
        focusable?.focus({ preventScroll: true });
      });
    }
  };

 useEffect(() => {
 if (user?.branch_id && !formData.branchId) {
 setFormData((prev) => ({ ...prev, branchId: user.branch_id }));
 }
 }, [user?.branch_id, formData.branchId]);

 useEffect(() => {
  if (!showAddLeadForm) return;
  requestAnimationFrame(() => {
   addLeadFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
   const focusable = addLeadFormRef.current?.querySelector<HTMLElement>(
    "input:not([type=hidden]), textarea, button[role=combobox]"
   );
   focusable?.focus({ preventScroll: true });
  });
 }, [showAddLeadForm]);

  const load = useCallback(async () => {
    if (!sessionLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const leadsParams = new URLSearchParams();
      leadsParams.set("page_size", "100");
      if (scopeBranchId) leadsParams.set("branch_id", scopeBranchId);

      const [leadsRes, branchRes] = await Promise.all([
        apiFetch(`/api/leads?${leadsParams.toString()}`),
        user?.role === "super_admin" ? apiFetch("/api/falco/branches") : Promise.resolve(null),
      ]);

      const { data: leadsJson } = await parseJsonResponse<unknown>(leadsRes);
      if (!leadsRes.ok) {
        const msg = formatApiResponseError(leadsJson, "Failed to load leads");
        if (isSessionExpiredResponse(leadsRes.status, msg)) {
          throw new Error("Your session expired. Please sign in again.");
        }
        throw new Error(msg);
      }

      if (branchRes) {
        const branchJson = await branchRes.json().catch(() => null);
        if (branchRes.ok && branchJson) {
          const branchList = extractBranchesList(branchJson);
          setBranches(branchList);
          setFormData((prev) => ({
            ...prev,
            branchId: prev.branchId || branchList[0]?.id || "",
          }));
        }
      }

      const list = extractLeadsList(leadsJson);
      setLeads(list);
      setSelectedLeadId((prev) => prev || list[0]?.id || "");
 } catch (e) {
 setError(e instanceof Error ? e.message : "Failed to load leads");
 setLeads([]);
 } finally {
 setLoading(false);
 }
 }, [scopeBranchId, user?.role, sessionLoaded]);

 useEffect(() => {
 void load();
 }, [load]);

  const applyLocationFromType = (type: LeadLocationType) => {
    setFormData((prev) => ({ ...prev, locationType: type }));
  };

 const handleCaptureLocation = () => {
 if (!navigator.geolocation) {
 setError("Geolocation is not supported in this browser.");
 return;
 }
 setIsLocating(true);
 setError(null);
 navigator.geolocation.getCurrentPosition(
 (position) => {
 const lat = position.coords.latitude;
 const lng = position.coords.longitude;
 const latStr = lat.toFixed(6);
 const lngStr = lng.toFixed(6);

 void (async () => {
 try {
 const place = await reverseGeocodeNominatim(lat, lng);
 setLeadFieldErrors((prev) => {
 const next = { ...prev };
 delete next.latitude;
 delete next.longitude;
 delete next.locationName;
 return next;
 });
 setFormData((prev) => ({
 ...prev,
 latitude: latStr,
 longitude: lngStr,
 locationName: place.locationName || prev.locationName,
 district: place.district || prev.district,
 region: place.region || prev.region,
 ward: place.ward || prev.ward,
 }));
 } catch {
 setLeadFieldErrors((prev) => {
 const next = { ...prev };
 delete next.latitude;
 delete next.longitude;
 return next;
 });
 setFormData((prev) => ({
 ...prev,
 latitude: latStr,
 longitude: lngStr,
 }));
 setError(
 "Coordinates captured, but street and district could not be resolved. Enter them manually."
 );
 } finally {
 setIsLocating(false);
 }
 })();
 },
 () => {
 setIsLocating(false);
 setError("Could not get your location. Allow location access in the browser and try again.");
 },
 { enableHighAccuracy: true, timeout: 15000 }
 );
 };

 const handleAddLead = async () => {
 if (!sessionLoaded || !user) {
 setError("Your session is still loading. Please wait a moment and try again.");
 return;
 }
 setLeadFieldErrors({});
 const validationErrors = validateLeadForm(formData, {
 needsBranchPicker,
 fallbackBranchId: user?.branch_id,
 });
 if (Object.keys(validationErrors).length > 0) {
 applyLeadFieldErrors(validationErrors);
 return;
 }
 const branchId = formData.branchId.trim() || user?.branch_id?.trim() || "";
 if (needsBranchPicker && !branchId) {
 applyLeadFieldErrors({ branchId: "Select the branch for this lead." });
 return;
 }

 setSaving(true);
 setError(null);
 try {
 const body = mapUiLeadCreateToApi({
 fullName: formData.fullName,
 phoneNumber: formData.phoneNumber,
 alternatePhone: formData.alternatePhone || undefined,
 locationType: formData.locationType,
 locationName: formData.locationName,
 region: formData.region || undefined,
 district: formData.district || undefined,
 ward: formData.ward || undefined,
 latitude: formData.latitude || undefined,
 longitude: formData.longitude || undefined,
 notes: formData.notes,
 followUpDate: formData.followUpDate.trim() || todayInputDate(),
 status: formData.status,
 });

      const { res, data, droppedFields } = await submitLeadPayload("/api/leads", "POST", {
        ...body,
        ...(branchId ? { branch_id: branchId } : {}),
      });
      if (!res.ok) {
        const msg = apiErrorMessage(data, formatApiResponseError(data, "Failed to save lead"));
        if (isSessionExpiredResponse(res.status, msg)) {
          throw new Error("Your session expired. Please sign in again.");
        }
        if (res.status === 403) {
          throw new Error(
            "You do not have permission to add leads. Ask your branch manager to enable leads access for loan officers."
          );
        }
        throw new Error(msg);
      }
      if (droppedFields.length > 0) {
        const labels = droppedFields.map(humanizeProhibitedField).join(", ");
        toast.info(
          `Lead saved, but ${labels} ${droppedFields.length > 1 ? "aren't" : "isn't"} allowed for your account and were left blank.`
        );
      }

      await load();
      setShowAddLeadForm(false);
    setFormData({
      ...initialLeadFormData,
      branchId: formData.branchId || user?.branch_id || branches[0]?.id || "",
      followUpDate: todayInputDate(),
    });
 setLeadFieldErrors({});
 } catch (e) {
 setError(e instanceof Error ? e.message : "Failed to save lead");
 } finally {
 setSaving(false);
 }
 };

 const mergeLeadIntoList = useCallback((updated: LeadView) => {
 setLeads((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
 }, []);

 const refreshLeadDetail = useCallback(
 async (leadId: string) => {
 try {
 const res = await apiFetch(`/api/leads/${encodeURIComponent(leadId)}`, { cache: "no-store" });
 const { data } = await parseJsonResponse<unknown>(res);
 if (!res.ok) return;
 const detail = extractLeadDetail(data);
 if (detail) mergeLeadIntoList(detail);
 } catch {
 /* keep list row as-is */
 }
 },
 [mergeLeadIntoList]
 );

 useEffect(() => {
 if (!selectedLeadId) return;
 void refreshLeadDetail(selectedLeadId);
 }, [selectedLeadId, refreshLeadDetail]);

 const selectedLead = visibleLeads.find((lead) => lead.id === selectedLeadId);
 const mapLead = selectedLead && leadHasMapTarget(selectedLead) ? selectedLead : null;
 const mapEmbedUrl = mapLead ? leadMapEmbedUrl(mapLead) : null;

 const focusLeadOnMap = (lead: LeadView) => {
 setSelectedLeadId(lead.id);
 void refreshLeadDetail(lead.id);
 requestAnimationFrame(() => {
 mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
 });
 };

 const openMapDirections = (lead: LeadView) => {
 const url = leadMapDirectionsUrl(lead);
 if (!url) return;
 window.open(url, "_blank", "noopener,noreferrer");
 };

  const openMapView = (lead: LeadView) => {
    focusLeadOnMap(lead);
    const url = leadMapViewUrl(lead);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const makeCustomerFromLead = (lead: LeadView) => {
    const source =
      editingLead?.id === lead.id
        ? leadViewFromEditForm(editingLead, editFormData)
        : lead;
    router.push(buildNewCustomerUrlFromLead(source, user?.role));
  };

  const openEditLead = (lead: LeadView) => {
    setShowAddLeadForm(false);
    setEditingLead(lead);
    setEditFormData({
      fullName: lead.fullName,
      phoneNumber: lead.phoneNumber,
      alternatePhone: lead.alternatePhone ?? "",
      locationType: lead.locationType,
      locationName: lead.locationName,
      region: lead.region ?? "",
      district: lead.district ?? "",
      ward: lead.ward ?? "",
      latitude: lead.latitude ?? "",
      longitude: lead.longitude ?? "",
      notes: stripLocationTagFromNotes(lead.notes),
      followUpDate: lead.followUpDate ?? "",
      status: lead.status,
    });
    requestAnimationFrame(() => {
      editFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleUpdateLead = async () => {
    if (!editingLead || !sessionLoaded || !user) return;
    if (!editFormData.fullName || !editFormData.phoneNumber || !editFormData.locationName) return;

    const phoneDigits = digitsOnly(editFormData.phoneNumber);
    if (phoneDigits.length !== TZ_PHONE_MAX_DIGITS) {
      setError(`Phone number must be exactly ${TZ_PHONE_MAX_DIGITS} digits (e.g. 0712345678).`);
      return;
    }
    const altDigits = digitsOnly(editFormData.alternatePhone);
    if (editFormData.alternatePhone.trim() && altDigits.length !== TZ_PHONE_MAX_DIGITS) {
      setError(`Alternate number must be exactly ${TZ_PHONE_MAX_DIGITS} digits.`);
      return;
    }

    setEditSaving(true);
    setError(null);
    try {
      const body = mapUiLeadCreateToApi({
        fullName: editFormData.fullName,
        phoneNumber: editFormData.phoneNumber,
        alternatePhone: editFormData.alternatePhone || undefined,
        locationType: editFormData.locationType,
        locationName: editFormData.locationName,
        region: editFormData.region || undefined,
        district: editFormData.district || undefined,
        ward: editFormData.ward || undefined,
        latitude: editFormData.latitude || undefined,
        longitude: editFormData.longitude || undefined,
        notes: editFormData.notes,
        followUpDate: editFormData.followUpDate || undefined,
        status: editFormData.status,
      });

      const { res, data, droppedFields } = await submitLeadPayload(
        `/api/leads/${encodeURIComponent(editingLead.id)}`,
        "PATCH",
        body
      );
      if (!res.ok) {
        const msg = apiErrorMessage(data, formatApiResponseError(data, "Failed to update lead"));
        if (isSessionExpiredResponse(res.status, msg)) {
          throw new Error("Your session expired. Please sign in again.");
        }
        throw new Error(msg);
      }
      if (droppedFields.length > 0) {
        const labels = droppedFields.map(humanizeProhibitedField).join(", ");
        toast.info(
          `Lead updated, but ${labels} ${droppedFields.length > 1 ? "aren't" : "isn't"} allowed for your account and were left unchanged.`
        );
      }

      await load();
      setEditingLead(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update lead");
    } finally {
      setEditSaving(false);
    }
  };

  const handleGenerateReport = () => {
    if (!reportFrom || !reportTo) {
      setReportError("Choose a start and end date.");
      return;
    }
    if (reportFrom > reportTo) {
      setReportError("The start date must be on or before the end date.");
      return;
    }

    setReportError(null);
    const params = new URLSearchParams({ from: reportFrom, to: reportTo });
    const downloadUrl = `/api/leads/report?${params.toString()}`;

    // Navigate directly to the download URL instead of using `fetch`/blob: this app's global
    // fetch-cache patch (lib/client-fetch-cache.ts) reads every response body as text to cache
    // it, which corrupts binary files like .xlsx. A plain browser navigation (same mechanism an
    // <img> tag uses) is handled by the browser's native network stack and never touches that
    // patch, so the bytes reach disk untouched.
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setReportOpen(false);
  };

  return (
 <>
 <DashboardHeader
 title="Leads"
 description="Capture potential customers during field visits and follow up later"
 />
  <main className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pb-10 lg:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-6">
 <div className="p-4 sm:p-5">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
 <div>
 <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
 Lead Routing Hub
 </p>
 <h2 className="mt-1 text-lg font-semibold tracking-tight">
 Capture leads with location-assisted follow-up
 </h2>
 <p className="mt-1 text-sm text-muted-foreground">
            Enter potential customer details, choose a location type, and save ready-to-navigate lead points.
 </p>
 </div>
 <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
 <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => forceCachedReload(load)}>
 <RefreshCcw className="mr-2 h-4 w-4" />
 Refresh
 </Button>
 <Button
 type="button"
 className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
 onClick={() => {
 setLeadFieldErrors({});
 setShowAddLeadForm((prev) => {
 const opening = !prev;
 if (opening) {
 setEditingLead(null);
 setFormData((f) => ({ ...f, followUpDate: todayInputDate() }));
 }
 return opening;
 });
 }}
 >
 <Plus className="mr-2 h-4 w-4" />
 {showAddLeadForm ? "Close Add Lead" : "Add Lead"}
 </Button>
 </div>
 </div>
 </div>

 {error && (
 <Card className="border-destructive/50 bg-destructive/5">
 <CardContent className="flex items-center justify-between gap-3 py-3 text-sm text-destructive">
 <span>{error}</span>
 <Button
 type="button"
 variant="ghost"
 size="icon"
 className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
 aria-label="Dismiss message"
 onClick={() => setError(null)}
 >
 <X className="h-4 w-4" aria-hidden />
 </Button>
 </CardContent>
 </Card>
 )}

 {loading ? (
 <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
 <Loader2 className="h-5 w-5 animate-spin" />
 Loading leads…
 </div>
 ) : (
 <>
 <Card className="overflow-hidden border-emerald-100">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle>Leads for Follow-up</CardTitle>
                    <CardDescription>
                      Track and update potential customers captured during field work
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                    onClick={() => {
                      setReportError(null);
                      setReportOpen(true);
                    }}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Generate Report
                  </Button>
                </div>
              </CardHeader>
 <CardContent className="space-y-4 p-0">
 <div className="grid gap-3 p-4 sm:hidden">
 {visibleLeads.map((lead) => (
 <div
 key={lead.id}
 className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/30 p-3"
 onClick={() => focusLeadOnMap(lead)}
 >
 <div className="flex items-start justify-between gap-2">
 <div>
 <p className="font-medium">{lead.fullName}</p>
 <p className="text-xs text-muted-foreground">{lead.locationName}</p>
 </div>
 <Badge variant="outline">{statusLabel[lead.status]}</Badge>
 </div>
 <p className="inline-flex items-center gap-1 text-sm">
 <Phone className="h-3 w-3" />
 {lead.phoneNumber}
 </p>
 <div className="text-xs text-muted-foreground">
 Created by{" "}
 <span className="font-medium text-foreground">{leadCreatorLabel(lead)}</span>
 {leadCreatorRoleLabel(lead) ? ` (${leadCreatorRoleLabel(lead)})` : ""}
 </div>
              <div className="flex flex-wrap gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="mr-1 h-3.5 w-3.5" />
                      Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    <DropdownMenuLabel>Lead Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        disabled={!leadHasMapTarget(lead)}
                        onClick={(e) => { e.stopPropagation(); openMapView(lead); }}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Map
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!leadHasMapTarget(lead)}
                        onClick={(e) => { e.stopPropagation(); focusLeadOnMap(lead); openMapDirections(lead); }}
                      >
                        <Navigation className="mr-2 h-4 w-4" />
                        Navigate
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); openEditLead(lead); }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Lead
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); makeCustomerFromLead(lead); }}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Make Customer
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>

            <div className="hidden w-full overflow-x-auto sm:block">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Name</TableHead>
 <TableHead>Phone</TableHead>
 <TableHead>Type</TableHead>
 <TableHead>Location</TableHead>
 <TableHead>Coordinates</TableHead>
 <TableHead>Date Added</TableHead>
 <TableHead>Created By</TableHead>
 <TableHead>Status</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {visibleLeads.length === 0 ? (
 <TableRow>
 <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
 No leads yet. Add a field lead to get started.
 </TableCell>
 </TableRow>
 ) : (
 visibleLeads.map((lead) => {
 const coords = parseLeadCoordinates(lead);
 return (
 <TableRow
 key={lead.id}
 className="cursor-pointer"
 onClick={() => focusLeadOnMap(lead)}
 >
 <TableCell className="font-medium">{lead.fullName}</TableCell>
 <TableCell>
 <div className="flex flex-col gap-1">
 <span className="inline-flex items-center gap-1">
 <Phone className="h-3 w-3" />
 {lead.phoneNumber}
 </span>
 {lead.alternatePhone && (
 <span className="text-xs text-muted-foreground">
 Alt: {lead.alternatePhone}
 </span>
 )}
 </div>
 </TableCell>
 <TableCell>
 <Badge variant="secondary">{locationTypeLabel[lead.locationType]}</Badge>
 </TableCell>
 <TableCell>{lead.locationName}</TableCell>
 <TableCell>
 {coords ? (
 <span className="inline-flex items-center gap-1 text-xs">
 <MapPin className="h-3 w-3" />
 {coords.latitude}, {coords.longitude}
 </span>
 ) : lead.locationName ? (
 <span className="text-xs text-muted-foreground">Address only</span>
 ) : (
 <span className="text-xs text-muted-foreground">Not captured</span>
 )}
 </TableCell>
 <TableCell>{lead.followUpDate || "-"}</TableCell>
 <TableCell>
 <div className="flex max-w-56 flex-col">
 <span className="truncate font-medium">{leadCreatorLabel(lead)}</span>
 {leadCreatorRoleLabel(lead) && (
 <span className="text-xs text-muted-foreground">{leadCreatorRoleLabel(lead)}</span>
 )}
 </div>
 </TableCell>
 <TableCell>
 <Badge variant="outline">{statusLabel[lead.status]}</Badge>
 </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                        <span className="ml-1">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuLabel>Lead Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          disabled={!leadHasMapTarget(lead)}
                          onClick={(e) => { e.stopPropagation(); openMapView(lead); }}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View Map
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!leadHasMapTarget(lead)}
                          onClick={(e) => { e.stopPropagation(); focusLeadOnMap(lead); openMapDirections(lead); }}
                        >
                          <Navigation className="mr-2 h-4 w-4" />
                          Navigate
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); openEditLead(lead); }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit Lead
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); makeCustomerFromLead(lead); }}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Make Customer
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
 </TableRow>
 );
 })
 )}
 </TableBody>
 </Table>
 </div>
 </CardContent>
 </Card>

          {editingLead && (
            <Card ref={editFormRef} className="border-amber-200">
              <CardHeader className="rounded-t-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-white">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>Edit Lead — {editingLead.fullName}</CardTitle>
                    <CardDescription className="text-amber-100">
                      Update the lead details then save
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-amber-600"
                    onClick={() => setEditingLead(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-4 pt-4 sm:px-6">
                <FieldGroup className="min-w-0">
                  <div className={leadFormGridClass}>
                    <Field>
                      <FieldLabel>Location Type</FieldLabel>
                      <Select
                        value={editFormData.locationType}
                        onValueChange={(value: LeadLocationType) =>
                          setEditFormData((prev) => ({ ...prev, locationType: value }))
                        }
                      >
                        <SelectTrigger className={leadSelectTriggerClass}>
                          <SelectValue placeholder="Select location type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="home">Home</SelectItem>
                          <SelectItem value="work">Work</SelectItem>
                          <SelectItem value="sponsor">Sponsor</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Full Name</FieldLabel>
                      <Input
                        placeholder="Potential customer name"
                        value={editFormData.fullName}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, fullName: e.target.value }))
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Phone Number</FieldLabel>
                      <TzValidatedInput
                        kind="phone"
                        placeholder="0712345678"
                        value={editFormData.phoneNumber}
                        onValueChange={(phoneNumber) =>
                          setEditFormData((prev) => ({ ...prev, phoneNumber }))
                        }
                        maxLength={10}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Alternate Number (optional)</FieldLabel>
                      <TzValidatedInput
                        kind="phone"
                        placeholder="0712345678"
                        value={editFormData.alternatePhone}
                        onValueChange={(alternatePhone) =>
                          setEditFormData((prev) => ({ ...prev, alternatePhone }))
                        }
                        maxLength={10}
                      />
                    </Field>
                    <Field className="md:col-span-2">
                      <FieldLabel>Street / Location</FieldLabel>
                      <Input
                        placeholder="Street, area, or landmark"
                        value={editFormData.locationName}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, locationName: e.target.value }))
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Region</FieldLabel>
                      <Input
                        placeholder="Region"
                        value={editFormData.region}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, region: e.target.value }))
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>District</FieldLabel>
                      <Input
                        placeholder="District"
                        value={editFormData.district}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, district: e.target.value }))
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Ward</FieldLabel>
                      <Input
                        placeholder="Ward"
                        value={editFormData.ward}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, ward: e.target.value }))
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Latitude</FieldLabel>
                      <Input
                        placeholder="-6.7924"
                        value={editFormData.latitude}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, latitude: e.target.value }))
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Longitude</FieldLabel>
                      <Input
                        placeholder="39.2083"
                        value={editFormData.longitude}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, longitude: e.target.value }))
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Date Added</FieldLabel>
                      <FieldDescription>When this lead was captured. Defaults to today.</FieldDescription>
                      <Input
                        type="date"
                        value={editFormData.followUpDate}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, followUpDate: e.target.value }))
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Status</FieldLabel>
                      <Select
                        value={editFormData.status}
                        onValueChange={(value: LeadStatus) =>
                          setEditFormData((prev) => ({ ...prev, status: value }))
                        }
                      >
                        <SelectTrigger className={leadSelectTriggerClass}>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(statusLabel) as LeadStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>
                              {statusLabel[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field className="sm:col-span-2 lg:col-span-4">
                      <FieldLabel>Notes</FieldLabel>
                      <Textarea
                        placeholder="Add any notes about this lead…"
                        rows={2}
                        value={editFormData.notes}
                        onChange={(e) =>
                          setEditFormData((prev) => ({ ...prev, notes: e.target.value }))
                        }
                      />
                    </Field>
                  </div>
                </FieldGroup>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEditingLead(null)}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="w-full bg-amber-500 hover:bg-amber-600 sm:w-auto"
                    disabled={editSaving}
                    onClick={() => void handleUpdateLead()}
                  >
                    {editSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Pencil className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {showAddLeadForm && (
            <Card ref={addLeadFormRef} className="overflow-hidden border-emerald-100 shadow-sm scroll-mt-4">
 <CardHeader className="border-b border-emerald-100 bg-emerald-50/70 px-4 py-4 sm:px-6 sm:py-5">
 <div className="flex items-start gap-3">
 <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white shadow-sm">
 <Plus className="h-4 w-4" aria-hidden />
 </div>
 <div className="min-w-0 space-y-1">
 <CardTitle className="text-base text-foreground sm:text-lg">Add New Lead</CardTitle>
 <CardDescription className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
 Capture the customer details and location needed for follow-up.
 </CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-4 px-4 pt-4 sm:px-6 sm:pt-5">
          {Object.keys(leadFieldErrors).length > 0 ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <p className="font-medium">Please fix the highlighted fields.</p>
              <ul className="mt-1 space-y-1 text-xs">
                {Object.entries(leadFieldErrors).map(([field, message]) => (
                  <li key={field}>
                    <button
                      type="button"
                      className="text-left underline-offset-2 hover:underline"
                      onClick={() => {
                        const target = document.querySelector(`[data-lead-field="${CSS.escape(field)}"]`);
                        target?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                    >
                      <span className="font-medium">{leadFieldLabel(field)}:</span> {message}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <FieldGroup className="min-w-0">
            <div className={leadFormGridClass}>
 {needsBranchPicker && (
 <Field data-invalid={Boolean(leadFieldErrors.branchId)} data-lead-field="branchId">
 <FieldLabel>Branch</FieldLabel>
 <Select
 value={formData.branchId}
 onValueChange={(value) => updateLeadField("branchId", value)}
 >
 <SelectTrigger
 className={cn(leadSelectTriggerClass, formControlErrorClass(Boolean(leadFieldErrors.branchId)))}
 {...formControlErrorProps(leadFieldErrors.branchId)}
 >
 <SelectValue placeholder="Select branch" />
 </SelectTrigger>
 <SelectContent>
 {branches.map((branch) => (
 <SelectItem key={branch.id} value={branch.id}>
 {branch.name}
 {branch.code ? ` (${branch.code})` : ""}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <FieldError>{leadFieldErrors.branchId}</FieldError>
 </Field>
 )}
 <Field>
 <FieldLabel>Location Type</FieldLabel>
 <Select
 value={formData.locationType}
 onValueChange={(value: LeadLocationType) => {
 setLeadFieldErrors((prev) => {
 const next = { ...prev };
 delete next.locationType;
 return next;
 });
 applyLocationFromType(value);
 }}
 >
 <SelectTrigger className={leadSelectTriggerClass}>
 <SelectValue placeholder="Select location type" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="home">Home</SelectItem>
 <SelectItem value="work">Work</SelectItem>
 <SelectItem value="sponsor">Sponsor</SelectItem>
 </SelectContent>
 </Select>
 </Field>
 <Field data-invalid={Boolean(leadFieldErrors.fullName)} data-lead-field="fullName">
 <FieldLabel>Full Name</FieldLabel>
 <Input
 placeholder="Potential customer name"
 value={formData.fullName}
 className={formControlErrorClass(Boolean(leadFieldErrors.fullName))}
 {...formControlErrorProps(leadFieldErrors.fullName)}
 onChange={(e) => updateLeadField("fullName", e.target.value)}
 />
 <FieldError>{leadFieldErrors.fullName}</FieldError>
 </Field>
 <Field data-invalid={Boolean(leadFieldErrors.phoneNumber)} data-lead-field="phoneNumber">
 <FieldLabel>Phone Number</FieldLabel>
 <TzValidatedInput
 kind="phone"
 placeholder="0712345678"
 value={formData.phoneNumber}
 className={formControlErrorClass(Boolean(leadFieldErrors.phoneNumber))}
 {...formControlErrorProps(leadFieldErrors.phoneNumber)}
 onValueChange={(phoneNumber) => updateLeadField("phoneNumber", phoneNumber)}
 maxLength={10}
 />
 <FieldError>{leadFieldErrors.phoneNumber}</FieldError>
 </Field>
 <Field data-invalid={Boolean(leadFieldErrors.alternatePhone)} data-lead-field="alternatePhone">
 <FieldLabel>Alternate Number (optional)</FieldLabel>
 <TzValidatedInput
 kind="phone"
 placeholder="0712345678"
 value={formData.alternatePhone}
 className={formControlErrorClass(Boolean(leadFieldErrors.alternatePhone))}
 {...formControlErrorProps(leadFieldErrors.alternatePhone)}
 onValueChange={(alternatePhone) => updateLeadField("alternatePhone", alternatePhone)}
 maxLength={10}
 />
 <FieldError>{leadFieldErrors.alternatePhone}</FieldError>
 </Field>
 <Field data-invalid={Boolean(leadFieldErrors.locationName)} data-lead-field="locationName" className="md:col-span-2">
 <FieldLabel>Street / Location</FieldLabel>
 <Input
 placeholder="Street, area, or landmark"
 value={formData.locationName}
 className={formControlErrorClass(Boolean(leadFieldErrors.locationName))}
 {...formControlErrorProps(leadFieldErrors.locationName)}
 onChange={(e) => updateLeadField("locationName", e.target.value)}
 />
 <FieldError>{leadFieldErrors.locationName}</FieldError>
 </Field>
 <Field>
 <FieldLabel>Region</FieldLabel>
 <Input
 placeholder="Region"
 value={formData.region}
 onChange={(e) => updateLeadField("region", e.target.value)}
 />
 </Field>
 <Field>
 <FieldLabel>District</FieldLabel>
 <Input
 placeholder="District"
 value={formData.district}
 onChange={(e) => updateLeadField("district", e.target.value)}
 />
 </Field>
 <Field>
 <FieldLabel>Ward</FieldLabel>
 <Input
 placeholder="Ward"
 value={formData.ward}
 onChange={(e) => updateLeadField("ward", e.target.value)}
 />
 </Field>
 <Field data-invalid={Boolean(leadFieldErrors.latitude)} data-lead-field="latitude">
 <FieldLabel>Latitude</FieldLabel>
 <Input
 type="number"
 step="any"
 placeholder="-6.7924"
 value={formData.latitude}
 className={formControlErrorClass(Boolean(leadFieldErrors.latitude))}
 {...formControlErrorProps(leadFieldErrors.latitude)}
 onChange={(e) => updateLeadField("latitude", e.target.value)}
 />
 <FieldError>{leadFieldErrors.latitude}</FieldError>
 </Field>
 <Field data-invalid={Boolean(leadFieldErrors.longitude)} data-lead-field="longitude">
 <FieldLabel>Longitude</FieldLabel>
 <Input
 type="number"
 step="any"
 placeholder="39.2083"
 value={formData.longitude}
 className={formControlErrorClass(Boolean(leadFieldErrors.longitude))}
 {...formControlErrorProps(leadFieldErrors.longitude)}
 onChange={(e) => updateLeadField("longitude", e.target.value)}
 />
 <FieldError>{leadFieldErrors.longitude}</FieldError>
 </Field>
 <Field data-invalid={Boolean(leadFieldErrors.followUpDate)} data-lead-field="followUpDate">
 <FieldLabel>Date Added</FieldLabel>
 <FieldDescription>When this lead was captured. Defaults to today; change if needed.</FieldDescription>
 <Input
 type="date"
 value={formData.followUpDate}
 className={formControlErrorClass(Boolean(leadFieldErrors.followUpDate))}
 {...formControlErrorProps(leadFieldErrors.followUpDate)}
 onChange={(e) => updateLeadField("followUpDate", e.target.value)}
 />
 <FieldError>{leadFieldErrors.followUpDate}</FieldError>
 </Field>
 <Field>
 <FieldLabel>Status</FieldLabel>
 <Select
 value={formData.status}
 onValueChange={(value: LeadStatus) =>
 setFormData((prev) => ({ ...prev, status: value }))
 }
 >
 <SelectTrigger className={leadSelectTriggerClass}>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="new">New</SelectItem>
 <SelectItem value="follow_up">Follow Up</SelectItem>
 <SelectItem value="contacted">Contacted</SelectItem>
 <SelectItem value="converted">Converted</SelectItem>
 </SelectContent>
 </Select>
 </Field>
 </div>
 <Field>
 <FieldLabel>Notes</FieldLabel>
 <Textarea
 rows={3}
 className="min-w-0"
 placeholder="Important follow-up details from the field visit"
 value={formData.notes}
 onChange={(e) => updateLeadField("notes", e.target.value)}
 />
 </Field>
 </FieldGroup>


 <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
 <Button variant="outline" className="w-full sm:w-auto" onClick={handleCaptureLocation} disabled={isLocating}>
 <LocateFixed className="mr-2 h-4 w-4" />
 {isLocating ? "Getting location…" : "Use browser location"}
 </Button>
 <Button
 type="button"
 className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
 disabled={saving}
 onClick={() => void handleAddLead()}
 >
 {saving ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Saving…
 </>
 ) : (
 <>
 <Plus className="mr-2 h-4 w-4" />
 Save Lead
 </>
 )}
 </Button>
 </div>

 {formData.latitude && formData.longitude && (
 <div className="overflow-hidden rounded-lg border border-border">
 <div className="border-b border-border bg-muted px-3 py-2 text-sm font-medium">
 New Lead Location Preview ({formData.region || "Unknown region"})
 </div>
 <iframe
 title="New lead location preview"
 src={`https://maps.google.com/maps?q=${formData.latitude},${formData.longitude}&z=15&output=embed`}
 className="h-64 w-full"
 loading="lazy"
 />
 </div>
 )}
 </CardContent>
 </Card>
 )}

 <Card ref={mapSectionRef}>
 <CardHeader>
 <CardTitle>Leads Map</CardTitle>
 <CardDescription>
 Select a lead to view their captured location on the map
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 <Select
 value={selectedLeadId}
 onValueChange={(id) => {
 setSelectedLeadId(id);
 void refreshLeadDetail(id);
 }}
 >
              <SelectTrigger className="w-full max-w-md">
 <SelectValue placeholder="Choose lead for map view" />
 </SelectTrigger>
 <SelectContent>
 {visibleLeads.map((lead) => (
 <SelectItem key={lead.id} value={lead.id}>
 {lead.fullName} - {lead.locationName}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>

 {mapLead && mapEmbedUrl ? (
 <div className="overflow-hidden rounded-lg border border-border">
 <div className="border-b border-border bg-muted px-3 py-2 text-sm">
 <span className="font-medium">{mapLead.fullName}</span> |{" "}
 <span className="text-muted-foreground">
 {mapLead.locationName} ({locationTypeLabel[mapLead.locationType]})
 </span>
 {!parseLeadCoordinates(mapLead) && (
 <span className="ml-2 text-xs text-amber-700">(approximate — from address)</span>
 )}
 </div>
 <iframe
 title="Lead location map"
 src={mapEmbedUrl}
 className="h-72 w-full"
 loading="lazy"
 />
 </div>
 ) : selectedLeadId ? (
 <p className="text-sm text-muted-foreground">
 This lead has no location name or coordinates. Add a location when editing the lead.
 </p>
 ) : (
 <p className="text-sm text-muted-foreground">
 Select a lead from the list or use View to show their location here.
 </p>
 )}
          </CardContent>
        </Card>
        </>
        )}
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Leads Report</DialogTitle>
            <DialogDescription>
              Choose the time frame for the field leads report. It will be generated as an Excel
              file with your name and role, ready to download.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="report-from">Start date</Label>
              <Input
                id="report-from"
                type="date"
                value={reportFrom}
                max={reportTo || undefined}
                onChange={(e) => setReportFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-to">End date</Label>
              <Input
                id="report-to"
                type="date"
                value={reportTo}
                min={reportFrom || undefined}
                onChange={(e) => setReportTo(e.target.value)}
              />
            </div>
          </div>
          {reportError ? <p className="text-sm text-destructive">{reportError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleGenerateReport}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
    </>
  );
}
