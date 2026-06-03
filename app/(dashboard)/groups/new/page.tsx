"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, Users } from "lucide-react";
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
import { parseSettingsBranches } from "@/lib/settings-adapters";
import { forceCachedReload } from "@/lib/client-fetch-cache";
import { extractCustomersList } from "@/lib/customer-adapters";
import { extractGroupDetail } from "@/lib/group-adapters";
import { extractUsersListPayload } from "@/lib/user-adapters";
import type { GroupCreateForm } from "@/lib/group-payload";
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
 status: "active",
 notes: "",
};

export default function NewGroupPage() {
 const router = useRouter();
 const { user } = useSessionUser();
 const isOfficerView = user?.role === "loan_officer";
 const isScopedRole = user?.role === "branch_manager" || isOfficerView;
 const lockedBranchId = isScopedRole ? user?.branch_id ?? "" : "";
 const lockedOfficerId = isOfficerView ? user?.id ?? "" : "";
 const groupsListHref = resolvePortalHref(user?.role, "/groups");

 const { branches: contextBranches, users: contextUsers } = useBranchAssignment();

 const [form, setForm] = useState<GroupCreateForm>(() => ({
 ...defaultForm,
 branch_id: lockedBranchId,
 loan_officer_id: lockedOfficerId,
 }));
 const [error, setError] = useState("");
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

 const loadBranches = useCallback(async () => {
 setBranchesLoading(true);
 setBranchesError("");
 try {
 if (lockedBranchId) {
 const fromContext = contextBranches.find((b) => String(b.id).trim() === lockedBranchId);
 setBranchRecords(
 fromContext
 ? [fromContext]
 : [
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
 ]
 );
 return;
 }

 const [falcoRes, settingsRes] = await Promise.all([
 fetch("/api/falco/branches", { credentials: "include" }),
 fetch("/api/settings/branches", { credentials: "include" }),
 ]);

 const falcoJson = falcoRes.ok ? ((await falcoRes.json()) as unknown) : null;
 const settingsJson = settingsRes.ok ? ((await settingsRes.json()) as unknown) : null;

 const fromFalco = falcoJson ? extractBranchesList(falcoJson) : [];
 const fromSettings = settingsJson
 ? settingsRowsToBranches(parseSettingsBranches(settingsJson))
 : [];
 const fromContext = extractBranchesList(contextBranches);

 const loaded = mergeBranchesList(fromFalco, fromSettings, fromContext);

 setBranchRecords(loaded);
 if (!loaded.length) {
 const hint = !falcoRes.ok
 ? "Could not load branches from the server."
 : "No registered branches found. Add branches under Branches in the menu first.";
 setBranchesError(hint);
 }
 } catch {
 setBranchesError("Could not load branches");
 setBranchRecords(mergeBranchesList(extractBranchesList(contextBranches)));
 } finally {
 setBranchesLoading(false);
 }
 }, [lockedBranchId, contextBranches]);

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
 void loadBranches();
 }, [loadBranches]);

 useEffect(() => {
 if (!contextBranches.length || lockedBranchId) return;
 setBranchRecords((prev) => mergeBranchesList(prev, extractBranchesList(contextBranches)));
 }, [contextBranches, lockedBranchId]);

 useEffect(() => {
 if (lockedBranchId) {
 setForm((prev) => ({ ...prev, branch_id: lockedBranchId }));
 }
 if (lockedOfficerId) {
 setForm((prev) => ({ ...prev, loan_officer_id: lockedOfficerId }));
 }
 }, [lockedBranchId, lockedOfficerId]);

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

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError("");
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
 <CardDescription>Required fields per the LMS groups API</CardDescription>
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
 {!branchesLoading && branchOptions.length > 0 ? (
 <span className="text-xs text-muted-foreground">{branchOptions.length} registered</span>
 ) : null}
 </div>
 <p className="text-xs text-muted-foreground">
 Select which registered branch this new vikundi belongs to.
 </p>
 <select
 id="branch"
 className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
 value={form.branch_id}
 onChange={(e) => handleBranchChange(e.target.value)}
 onFocus={() => void loadBranches()}
 disabled={Boolean(lockedBranchId) || branchesLoading}
 required
 >
 <option value="" disabled>
 {branchesLoading ? "Loading branches…" : "— Select branch —"}
 </option>
 {branchOptions.map((branch) => (
 <option key={branch.id} value={String(branch.id)}>
 {branch.name || branch.code || branch.id}
 {branch.code ? ` (${branch.code})` : ""}
 </option>
 ))}
 </select>
 {branchesLoading ? (
 <p className="text-xs text-muted-foreground">Loading registered branches…</p>
 ) : null}
 {!branchesLoading && branchOptions.length === 0 ? (
 <p className="text-xs text-muted-foreground">
 No branches found. Go to Branches in the menu and register a branch first.
 </p>
 ) : null}
 {branchesError ? <p className="text-xs text-destructive">{branchesError}</p> : null}
 <Button type="button" variant="outline" size="sm" onClick={() => forceCachedReload(loadBranches)} disabled={branchesLoading}>
 {branchesLoading ? "Refreshing…" : "Refresh branch list"}
 </Button>
 </div>
 <div className="space-y-2 sm:col-span-2">
 <Label htmlFor="loan-officer">Loan officer *</Label>
 <p className="text-xs text-muted-foreground">
 Choose a loan officer assigned to the selected branch.
 </p>
 <select
 id="loan-officer"
 className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
 value={form.loan_officer_id}
 onChange={(e) => patch({ loan_officer_id: e.target.value })}
 disabled={!form.branch_id || Boolean(lockedOfficerId) || officersLoading}
 required
 >
 <option value="" disabled>
 {!form.branch_id
 ? "Select branch first"
 : officersLoading
 ? "Loading officers…"
 : "— Select loan officer —"}
 </option>
 {loanOfficerOptions.map((officer) => (
 <option key={officer.id} value={String(officer.id)}>
 {officer.full_name || officer.email}
 {officer.employee_id ? ` (${officer.employee_id})` : ""}
 </option>
 ))}
 </select>
 {officersLoading ? (
 <p className="text-xs text-muted-foreground">Loading loan officers…</p>
 ) : null}
 {officersError ? <p className="text-xs text-destructive">{officersError}</p> : null}
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
 <div className="sm:col-span-2 space-y-2">
 <Label>Meeting location *</Label>
 <Input
 value={form.meeting_location}
 onChange={(e) => patch({ meeting_location: e.target.value })}
 placeholder="Community hall, ward office, etc."
 required
 />
 </div>
 <div className="sm:col-span-2 space-y-2">
 <Label>Village / street *</Label>
 <Input
 value={form.village_or_street}
 onChange={(e) => patch({ village_or_street: e.target.value })}
 required
 />
 </div>
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
