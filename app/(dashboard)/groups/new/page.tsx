"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, ShieldAlert, Users } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { useBranchAssignment } from "@/components/branch-assignment-context";
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
import { Textarea } from "@/components/ui/textarea";
import {
 activeBranchesForAssignment,
 loanOfficersForBranch,
} from "@/lib/customer-assignment-options";
import {
 extractBranchesList,
 mergeBranchesList,
 settingsRowsToBranches,
} from "@/lib/branch-adapters";
import { branchIdsMatch, syntheticBranchFromSession } from "@/lib/branch-scope";
import { parseSettingsBranches } from "@/lib/settings-adapters";
import { forceCachedReload } from "@/lib/client-fetch-cache";
import { extractCustomersList } from "@/lib/customer-adapters";
import { extractGroupDetail } from "@/lib/group-adapters";
import { extractUsersListPayload } from "@/lib/user-adapters";
import { GroupMeetingLocationSection } from "@/components/groups/group-meeting-location-section";
import type { GroupCreateForm } from "@/lib/group-payload";
import {
 canCreateGroups,
 isCreateOnlyGroupOfficer,
} from "@/lib/group-access";
import { formatValidationDetails } from "@/lib/falco-api";
import type { Branch, Customer, User } from "@/lib/types";
import { resolvePortalHref } from "@/lib/portal-paths";
import { useSessionUser } from "@/lib/use-session-user";

const MEETING_DAYS = [
 "Monday",
 "Tuesday",
 "Wednesday",
 "Thursday",
 "Friday",
 "Saturday",
 "Sunday",
];

const defaultForm: GroupCreateForm = {
 group_name: "",
 group_code: "",
 branch_id: "",
 loan_officer_id: "",
 chairperson_customer_id: "",
 secretary_customer_id: "",
 treasurer_customer_id: "",
 member_customer_ids: [],
 formation_date: new Date().toISOString().slice(0, 10),
 meeting_day: "Monday",
 meeting_location: "",
 village_or_street: "",
 meeting_latitude: null,
 meeting_longitude: null,
 status: "active",
 notes: "",
};

export default function NewGroupPage() {
 const router = useRouter();
 const { user, loaded: sessionLoaded } = useSessionUser();
 const canCreate = user ? canCreateGroups(user) : false;
 const isCreateOnlyOfficer = user ? isCreateOnlyGroupOfficer(user) : false;
 const lockedBranchId =
  isCreateOnlyOfficer || user?.role === "branch_manager" ? user?.branch_id ?? "" : "";
 const lockedOfficerId = isCreateOnlyOfficer ? user?.id ?? "" : "";
 const groupsListHref = resolvePortalHref(user?.role, "/groups");

 const { branches: contextBranches, users: contextUsers } = useBranchAssignment();

 const [form, setForm] = useState<GroupCreateForm>(() => ({
 ...defaultForm,
 branch_id: lockedBranchId,
 loan_officer_id: lockedOfficerId,
 }));
 const [error, setError] = useState("");
 const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
 const [submitting, setSubmitting] = useState(false);
 const [branchRecords, setBranchRecords] = useState<Branch[]>([]);
 const [branchesLoading, setBranchesLoading] = useState(false);
 const [branchesError, setBranchesError] = useState("");
 const [loanOfficers, setLoanOfficers] = useState<User[]>([]);
 const [officersLoading, setOfficersLoading] = useState(false);
 const [officersError, setOfficersError] = useState("");
 const [customers, setCustomers] = useState<Customer[]>([]);
 const [customersLoading, setCustomersLoading] = useState(false);

 const patch = (updates: Partial<GroupCreateForm>) => setForm((prev) => ({ ...prev, ...updates }));

 const loadBranches = useCallback(async (opts?: { silent?: boolean }) => {
 if (!sessionLoaded) return;

 if (!opts?.silent) {
 setBranchesLoading(true);
 }
 setBranchesError("");

 try {
 if (lockedBranchId && user) {
 const fromContext = contextBranches.find(
 (branch) =>
 branchIdsMatch(branch.id, lockedBranchId) || branchIdsMatch(branch.code, lockedBranchId)
 );
 const synthetic = syntheticBranchFromSession({
 role: user.role,
 branch_id: lockedBranchId,
 });
 setBranchRecords([
 fromContext ?? {
 ...synthetic,
 name: user.branch_name?.trim() || synthetic.name,
 },
 ]);
 return;
 }

 if (lockedBranchId) {
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

 const [falcoRes, settingsRes] = await Promise.all([
 fetch("/api/falco/branches", { credentials: "include", cache: "no-store" }),
 fetch("/api/settings/branches", { credentials: "include", cache: "no-store" }),
 ]);

 const falcoJson = falcoRes.ok
 ? ((await falcoRes.json()) as { branches?: Branch[]; message?: string })
 : null;
 const settingsJson = settingsRes.ok ? ((await settingsRes.json()) as unknown) : null;

 const fromFalco = falcoJson?.branches?.length
 ? falcoJson.branches
 : falcoJson
 ? extractBranchesList(falcoJson)
 : [];
 const fromSettings = settingsJson
 ? settingsRowsToBranches(parseSettingsBranches(settingsJson))
 : [];

 const loaded = mergeBranchesList(fromFalco, fromSettings, contextBranches);

 setBranchRecords(loaded);
 if (!loaded.length) {
 const hint = !falcoRes.ok
 ? falcoJson?.message ?? "Could not load branches from the server."
 : "No registered branches found. Add branches under Branches in the menu first.";
 setBranchesError(hint);
 }
 } catch {
 setBranchesError("Could not load branches");
 setBranchRecords(mergeBranchesList(contextBranches));
 } finally {
 setBranchesLoading(false);
 }
 }, [lockedBranchId, contextBranches, sessionLoaded, user]);

 const loadOfficersForBranch = useCallback(
 async (branchId?: string) => {
 if (lockedOfficerId && user) {
 setOfficersError("");
 setOfficersLoading(false);
 setLoanOfficers([
 {
 id: user.id,
 email: user.email,
 full_name: user.full_name,
 role: "loan_officer",
 branch_id: user.branch_id ?? "",
 phone: user.phone ?? "",
 employee_id: user.employee_id ?? "",
 is_active: true,
 created_at: new Date().toISOString(),
 last_login: null,
 },
 ]);
 return;
 }
 const targetBranchId = String(branchId ?? form.branch_id).trim();
 if (!targetBranchId) {
 setLoanOfficers([]);
 setOfficersError("");
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
 const res = await fetch(`/api/staff/directory?${params.toString()}`, { credentials: "include" });
 const json = (await res.json()) as { users?: User[]; error?: string; message?: string };
 let users: User[] = [];
 if (res.ok) {
 users = extractUsersListPayload(json).users;
 } else {
 setOfficersError(json.error ?? json.message ?? `Could not load officers (${res.status})`);
 }
 if (!users.length) {
 users = loanOfficersForBranch(contextUsers, targetBranchId);
 }
 const officers = loanOfficersForBranch(users, targetBranchId);
 setLoanOfficers(officers);
 if (!officers.length) {
 setOfficersError("No active loan officers are assigned to this branch.");
 }
 } catch {
 setOfficersError("Could not load loan officers");
 setLoanOfficers([]);
 } finally {
 setOfficersLoading(false);
 }
 },
 [form.branch_id, lockedOfficerId, user, contextUsers]
 );

 const loadCustomers = useCallback(async (branchId: string) => {
 if (!branchId) {
 setCustomers([]);
 return;
 }
 setCustomersLoading(true);
 try {
 const params = new URLSearchParams({ branch_id: branchId, is_active: "true", page_size: "200" });
 const res = await fetch(`/api/customers?${params.toString()}`, { credentials: "include" });
 if (!res.ok) {
 setCustomers([]);
 return;
 }
 const json = (await res.json()) as unknown;
 setCustomers(extractCustomersList(json));
 } finally {
 setCustomersLoading(false);
 }
 }, []);

 useEffect(() => {
 if (!sessionLoaded) return;
 void loadBranches();
 }, [loadBranches, sessionLoaded]);

 useEffect(() => {
 if (!contextBranches.length || lockedBranchId) return;
 setBranchRecords((prev) => mergeBranchesList(prev, extractBranchesList(contextBranches)));
 }, [contextBranches, lockedBranchId]);

 useEffect(() => {
 if (lockedBranchId) {
 const matched = branchRecords.find(
 (branch) =>
 branchIdsMatch(branch.id, lockedBranchId) || branchIdsMatch(branch.code, lockedBranchId)
 );
 setForm((prev) => ({
 ...prev,
 branch_id: matched?.id ?? lockedBranchId,
 }));
 }
 if (lockedOfficerId) {
 setForm((prev) => ({ ...prev, loan_officer_id: lockedOfficerId }));
 }
 }, [lockedBranchId, lockedOfficerId, branchRecords]);

 useEffect(() => {
 void loadOfficersForBranch();
 }, [loadOfficersForBranch]);

 useEffect(() => {
 if (!form.branch_id) {
 setCustomers([]);
 return;
 }
 void loadCustomers(form.branch_id);
 }, [form.branch_id, loadCustomers]);

 const branchOptions = useMemo(
 () => activeBranchesForAssignment(branchRecords, lockedBranchId),
 [branchRecords, lockedBranchId]
 );

 const loanOfficerOptions = useMemo(
 () => loanOfficersForBranch(loanOfficers, form.branch_id),
 [loanOfficers, form.branch_id]
 );

 const handleBranchChange = (branchId: string) => {
 if (!branchId) return;
 setForm((prev) => ({
 ...prev,
 branch_id: branchId,
 loan_officer_id: lockedOfficerId || "",
 chairperson_customer_id: "",
 secretary_customer_id: "",
 treasurer_customer_id: "",
 member_customer_ids: [],
 }));
 if (!lockedOfficerId) {
 void loadOfficersForBranch(branchId);
 }
 };

 const customerLabel = (customer: Customer) =>
 `${customer.first_name} ${customer.last_name} (${customer.customer_number})`;

 const toggleMember = (customerId: string, checked: boolean) => {
 setForm((prev) => {
 const set = new Set(prev.member_customer_ids);
 if (checked) set.add(customerId);
 else set.delete(customerId);
 return { ...prev, member_customer_ids: Array.from(set) };
 });
 };

 const applyFieldErrors = (details: unknown): boolean => {
  if (!Array.isArray(details)) return false;
  const map: Record<string, string> = {};
  for (const d of details as { field?: string; message?: string }[]) {
   const field = (d.field ?? "").toLowerCase();
   const message = d.message ?? "";
   if (!message) continue;
   if (field.includes("branch")) map.branch_id = message;
   else if (field.includes("loan_officer")) map.loan_officer_id = message;
   else if (field.includes("chairperson")) map.chairperson_customer_id = message;
   else if (field.includes("secretary")) map.secretary_customer_id = message;
   else if (field.includes("treasurer")) map.treasurer_customer_id = message;
   else if (field.includes("member")) map.member_customer_ids = message;
   else if (field.includes("group_name")) map.group_name = message;
   else if (field.includes("formation")) map.formation_date = message;
   else if (field.includes("meeting_day")) map.meeting_day = message;
   else if (field.includes("meeting_location")) map.meeting_location = message;
   else if (field.includes("village")) map.village_or_street = message;
  }
  if (Object.keys(map).length === 0) return false;
  setFieldErrors(map);
  return true;
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError("");
 setFieldErrors({});
 setSubmitting(true);
 try {
 const res = await fetch("/api/groups", {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(form),
 });
 const json = (await res.json()) as unknown;
 if (!res.ok) {
 const o = json as { message?: string; details?: { field?: string; message?: string }[] };
 if (res.status === 403) {
 setError(o.message || "You do not have permission to create this group.");
 return;
 }
 if (res.status === 422 && applyFieldErrors(o.details)) {
 setError(formatValidationDetails(o.details) || o.message || "Please fix the highlighted fields.");
 return;
 }
 const detailText = formatValidationDetails(o.details);
 setError(detailText || o.message || "Failed to create vikundi");
 return;
 }
 const created = extractGroupDetail(json);
 router.push(
 created?.id
 ? resolvePortalHref(user?.role, `/groups/${created.id}`)
 : groupsListHref
 );
 router.refresh();
 } catch {
 setError("Could not reach the server. Try again.");
 } finally {
 setSubmitting(false);
 }
 };

 if (!sessionLoaded) {
 return (
 <>
 <DashboardHeader title="Add New Kikundi" description="Loading session…" />
 <main className="flex-1 p-4 lg:p-6">
 <p className="text-sm text-muted-foreground">Loading session…</p>
 </main>
 </>
 );
 }

 if (!canCreate) {
 return (
 <>
 <DashboardHeader title="Add New Kikundi" description="Register a vikundi / vikoba group" />
 <main className="flex-1 p-4 lg:p-6">
 <Card className="mx-auto max-w-3xl border-destructive/30 bg-destructive/5">
 <CardHeader>
 <CardTitle className="flex items-center gap-2 text-destructive">
 <ShieldAlert className="h-5 w-5" />
 Access denied
 </CardTitle>
 <CardDescription>You do not have permission to create vikundi groups.</CardDescription>
 </CardHeader>
 <CardContent>
 <Button asChild variant="outline">
 <Link href={groupsListHref}>Back to Vikundi</Link>
 </Button>
 </CardContent>
 </Card>
 </main>
 </>
 );
 }

 const selectedBranch = branchOptions.find(
 (branch) =>
 branchIdsMatch(branch.id, form.branch_id) || branchIdsMatch(branch.code, form.branch_id)
 );
 const selectedOfficer = loanOfficerOptions.find((officer) => officer.id === form.loan_officer_id);

 return (
 <>
 <DashboardHeader
 title="Add New Kikundi"
 description="Register a vikundi / vikoba group for group-based lending"
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-3xl space-y-6">
 <Button variant="ghost" size="sm" asChild>
 <Link href={groupsListHref}>
 <ArrowLeft className="mr-2 h-4 w-4" />
 Back to Vikundi
 </Link>
 </Button>

 <form onSubmit={handleSubmit} className="space-y-6">
 {error ? (
 <Card className="border-destructive/40 bg-destructive/5">
 <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
 </Card>
 ) : null}

 <Card>
 <CardHeader>
 <CardTitle>Group details</CardTitle>
 <CardDescription>Enter the required information for this group.</CardDescription>
 </CardHeader>
 <CardContent className="grid gap-4 sm:grid-cols-2">
 <div className="sm:col-span-2 space-y-2">
 <Label htmlFor="group_name">Group name *</Label>
 <Input
 id="group_name"
 value={form.group_name}
 onChange={(e) => patch({ group_name: e.target.value })}
 placeholder="e.g. Umoja Women Traders"
 required
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="group_code">Group code</Label>
 <Input
 id="group_code"
 value={form.group_code}
 onChange={(e) => patch({ group_code: e.target.value })}
 placeholder="Auto-generated if empty"
 />
 </div>
 <div className="space-y-2">
 <Label>Status</Label>
 <Select value={form.status} onValueChange={(v) => patch({ status: v as GroupCreateForm["status"] })}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="active">Active</SelectItem>
 <SelectItem value="inactive">Inactive</SelectItem>
 <SelectItem value="suspended">Suspended</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2 sm:col-span-2">
 <div className="flex items-center justify-between gap-2">
 <Label htmlFor="branch">Branch *</Label>
 {!isCreateOnlyOfficer && !branchesLoading && branchOptions.length > 0 ? (
 <span className="text-xs text-muted-foreground">{branchOptions.length} registered</span>
 ) : null}
 </div>
 {isCreateOnlyOfficer ? (
 <>
 <p className="text-xs text-muted-foreground">
 Your assigned branch is used automatically for this vikundi.
 </p>
 <Input
 id="branch"
 readOnly
 value={
 selectedBranch
 ? `${selectedBranch.name || selectedBranch.code || selectedBranch.id} (${selectedBranch.id})`
 : form.branch_id
 ? `${user?.branch_name?.trim() || form.branch_id} (${form.branch_id})`
 : ""
 }
 />
 {fieldErrors.branch_id ? (
 <p className="text-xs text-destructive">{fieldErrors.branch_id}</p>
 ) : null}
 </>
 ) : (
 <>
 <p className="text-xs text-muted-foreground">
 Select which registered branch this new vikundi belongs to.
 </p>
 <Select
 value={form.branch_id || undefined}
 onValueChange={handleBranchChange}
 disabled={Boolean(lockedBranchId) || !sessionLoaded || (branchesLoading && branchOptions.length === 0)}
 >
 <SelectTrigger id="branch" className="w-full">
 <SelectValue
 placeholder={
 !sessionLoaded || (branchesLoading && branchOptions.length === 0)
 ? "Loading branches…"
 : "Select branch"
 }
 />
 </SelectTrigger>
 <SelectContent>
 {branchOptions.map((branch) => (
 <SelectItem key={branch.id} value={String(branch.id)}>
 {branch.name || branch.code || branch.id}
 {branch.code ? ` (${branch.code})` : ""}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 {branchesLoading ? (
 <p className="text-xs text-muted-foreground">Loading registered branches…</p>
 ) : null}
 {!branchesLoading && branchOptions.length === 0 ? (
 <p className="text-xs text-muted-foreground">
 No branches found. Go to Branches in the menu and register a branch first.
 </p>
 ) : null}
 {branchesError ? <p className="text-xs text-destructive">{branchesError}</p> : null}
 {fieldErrors.branch_id ? (
 <p className="text-xs text-destructive">{fieldErrors.branch_id}</p>
 ) : null}
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => forceCachedReload(() => loadBranches({ silent: branchOptions.length > 0 }))}
 disabled={branchesLoading}
 >
 {branchesLoading ? "Refreshing…" : "Refresh branch list"}
 </Button>
 </>
 )}
 </div>
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="loan-officer">Loan officer *</Label>
 {isCreateOnlyOfficer ? (
 <>
 <p className="text-xs text-muted-foreground">
 You are recorded as the loan officer for this vikundi.
 </p>
 <Input
 id="loan-officer"
 readOnly
 value={
 selectedOfficer
 ? `${selectedOfficer.full_name || selectedOfficer.email} (${selectedOfficer.id})`
 : user?.full_name
 ? `${user.full_name} (${user.id})`
 : ""
 }
 />
 {fieldErrors.loan_officer_id ? (
 <p className="text-xs text-destructive">{fieldErrors.loan_officer_id}</p>
 ) : null}
 </>
 ) : (
 <>
 <p className="text-xs text-muted-foreground">
 Choose a loan officer assigned to the selected branch.
 </p>
 <Select
 value={form.loan_officer_id || undefined}
 onValueChange={(v) => patch({ loan_officer_id: v })}
 disabled={!form.branch_id || Boolean(lockedOfficerId) || (officersLoading && loanOfficerOptions.length === 0)}
 >
 <SelectTrigger id="loan-officer" className="w-full">
 <SelectValue
 placeholder={
 !form.branch_id
 ? "Select branch first"
 : officersLoading && loanOfficerOptions.length === 0
 ? "Loading officers…"
 : "Select loan officer"
 }
 />
 </SelectTrigger>
 <SelectContent>
 {loanOfficerOptions.map((officer) => (
 <SelectItem key={officer.id} value={String(officer.id)}>
 {officer.full_name || officer.email}
 {officer.employee_id ? ` (${officer.employee_id})` : ""}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 {officersLoading ? (
 <p className="text-xs text-muted-foreground">Loading loan officers…</p>
 ) : null}
 {officersError ? <p className="text-xs text-destructive">{officersError}</p> : null}
 {fieldErrors.loan_officer_id ? (
 <p className="text-xs text-destructive">{fieldErrors.loan_officer_id}</p>
 ) : null}
 </>
 )}
 </div>
<div className="space-y-2">
 <Label>Formation date *</Label>
 <Input
 type="date"
 value={form.formation_date}
 onChange={(e) => patch({ formation_date: e.target.value })}
 required
 />
 </div>
 <div className="space-y-2">
 <Label>Meeting day *</Label>
 <Select value={form.meeting_day} onValueChange={(v) => patch({ meeting_day: v })}>
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {MEETING_DAYS.map((day) => (
 <SelectItem key={day} value={day}>
 {day}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <GroupMeetingLocationSection
 value={{
 meeting_location: form.meeting_location,
 village_or_street: form.village_or_street,
 meeting_latitude: form.meeting_latitude,
 meeting_longitude: form.meeting_longitude,
 }}
 onChange={(updates) => patch(updates)}
 />
 <div className="sm:col-span-2 space-y-2">
 <Label>Notes</Label>
 <Textarea
 value={form.notes}
 onChange={(e) => patch({ notes: e.target.value })}
 rows={3}
 />
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Leadership & members</CardTitle>
 <CardDescription>
 All customers must belong to the selected branch. Chairperson is required and included in members.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-2">
 <Label>Chairperson *</Label>
 <Select
 value={form.chairperson_customer_id}
 onValueChange={(v) => {
 setForm((prev) => {
 const ids = new Set(prev.member_customer_ids);
 ids.add(v);
 return {
 ...prev,
 chairperson_customer_id: v,
 member_customer_ids: Array.from(ids),
 };
 });
 }}
 disabled={!form.branch_id}
 >
 <SelectTrigger>
 <SelectValue placeholder={form.branch_id ? "Select chairperson" : "Select branch first"} />
 </SelectTrigger>
 <SelectContent>
 {customers.map((customer) => (
 <SelectItem key={customer.id} value={customer.id}>
 {customerLabel(customer)}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="grid gap-4 sm:grid-cols-2">
 <div className="space-y-2">
 <Label>Secretary</Label>
 <Select
 value={form.secretary_customer_id || "none"}
 onValueChange={(v) => patch({ secretary_customer_id: v === "none" ? "" : v })}
 disabled={!form.branch_id}
 >
 <SelectTrigger>
 <SelectValue placeholder="Optional" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="none">None</SelectItem>
 {customers.map((customer) => (
 <SelectItem key={customer.id} value={customer.id}>
 {customerLabel(customer)}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label>Treasurer</Label>
 <Select
 value={form.treasurer_customer_id || "none"}
 onValueChange={(v) => patch({ treasurer_customer_id: v === "none" ? "" : v })}
 disabled={!form.branch_id}
 >
 <SelectTrigger>
 <SelectValue placeholder="Optional" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="none">None</SelectItem>
 {customers.map((customer) => (
 <SelectItem key={customer.id} value={customer.id}>
 {customerLabel(customer)}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>

 <div className="space-y-3">
 <Label className="flex items-center gap-2">
 <Users className="h-4 w-4" />
 Additional members
 </Label>
 {!form.branch_id ? (
 <p className="text-sm text-muted-foreground">Select a branch to load customers.</p>
 ) : customers.length === 0 ? (
 <p className="text-sm text-muted-foreground">No active customers in this branch.</p>
 ) : (
 <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
 {customers.map((customer) => {
 const checked =
 form.member_customer_ids.includes(customer.id) ||
 customer.id === form.chairperson_customer_id;
 return (
 <label
 key={customer.id}
 className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
 >
 <Checkbox
 checked={checked}
 disabled={customer.id === form.chairperson_customer_id}
 onCheckedChange={(v) => toggleMember(customer.id, Boolean(v))}
 />
 <span className="text-sm">{customerLabel(customer)}</span>
 </label>
 );
 })}
 </div>
 )}
 </div>
 </CardContent>
 </Card>

 <div className="flex justify-end gap-2">
 <Button type="button" variant="outline" asChild>
 <Link href={groupsListHref}>Cancel</Link>
 </Button>
 <Button type="submit" disabled={submitting || !form.group_name || !form.loan_officer_id}>
 <Save className="mr-2 h-4 w-4" />
 {submitting ? "Saving…" : "Create Kikundi"}
 </Button>
 </div>
 </form>
 </div>
 </main>
 </>
 );
}
