"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Loader2, MoreHorizontal, Search, UserMinus, UserPlus, Users, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
 Card,
 CardAction,
 CardContent,
 CardDescription,
 CardHeader,
 CardTitle,
} from "@/components/ui/card";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
} from "@/components/ui/dialog";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from "@/components/ui/table";
import {
  GroupMemberApplyLoanDialog,
  type GroupMemberApplyTarget,
} from "@/components/groups/group-member-apply-loan-dialog";
import { extractCustomersList } from "@/lib/customer-adapters";
import { formatValidationDetails } from "@/lib/falco-api";
import type { GroupDetailView } from "@/lib/group-adapters";
import {
 buildAddGroupMemberBody,
 isChairpersonMember,
 leadershipRoleForCustomer,
} from "@/lib/group-members";
import { formatCurrency } from "@/lib/formatters";
import type { Customer, RiskGrade, UserRole } from "@/lib/types";

type AssignableRole = "member" | "chairperson" | "secretary" | "treasurer";

const GROUP_ROLE_OPTIONS: Array<{ value: AssignableRole; label: string }> = [
 { value: "member", label: "Member" },
 { value: "chairperson", label: "Chairperson" },
 { value: "secretary", label: "Secretary" },
 { value: "treasurer", label: "Treasurer" },
];

const LEADERSHIP_FIELD_BY_ROLE: Record<Exclude<AssignableRole, "member">, keyof GroupDetailView> = {
 chairperson: "chairperson_customer_id",
 secretary: "secretary_customer_id",
 treasurer: "treasurer_customer_id",
};

const riskVariant: Record<
 RiskGrade,
 "default" | "secondary" | "destructive" | "outline"
> = {
 A: "default",
 B: "secondary",
 C: "outline",
 D: "destructive",
 E: "destructive",
};

type Props = {
 groupId: string;
 group: GroupDetailView;
 onChanged: () => void | Promise<void>;
 /** Sum of `total_outstanding` from each member's loans (from loans API). */
 memberOutstanding?: Record<string, number> | null;
 /** Loan officers: view members only (no assign/remove). */
 readOnly?: boolean;
 customerDetailHref?: (customerId: string) => string;
 /** When set, View / member name links use this instead of `customerDetailHref`. */
 memberDetailHref?: (customerId: string) => string;
 /** Session role — used for application deep links after apply. */
 role?: UserRole | null;
};

export function GroupMembersPanel({
 groupId,
 group,
 onChanged,
 memberOutstanding = null,
 readOnly = false,
 customerDetailHref = (id) => `/customers/${id}`,
 memberDetailHref,
 role = null,
}: Props) {
 const memberHref = memberDetailHref ?? customerDetailHref;
 const [addMemberOpen, setAddMemberOpen] = useState(false);
 const [applyMember, setApplyMember] = useState<GroupMemberApplyTarget | null>(null);
 const [searchQuery, setSearchQuery] = useState("");
 // The backend's `/customers?q=` filter is unreliable — it can return zero matches for a
 // customer that plainly exists (confirmed: an unscoped, unfiltered search for a real customer's
 // name still came back empty). So, like the main Customers list page, we fetch the branch's
 // customers once (no `q`) and filter client-side instead of trusting the backend search.
 const [branchCustomers, setBranchCustomers] = useState<Customer[]>([]);
 const [searching, setSearching] = useState(false);
 const [searchError, setSearchError] = useState("");
 const [actionError, setActionError] = useState("");
 const [assigningId, setAssigningId] = useState<string | null>(null);
 const [removingId, setRemovingId] = useState<string | null>(null);
 const [roleSelections, setRoleSelections] = useState<Record<string, AssignableRole>>({});

 const roleForCustomer = useCallback(
 (customerId: string) => roleSelections[customerId] ?? "member",
 [roleSelections]
 );

 /** Name of whoever currently holds a leadership role, if anyone (for a "will replace" hint). */
 const currentHolderName = useCallback(
 (role: Exclude<AssignableRole, "member">) => {
 const holderId = group[LEADERSHIP_FIELD_BY_ROLE[role]] as string | undefined;
 if (!holderId?.trim()) return null;
 return group.members.find((m) => m.customerId === holderId.trim())?.customerName ?? null;
 },
 [group]
 );

 const memberIds = useMemo(
 () => new Set(group.members.map((m) => m.customerId)),
 [group.members]
 );

 const loadBranchCustomers = useCallback(async () => {
 setSearching(true);
 setSearchError("");
 try {
 const params = new URLSearchParams({ is_active: "true", page_size: "200" });
 if (group.branch_id) params.set("branch_id", group.branch_id);

 const res = await fetch(`/api/customers?${params.toString()}`, { credentials: "include" });
 const json = (await res.json()) as unknown;
 if (!res.ok) {
 const o = json as { message?: string };
 setSearchError(o.message ?? "Could not load customers");
 setBranchCustomers([]);
 return;
 }

 setBranchCustomers(extractCustomersList(json));
 } catch {
 setSearchError("Could not load customers");
 setBranchCustomers([]);
 } finally {
 setSearching(false);
 }
 }, [group.branch_id]);

 useEffect(() => {
 if (!addMemberOpen) return;
 void loadBranchCustomers();
 }, [addMemberOpen, loadBranchCustomers]);

 const searchResults = useMemo(() => {
 const q = searchQuery.trim().toLowerCase();
 if (q.length < 2) return [];
 const digits = searchQuery.replace(/\D/g, "");

 return branchCustomers.filter((c) => {
 if (memberIds.has(c.id)) return false;
 const fullName = [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ").toLowerCase();
 const matchesText =
 fullName.includes(q) ||
 (c.customer_number ?? "").toLowerCase().includes(q) ||
 (c.national_id ?? "").toLowerCase().includes(q);
 const matchesPhone = digits.length >= 3 && (c.phone_primary ?? "").includes(digits);
 return matchesText || matchesPhone;
 });
 }, [branchCustomers, searchQuery, memberIds]);

 const searchErrorMessage =
 searchError ||
 (!searching && searchQuery.trim().length >= 2 && searchResults.length === 0
 ? "No matching customers in this branch, or they are already members."
 : "");

 const assignMember = async (customer: Customer) => {
 const role = roleForCustomer(customer.id);
 setActionError("");
 setAssigningId(customer.id);
 try {
 const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/members`, {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(buildAddGroupMemberBody(customer.id)),
 });
 const json = (await res.json()) as {
 message?: string;
 details?: { field?: string; message?: string }[];
 };
 if (!res.ok) {
 const detailText = formatValidationDetails(json.details);
 setActionError(detailText || json.message || "Could not add member");
 return;
 }

 if (role !== "member") {
 const leadershipRes = await fetch(`/api/groups/${encodeURIComponent(groupId)}`, {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ [LEADERSHIP_FIELD_BY_ROLE[role]]: customer.id }),
 });
 if (!leadershipRes.ok) {
 const leadershipJson = (await leadershipRes.json().catch(() => ({}))) as {
 message?: string;
 details?: { field?: string; message?: string }[];
 };
 const detailText = formatValidationDetails(leadershipJson.details);
 setActionError(
 `${customer.first_name} ${customer.last_name} was added, but could not be set as ${role}: ${
 detailText || leadershipJson.message || "unknown error"
 }`
 );
 await onChanged();
 return;
 }
 }

 setSearchQuery("");
 setRoleSelections((prev) => {
 const next = { ...prev };
 delete next[customer.id];
 return next;
 });
 setAddMemberOpen(false);
 await onChanged();
 } catch {
 setActionError("Could not add member");
 } finally {
 setAssigningId(null);
 }
 };

 const handleAddMemberOpenChange = (open: boolean) => {
 setAddMemberOpen(open);
 if (!open) {
 setSearchQuery("");
 setSearchError("");
 setActionError("");
 setRoleSelections({});
 }
 };

 const removeMember = async (customerId: string) => {
 if (isChairpersonMember(customerId, group)) {
 setActionError("The chairperson cannot be removed. Assign a new chairperson first.");
 return;
 }
 setActionError("");
 setRemovingId(customerId);
 try {
 const res = await fetch(
 `/api/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(customerId)}`,
 { method: "DELETE", credentials: "include" }
 );
 const json = (await res.json()) as { message?: string };
 if (!res.ok) {
 setActionError(json.message ?? "Could not remove member");
 return;
 }
 await onChanged();
 } catch {
 setActionError("Could not remove member");
 } finally {
 setRemovingId(null);
 }
 };

 return (
 <div className="space-y-6">
 {!readOnly ? (
 <Dialog open={addMemberOpen} onOpenChange={handleAddMemberOpenChange}>
 <DialogContent className="sm:max-w-2xl">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <Search className="h-4 w-4" />
 Add member
 </DialogTitle>
 <DialogDescription>
 Search customers by name, customer number, phone, or national ID. Only active
 customers from this vikundi&apos;s branch can be added.
 </DialogDescription>
 </DialogHeader>
 <div className="space-y-4">
 <div className="relative max-w-xl">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 autoFocus
 className="pl-9"
 placeholder="Search by name, phone, or customer number…"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 />
 </div>
 {searching ? (
 <p className="flex items-center gap-2 text-sm text-muted-foreground">
 <Loader2 className="h-4 w-4 animate-spin" />
 Loading customers…
 </p>
 ) : null}
 {!searching && searchErrorMessage ? (
 <p className="text-sm text-muted-foreground">{searchErrorMessage}</p>
 ) : null}
 {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 ? (
 <p className="text-sm text-muted-foreground">Type at least 2 characters to search.</p>
 ) : null}
 {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}

 {searchResults.length > 0 ? (
 <div className="max-h-[360px] overflow-y-auto rounded-lg border">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Customer</TableHead>
 <TableHead>Phone</TableHead>
 <TableHead>Risk</TableHead>
 <TableHead>Role</TableHead>
 <TableHead className="text-right">Action</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {searchResults.map((customer) => {
 const selectedRole = roleForCustomer(customer.id);
 const replacing =
 selectedRole !== "member" ? currentHolderName(selectedRole) : null;
 return (
 <TableRow key={customer.id}>
 <TableCell>
 <p className="font-medium">
 {customer.first_name} {customer.last_name}
 </p>
 <p className="font-mono text-xs text-muted-foreground">{customer.customer_number}</p>
 </TableCell>
 <TableCell className="text-sm">{customer.phone_primary || "—"}</TableCell>
 <TableCell>
 <Badge variant={riskVariant[customer.risk_grade]}>{customer.risk_grade}</Badge>
 </TableCell>
 <TableCell>
 <Select
 value={selectedRole}
 onValueChange={(value) =>
 setRoleSelections((prev) => ({ ...prev, [customer.id]: value as AssignableRole }))
 }
 >
 <SelectTrigger size="sm" className="w-[130px]">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {GROUP_ROLE_OPTIONS.map((option) => (
 <SelectItem key={option.value} value={option.value}>
 {option.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 {replacing ? (
 <p className="mt-1 text-[11px] text-muted-foreground">Replaces {replacing}</p>
 ) : null}
 </TableCell>
 <TableCell className="text-right">
 <Button
 type="button"
 size="sm"
 disabled={assigningId === customer.id}
 onClick={() => void assignMember(customer)}
 >
 {assigningId === customer.id ? (
 <Loader2 className="h-4 w-4 animate-spin" />
 ) : (
 <>
 <UserPlus className="mr-1 h-4 w-4" />
 Assign
 </>
 )}
 </Button>
 </TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </div>
 ) : null}
 </div>
 </DialogContent>
 </Dialog>
 ) : null}

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Users className="h-5 w-5" />
 Assigned members
 </CardTitle>
 <CardDescription>
 {group.members.length} active member{group.members.length === 1 ? "" : "s"} on this vikundi.
 Each member can apply for their own loan amount.
 </CardDescription>
 {!readOnly ? (
 <CardAction>
 <Button type="button" size="sm" onClick={() => setAddMemberOpen(true)}>
 <UserPlus className="mr-1.5 h-4 w-4" />
 Add member
 </Button>
 </CardAction>
 ) : null}
 </CardHeader>
 <CardContent className="space-y-4 p-0 sm:p-6">
 <div className="grid gap-3 p-4 sm:hidden">
 {group.members.length === 0 ? (
 <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
 {readOnly
 ? "No members on this vikundi."
 : "No members yet. Use the search above to assign customers to this vikundi."}
 </p>
 ) : (
 group.members.map((member) => {
 const leadership = leadershipRoleForCustomer(member.customerId, group);
 const displayRole = leadership ?? member.role ?? "Member";
 const owed = memberOutstanding?.[member.customerId];

 return (
 <div
 key={member.customerId}
 className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3"
 >
 <div className="flex items-start justify-between gap-2">
 <div className="min-w-0">
 {readOnly ? (
 <Link
 href={memberHref(member.customerId)}
 className="font-medium leading-snug text-primary hover:underline"
 >
 {member.customerName}
 </Link>
 ) : (
 <p className="font-medium leading-snug">{member.customerName}</p>
 )}
 {member.nationalId ? (
 <p className="text-xs text-muted-foreground">ID: {member.nationalId}</p>
 ) : null}
 <p className="font-mono text-xs text-muted-foreground">
 {member.customerNumber || "—"}
 </p>
 </div>
 <div className="flex shrink-0 flex-col items-end gap-1">
 {member.riskGrade ? (
 <Badge variant={riskVariant[member.riskGrade as RiskGrade] ?? "outline"}>
 {member.riskGrade}
 </Badge>
 ) : null}
 <Badge variant={leadership ? "default" : "secondary"} className="capitalize">
 {displayRole}
 </Badge>
 </div>
 </div>

 <p className="mt-2 text-sm text-muted-foreground">{member.phone || "—"}</p>

 <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
 <div>
 <p className="text-xs text-muted-foreground">Amount owed</p>
 <p className="font-semibold tabular-nums">
 {owed == null ? (
 "—"
 ) : owed > 0 ? (
 <span className="text-destructive">{formatCurrency(owed)}</span>
 ) : (
 formatCurrency(0)
 )}
 </p>
 </div>
 <div>
 <p className="text-xs text-muted-foreground">Monthly income</p>
 <p className="font-semibold tabular-nums">
 {member.monthlyIncome != null ? formatCurrency(member.monthlyIncome) : "—"}
 </p>
 </div>
 </div>

 <div className="mt-3 flex justify-end">
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button
 type="button"
 size="sm"
 variant="outline"
 className="h-8"
 disabled={removingId === member.customerId}
 >
 {removingId === member.customerId ? (
 <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
 ) : (
 <MoreHorizontal className="mr-1 h-3.5 w-3.5" />
 )}
 Actions
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-44">
 <DropdownMenuItem
 onClick={() =>
 setApplyMember({
 customerId: member.customerId,
 customerName: member.customerName,
 })
 }
 >
 <Wallet className="mr-2 h-4 w-4" />
 Apply for loan
 </DropdownMenuItem>
 <DropdownMenuItem asChild>
 <Link href={memberHref(member.customerId)}>
 <Eye className="mr-2 h-4 w-4" />
 View
 </Link>
 </DropdownMenuItem>
 {!readOnly && !isChairpersonMember(member.customerId, group) ? (
 <>
 <DropdownMenuSeparator />
 <DropdownMenuItem
 className="text-destructive focus:text-destructive"
 disabled={removingId === member.customerId}
 onClick={() => void removeMember(member.customerId)}
 >
 <UserMinus className="mr-2 h-4 w-4" />
 Remove
 </DropdownMenuItem>
 </>
 ) : null}
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </div>
 );
 })
 )}
 </div>

 <div className="hidden sm:block">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Member</TableHead>
 <TableHead>Customer #</TableHead>
 <TableHead>Phone</TableHead>
 <TableHead>Risk</TableHead>
 <TableHead>Role</TableHead>
 <TableHead className="text-right">Amount owed</TableHead>
 <TableHead className="text-right">Monthly income</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {group.members.length === 0 ? (
 <TableRow>
 <TableCell
 colSpan={8}
 className="py-8 text-center text-muted-foreground"
 >
 {readOnly
 ? "No members on this vikundi."
 : "No members yet. Use the search above to assign customers to this vikundi."}
 </TableCell>
 </TableRow>
 ) : (
 group.members.map((member) => {
 const leadership = leadershipRoleForCustomer(member.customerId, group);
 const displayRole = leadership ?? member.role ?? "Member";
 const owed = memberOutstanding?.[member.customerId];
 return (
 <TableRow key={member.customerId}>
 <TableCell>
 {readOnly ? (
 <Link
 href={memberHref(member.customerId)}
 className="font-medium text-primary hover:underline"
 >
 {member.customerName}
 </Link>
 ) : (
 <p className="font-medium">{member.customerName}</p>
 )}
 {member.nationalId ? (
 <p className="text-xs text-muted-foreground">ID: {member.nationalId}</p>
 ) : null}
 </TableCell>
 <TableCell className="font-mono text-xs">{member.customerNumber || "—"}</TableCell>
 <TableCell className="text-sm">{member.phone || "—"}</TableCell>
 <TableCell>
 {member.riskGrade ? (
 <Badge variant={riskVariant[member.riskGrade as RiskGrade] ?? "outline"}>
 {member.riskGrade}
 </Badge>
 ) : (
 "—"
 )}
 </TableCell>
 <TableCell>
 <Badge variant={leadership ? "default" : "secondary"} className="capitalize">
 {displayRole}
 </Badge>
 </TableCell>
 <TableCell className="text-right font-medium tabular-nums">
 {owed == null ? (
 "—"
 ) : owed > 0 ? (
 <span className="text-destructive">{formatCurrency(owed)}</span>
 ) : (
 formatCurrency(0)
 )}
 </TableCell>
 <TableCell className="text-right">
 {member.monthlyIncome != null ? formatCurrency(member.monthlyIncome) : "—"}
 </TableCell>
 <TableCell className="text-right">
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button
 type="button"
 size="sm"
 variant="outline"
 className="h-8"
 disabled={removingId === member.customerId}
 >
 {removingId === member.customerId ? (
 <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
 ) : (
 <MoreHorizontal className="mr-1 h-3.5 w-3.5" />
 )}
 Actions
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-44">
 <DropdownMenuItem
 onClick={() =>
 setApplyMember({
 customerId: member.customerId,
 customerName: member.customerName,
 })
 }
 >
 <Wallet className="mr-2 h-4 w-4" />
 Apply for loan
 </DropdownMenuItem>
 <DropdownMenuItem asChild>
 <Link href={memberHref(member.customerId)}>
 <Eye className="mr-2 h-4 w-4" />
 View
 </Link>
 </DropdownMenuItem>
 {!readOnly && !isChairpersonMember(member.customerId, group) ? (
 <>
 <DropdownMenuSeparator />
 <DropdownMenuItem
 className="text-destructive focus:text-destructive"
 disabled={removingId === member.customerId}
 onClick={() => void removeMember(member.customerId)}
 >
 <UserMinus className="mr-2 h-4 w-4" />
 Remove
 </DropdownMenuItem>
 </>
 ) : null}
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

 <GroupMemberApplyLoanDialog
 open={Boolean(applyMember)}
 onOpenChange={(open) => {
 if (!open) setApplyMember(null);
 }}
 groupId={groupId}
 groupName={group.group_name}
 member={applyMember}
 role={role}
 />
 </div>
 );
}
