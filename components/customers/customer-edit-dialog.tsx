"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { CustomerAttachmentsFields } from "@/components/customers/customer-attachments-fields";
import { Button } from "@/components/ui/button";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from "@/components/ui/dialog";
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
import {
 activeBranchesForAssignment,
 loanOfficersForBranch,
} from "@/lib/customer-assignment-options";
import type { Branch, Customer, User } from "@/lib/types";
import { useSessionUser } from "@/lib/use-session-user";

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
 alt_phone: string;
 email: string;
 physical_address: string;
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

const ID_TYPE_OPTIONS = ["NIDA", "Passport", "Driving License", "Voter ID"];

function toEditForm(p: Record<string, unknown>): EditForm {
 return {
 first_name: String(p.first_name ?? ""),
 middle_name: String(p.middle_name ?? ""),
 last_name: String(p.last_name ?? ""),
 phone: String(p.phone ?? ""),
 alt_phone: String(p.alt_phone ?? ""),
 email: String(p.email ?? ""),
 physical_address: String(p.physical_address ?? ""),
 street: String(p.street ?? ""),
 ward: String(p.ward ?? ""),
 district: String(p.district ?? ""),
 region: String(p.region ?? ""),
 national_id: String(p.national_id ?? ""),
 id_type: String(p.id_type ?? "NIDA"),
 occupation: String(p.occupation ?? ""),
 employer_name: String(p.employer_name ?? ""),
 employer_address: String(p.employer_address ?? ""),
 employer_phone: String(p.employer_phone ?? ""),
 employment_start_date: String(p.employment_start_date ?? ""),
 monthly_income: String(p.monthly_income ?? ""),
 business_name: String(p.business_name ?? ""),
 business_type: String(p.business_type ?? ""),
 business_address: String(p.business_address ?? ""),
 business_registration_no: String(p.business_registration_no ?? ""),
 years_in_business: String(p.years_in_business ?? ""),
 cheque_number: String(p.cheque_number ?? ""),
 payment_reference: String(p.payment_reference ?? ""),
 registration_fee_paid: Boolean(p.registration_fee_paid),
 registration_fee_amount: String(p.registration_fee_amount ?? ""),
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

function formToPatchBody(form: EditForm): Record<string, unknown> {
 return {
 first_name: form.first_name,
 middle_name: form.middle_name,
 last_name: form.last_name,
 full_name: [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(" "),
 phone: form.phone,
 alt_phone: form.alt_phone,
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
 monthly_income: form.monthly_income,
 business_name: form.business_name,
 business_type: form.business_type,
 business_address: form.business_address,
 business_registration_no: form.business_registration_no,
 years_in_business: form.years_in_business,
 cheque_number: form.cheque_number,
 payment_reference: form.payment_reference,
 registration_fee_paid: form.registration_fee_paid,
 registration_fee_amount: form.registration_fee_amount,
 registration_fee_paid_at: form.registration_fee_paid_at,
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

type CustomerEditDialogProps = {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 customerId: string;
 customer: Customer;
 sourceRow: Record<string, unknown> | null;
 onSaved: (next: Customer, row: Record<string, unknown> | null) => void;
};

export function CustomerEditDialog({
 open,
 onOpenChange,
 customerId,
 customer,
 sourceRow,
 onSaved,
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

 const existingAttachments = useMemo(
 () => extractCustomerAttachmentsFromRow(sourceRow),
 [sourceRow]
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
 return;
 }
 const base = customerToFormPayload(customer, sourceRow);
 setForm(toEditForm(base));
 setAttachments(emptyCustomerAttachments());
 }, [open, customer, sourceRow]);

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
 if (!form.payment_reference.trim()) return "Payment reference is required.";
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
 setSaving(true);
 try {
 const r = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ ...formToPatchBody(form), is_blacklisted: customer.is_blacklisted }),
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
 setError("Unexpected response from server.");
 return;
 }
 onSaved(adaptApiCustomerRowToCustomer(row), row);
 onOpenChange(false);
 } catch {
 setError("Network error. Try again.");
 } finally {
 setSaving(false);
 }
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
 <DialogHeader>
 <DialogTitle>Edit customer</DialogTitle>
 <DialogDescription>
 Update KYC and assignment details. Changes are saved to the LMS via{" "}
 <span className="font-mono text-xs">PATCH /customers/{"{id}"}</span>.
 </DialogDescription>
 </DialogHeader>

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
 <div className="space-y-2">
 <Label htmlFor="edit-alt">Alternate phone</Label>
 <Input id="edit-alt" value={form.alt_phone} onChange={(e) => updateField("alt_phone", e.target.value)} />
 </div>
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
 {ID_TYPE_OPTIONS.map((t) => (
 <SelectItem key={t} value={t}>
 {t}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-nid">National ID</Label>
 <Input id="edit-nid" value={form.national_id} onChange={(e) => updateField("national_id", e.target.value)} />
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

 <Separator />

 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label htmlFor="edit-occ">Occupation</Label>
 <Input id="edit-occ" value={form.occupation} onChange={(e) => updateField("occupation", e.target.value)} />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-income">Monthly income</Label>
 <Input
 id="edit-income"
 type="number"
 min={0}
 value={form.monthly_income}
 onChange={(e) => updateField("monthly_income", e.target.value)}
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
 <Input
 id="edit-biz-addr"
 value={form.business_address}
 onChange={(e) => updateField("business_address", e.target.value)}
 />
 </div>
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
 onChange={(e) => updateField("payment_reference", e.target.value)}
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
 onCheckedChange={(c) => updateField("registration_fee_paid", c === true)}
 />
 <Label htmlFor="edit-reg-paid" className="font-normal">
 Registration fee paid
 </Label>
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-reg-amt">Registration fee amount</Label>
 <Input
 id="edit-reg-amt"
 type="number"
 min={0}
 value={form.registration_fee_amount}
 onChange={(e) => updateField("registration_fee_amount", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-reg-at">Registration fee paid at</Label>
 <Input
 id="edit-reg-at"
 type="datetime-local"
 value={form.registration_fee_paid_at}
 onChange={(e) => updateField("registration_fee_paid_at", e.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="edit-cheque">Cheque number</Label>
 <Input id="edit-cheque" value={form.cheque_number} onChange={(e) => updateField("cheque_number", e.target.value)} />
 </div>
 </div>

 <Separator />

 <div className="space-y-1">
 <p className="text-sm font-semibold">Attachments</p>
 <p className="text-xs text-muted-foreground">
 Optional location photos and supporting documents. New files are kept on this form until customer
 upload is enabled on the API.
 </p>
 </div>
 <CustomerAttachmentsFields
 value={attachments}
 onChange={setAttachments}
 existingHomeUrl={existingAttachments.homeLocationPhotoUrl}
 existingBusinessUrl={existingAttachments.businessLocationPhotoUrl}
 existingDocuments={existingAttachments.supportingDocuments}
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
 </DialogContent>
 </Dialog>
 );
}
