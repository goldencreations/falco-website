"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Loader2, Search, UserMinus, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from "@/components/ui/table";
import { extractCustomersList } from "@/lib/customer-adapters";
import { formatValidationDetails } from "@/lib/falco-api";
import type { GroupDetailView } from "@/lib/group-adapters";
import {
 buildAddGroupMemberBody,
 isLeadershipMember,
 leadershipRoleForCustomer,
} from "@/lib/group-members";
import { formatCurrency } from "@/lib/formatters";
import type { Customer, RiskGrade } from "@/lib/types";

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
};

export function GroupMembersPanel({
 groupId,
 group,
 onChanged,
 memberOutstanding = null,
 readOnly = false,
 customerDetailHref = (id) => `/customers/${id}`,
 memberDetailHref,
}: Props) {
 const memberHref = memberDetailHref ?? customerDetailHref;
 const [searchQuery, setSearchQuery] = useState("");
 const [searchResults, setSearchResults] = useState<Customer[]>([]);
 const [searching, setSearching] = useState(false);
 const [searchError, setSearchError] = useState("");
 const [actionError, setActionError] = useState("");
 const [assigningId, setAssigningId] = useState<string | null>(null);
 const [removingId, setRemovingId] = useState<string | null>(null);

 const memberIds = useMemo(
 () => new Set(group.members.map((m) => m.customerId)),
 [group.members]
 );

 const searchCustomers = useCallback(async () => {
 const q = searchQuery.trim();
 if (q.length < 2) {
 setSearchResults([]);
 setSearchError("");
 return;
 }

 setSearching(true);
 setSearchError("");
 try {
 const params = new URLSearchParams({
 q,
 is_active: "true",
 page_size: "25",
 });
 if (group.branch_id) params.set("branch_id", group.branch_id);

 const res = await fetch(`/api/customers?${params.toString()}`, { credentials: "include" });
 const json = (await res.json()) as unknown;
 if (!res.ok) {
 const o = json as { message?: string };
 setSearchError(o.message ?? "Could not search customers");
 setSearchResults([]);
 return;
 }

 const rows = extractCustomersList(json).filter((c) => !memberIds.has(c.id));
 setSearchResults(rows);
 if (!rows.length) {
 setSearchError("No matching customers in this branch, or they are already members.");
 }
 } catch {
 setSearchError("Could not search customers");
 setSearchResults([]);
 } finally {
 setSearching(false);
 }
 }, [searchQuery, group.branch_id, memberIds]);

 useEffect(() => {
 const timer = window.setTimeout(() => {
 void searchCustomers();
 }, 350);
 return () => window.clearTimeout(timer);
 }, [searchCustomers]);

 const assignMember = async (customer: Customer) => {
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
 setSearchQuery("");
 setSearchResults([]);
 await onChanged();
 } catch {
 setActionError("Could not add member");
 } finally {
 setAssigningId(null);
 }
 };

 const removeMember = async (customerId: string) => {
 if (isLeadershipMember(customerId, group)) {
 setActionError("Change leadership roles on the group before removing this person.");
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
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2 text-base">
 <Search className="h-4 w-4" />
 Assign member
 </CardTitle>
 <CardDescription>
 Search customers by name, customer number, phone, or national ID. Only active
 customers from this vikundi&apos;s branch can be added.
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="relative max-w-xl">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 className="pl-9"
 placeholder="Search by name, phone, or customer number…"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 />
 </div>
 {searching ? (
 <p className="flex items-center gap-2 text-sm text-muted-foreground">
 <Loader2 className="h-4 w-4 animate-spin" />
 Searching…
 </p>
 ) : null}
 {searchError && searchQuery.trim().length >= 2 ? (
 <p className="text-sm text-muted-foreground">{searchError}</p>
 ) : null}
 {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 ? (
 <p className="text-sm text-muted-foreground">Type at least 2 characters to search.</p>
 ) : null}
 {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}

 {searchResults.length > 0 ? (
 <div className="rounded-lg border">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Customer</TableHead>
 <TableHead>Phone</TableHead>
 <TableHead>Risk</TableHead>
 <TableHead className="text-right">Action</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {searchResults.map((customer) => (
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
 ))}
 </TableBody>
 </Table>
 </div>
 ) : null}
 </CardContent>
 </Card>
 ) : null}

 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Users className="h-5 w-5" />
 Assigned members
 </CardTitle>
 <CardDescription>
 {group.members.length} active member{group.members.length === 1 ? "" : "s"} on this vikundi.
 </CardDescription>
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

 <div className="mt-3 flex gap-2">
 <Button size="sm" variant="outline" className="h-8 flex-1" asChild>
 <Link href={memberHref(member.customerId)}>
 <Eye className="mr-1 h-3.5 w-3.5" />
 View Details
 </Link>
 </Button>
 {!readOnly && !isLeadershipMember(member.customerId, group) ? (
 <Button
 type="button"
 variant="outline"
 size="sm"
 className="h-8 text-destructive hover:text-destructive"
 disabled={removingId === member.customerId}
 onClick={() => void removeMember(member.customerId)}
 >
 {removingId === member.customerId ? (
 <Loader2 className="h-3.5 w-3.5 animate-spin" />
 ) : (
 <UserMinus className="h-3.5 w-3.5" />
 )}
 </Button>
 ) : null}
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
 <div className="flex justify-end gap-1">
 <Button
 variant={readOnly ? "outline" : "ghost"}
 size="sm"
 asChild
 >
 <Link href={memberHref(member.customerId)}>View</Link>
 </Button>
 {!readOnly && !isLeadershipMember(member.customerId, group) ? (
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="text-destructive hover:text-destructive"
 disabled={removingId === member.customerId}
 onClick={() => void removeMember(member.customerId)}
 >
 {removingId === member.customerId ? (
 <Loader2 className="h-4 w-4 animate-spin" />
 ) : (
 <>
 <UserMinus className="mr-1 h-4 w-4" />
 Remove
 </>
 )}
 </Button>
 ) : null}
 </div>
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
 </div>
 );
}
