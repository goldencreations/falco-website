"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserCheck, Users, Loader2 } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { GroupMembersPanel } from "@/components/group-members-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBranchAssignment } from "@/components/branch-assignment-context";
import { extractGroupDetail, type GroupDetailView } from "@/lib/group-adapters";
import { extractCustomersList } from "@/lib/customer-adapters";
import { formatDate } from "@/lib/formatters";
import type { GroupMemberRow } from "@/lib/group-adapters";
import { resolvePortalHref } from "@/lib/portal-paths";
import { useSessionUser } from "@/lib/use-session-user";

export default function GroupDetailPage({
 params,
}: {
 params: Promise<{ id: string }>;
}) {
 const resolved = use(params);
 const { user } = useSessionUser();
 const groupsListHref = resolvePortalHref(user?.role, "/groups");
 const { users, branches } = useBranchAssignment();
 const [group, setGroup] = useState<GroupDetailView | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const loadGroup = useCallback(async (options?: { silent?: boolean }) => {
 if (!options?.silent) {
 setLoading(true);
 }
 setError(null);
 try {
 const res = await fetch(`/api/groups/${encodeURIComponent(resolved.id)}`, {
 credentials: "include",
 });
 const json = (await res.json()) as unknown;
 if (!res.ok) {
 const o = json as { message?: string };
 setError(o.message ?? "Group not found");
 setGroup(null);
 return;
 }
 const detail = extractGroupDetail(json);
 if (!detail) {
 setError("Group not found");
 setGroup(null);
 return;
 }

 const needsEnrichment = detail.members.some(
 (m) => !m.phone || !m.customerNumber || m.customerName === m.customerId
 );
 if (needsEnrichment && detail.branch_id) {
 try {
 const params = new URLSearchParams({
 branch_id: detail.branch_id,
 is_active: "true",
 page_size: "200",
 });
 const custRes = await fetch(`/api/customers?${params.toString()}`, {
 credentials: "include",
 });
 if (custRes.ok) {
 const custJson = (await custRes.json()) as unknown;
 const byId = new Map(extractCustomersList(custJson).map((c) => [c.id, c]));
 detail.members = detail.members.map((m): GroupMemberRow => {
 const c = byId.get(m.customerId);
 if (!c) return m;
 return {
 ...m,
 customerName: `${c.first_name} ${c.last_name}`.trim() || m.customerName,
 customerNumber: m.customerNumber || c.customer_number,
 phone: m.phone || c.phone_primary,
 nationalId: m.nationalId || c.national_id,
 riskGrade: m.riskGrade || c.risk_grade,
 monthlyIncome: m.monthlyIncome ?? c.monthly_income,
 };
 });
 }
 } catch {
 /* keep partial member rows */
 }
 }

 setGroup(detail);
 } catch {
 setError("Could not load group details.");
 setGroup(null);
 } finally {
 if (!options?.silent) {
 setLoading(false);
 }
 }
 }, [resolved.id]);

 useEffect(() => {
 void loadGroup();
 }, [loadGroup]);

 if (loading) {
 return (
 <>
 <DashboardHeader title="Kikundi" description="Loading group profile…" />
 <main className="flex-1 p-6 flex items-center justify-center gap-2 text-muted-foreground">
 <Loader2 className="h-5 w-5 animate-spin" />
 Loading…
 </main>
 </>
 );
 }

 if (!group || error) {
 return (
 <>
 <DashboardHeader title="Group Not Found" />
 <main className="flex-1 p-6 space-y-4">
 {error ? <p className="text-sm text-destructive">{error}</p> : null}
 <Button asChild>
 <Link href={groupsListHref}>Back to Vikundi</Link>
 </Button>
 </main>
 </>
 );
 }

 const officer = users.find((u) => u.id === group.loan_officer_id);
 const chairperson = group.members.find((m) => m.customerId === group.chairperson_customer_id);
 const secretary = group.members.find((m) => m.customerId === group.secretary_customer_id);
 const treasurer = group.members.find((m) => m.customerId === group.treasurer_customer_id);

 return (
 <>
 <DashboardHeader
 title={group.group_name}
 description="Kikundi profile, members, and group lending"
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-7xl space-y-6">
 <Button variant="ghost" size="sm" asChild>
 <Link href={groupsListHref}>
 <ArrowLeft className="mr-2 h-4 w-4" />
 Back to Vikundi
 </Link>
 </Button>

 <Card>
 <CardHeader>
 <CardTitle>Vikundi Details</CardTitle>
 </CardHeader>
 <CardContent className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2 text-sm">
 <p className="font-semibold">{group.group_name}</p>
 <p className="font-mono text-muted-foreground">{group.group_code || group.id}</p>
 <Badge variant={group.status === "active" ? "default" : "secondary"}>{group.status}</Badge>
 <p>Meeting day: {group.meeting_day}</p>
 <p>Meeting location: {group.meeting_location}</p>
 <p>Street/Village: {group.village_or_street}</p>
 </div>
 <div className="space-y-2 text-sm">
 <p className="flex items-center gap-2">
 <UserCheck className="h-4 w-4 text-muted-foreground" />
 Loan Officer: {officer?.full_name ?? "—"}
 </p>
 <p>Formation date: {formatDate(group.formation_date)}</p>
 <p>Chairperson: {chairperson?.customerName ?? "—"}</p>
 <p>Secretary: {secretary?.customerName ?? "—"}</p>
 <p>Treasurer: {treasurer?.customerName ?? "—"}</p>
 </div>
 </CardContent>
 </Card>

 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
 <Users className="h-4 w-4" />
 Members
 </CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">{group.members.length}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm text-muted-foreground">Branch</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-lg font-semibold">
 {branches.find((b) => b.id === group.branch_id)?.name ?? group.branch_id}
 </p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm text-muted-foreground">Registered</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-lg font-semibold">{formatDate(group.created_at)}</p>
 </CardContent>
 </Card>
 </div>

 <GroupMembersPanel
 groupId={resolved.id}
 group={group}
 readOnly={user?.role === "loan_officer"}
 customerDetailHref={(id) => resolvePortalHref(user?.role, `/customers/${id}`)}
 onChanged={() => loadGroup({ silent: true })}
 />

 {group.notes ? (
 <Card>
 <CardHeader>
 <CardTitle>Notes</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-sm text-muted-foreground">{group.notes}</p>
 </CardContent>
 </Card>
 ) : null}
 </div>
 </main>
 </>
 );
}
