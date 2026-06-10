"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, UserCheck, MapPin, Wallet, Plus, Loader2 } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from "@/components/ui/table";
import { useBranchAssignment } from "@/components/branch-assignment-context";
import { extractGroupsList } from "@/lib/group-adapters";
import { formatDate } from "@/lib/formatters";
import type { LoanGroup } from "@/lib/types";
import { resolvePortalHref } from "@/lib/portal-paths";
import { useSessionUser } from "@/lib/use-session-user";

export default function GroupsPage() {
 const { user } = useSessionUser();
 const { branches, users } = useBranchAssignment();
 const isOfficerView = user?.role === "loan_officer";
 const scopeBranchId =
 user?.role === "branch_manager" || isOfficerView ? user.branch_id : null;

 const [groups, setGroups] = useState<LoanGroup[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const loadGroups = useCallback(async () => {
 setLoading(true);
 setError(null);
 const params = new URLSearchParams({ page_size: "100" });
 if (scopeBranchId) params.set("branch_id", scopeBranchId);
 try {
 const res = await fetch(`/api/groups?${params.toString()}`, { credentials: "include" });
 const json = (await res.json()) as unknown;
 if (!res.ok) {
 const o = json as { message?: string };
 setError(o.message ?? "Failed to load groups");
 setGroups([]);
 return;
 }
 setGroups(extractGroupsList(json));
 } catch {
 setError("Could not load vikundi. Check your connection.");
 setGroups([]);
 } finally {
 setLoading(false);
 }
 }, [scopeBranchId]);

 useEffect(() => {
 void loadGroups();
 }, [loadGroups]);

 const visibleGroups = useMemo(() => {
 if (!scopeBranchId || user?.role !== "loan_officer") return groups;
 return groups.filter((g) => g.loan_officer_id === user.id);
 }, [groups, scopeBranchId, user]);

 const activeGroups = visibleGroups.filter((group) => group.status === "active").length;
 const totalMembers = visibleGroups.reduce((sum, group) => sum + group.member_customer_ids.length, 0);

 const officerName = (id: string) => users.find((u) => u.id === id)?.full_name ?? "—";
 const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";
 const groupsNewHref = resolvePortalHref(user?.role, "/groups/new");
 const groupDetailHref = (id: string) => resolvePortalHref(user?.role, `/groups/${id}`);

 return (
 <>
 <DashboardHeader
 title="Vikundi / Vikoba"
 description="Manage group-based lending, members, officers, and portfolio"
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-7xl space-y-6">
 <div className="flex justify-end">
 <Button asChild>
 <Link href={groupsNewHref}>
 <Plus className="mr-2 h-4 w-4" />
 Add New Kikundi
 </Link>
 </Button>
 </div>

 {error ? (
 <Card className="border-destructive/40 bg-destructive/5">
 <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
 </Card>
 ) : null}

 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm text-muted-foreground">Total Groups</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">{visibleGroups.length}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm text-muted-foreground">Active Groups</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">{activeGroups}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm text-muted-foreground">Total Members</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-2xl font-bold">{totalMembers}</p>
 </CardContent>
 </Card>
 <Card>
 <CardHeader className="pb-2">
 <CardTitle className="text-sm text-muted-foreground">Data source</CardTitle>
 </CardHeader>
 <CardContent>
 <p className="text-sm text-muted-foreground">Live LMS groups API</p>
 </CardContent>
 </Card>
 </div>

 <Card>
 <CardContent className="p-0">
 {loading ? (
 <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
 <Loader2 className="h-5 w-5 animate-spin" />
 Loading vikundi…
 </div>
 ) : (
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Group</TableHead>
 <TableHead>Loan Officer</TableHead>
 <TableHead>Branch</TableHead>
 <TableHead>Members</TableHead>
 <TableHead>Meeting</TableHead>
 <TableHead>Status</TableHead>
 <TableHead>Created</TableHead>
 <TableHead className="text-right">Action</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {visibleGroups.length === 0 ? (
 <TableRow>
 <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
 {isOfficerView
 ? 'No vikundi assigned to you yet. Click "Add New Kikundi" to register a group.'
 : 'No vikundi found. Click "Add New Kikundi" to register a group.'}
 </TableCell>
 </TableRow>
 ) : (
 visibleGroups.map((group) => (
 <TableRow key={group.id}>
 <TableCell>
 <div>
 <p className="font-medium">{group.group_name}</p>
 <p className="font-mono text-xs text-muted-foreground">{group.group_code || group.id}</p>
 </div>
 </TableCell>
 <TableCell>
 <div className="flex items-center gap-2">
 <UserCheck className="h-4 w-4 text-muted-foreground" />
 <span>{officerName(group.loan_officer_id)}</span>
 </div>
 </TableCell>
 <TableCell>{branchName(group.branch_id)}</TableCell>
 <TableCell>
 <div className="flex items-center gap-2">
 <Users className="h-4 w-4 text-muted-foreground" />
 <span>{group.member_customer_ids.length}</span>
 </div>
 </TableCell>
 <TableCell>
 <div className="text-sm">
 <p>{group.meeting_day}</p>
 <p className="flex items-center gap-1 text-xs text-muted-foreground">
 <MapPin className="h-3 w-3" />
 {group.meeting_location}
 </p>
 </div>
 </TableCell>
 <TableCell>
 <Badge variant={group.status === "active" ? "default" : "secondary"}>
 {group.status}
 </Badge>
 </TableCell>
 <TableCell>{formatDate(group.created_at)}</TableCell>
 <TableCell className="text-right">
 <Button size="sm" variant="outline" asChild>
 <Link href={groupDetailHref(group.id)}>
 <Wallet className="mr-2 h-4 w-4" />
 View Group
 </Link>
 </Button>
 </TableCell>
 </TableRow>
 ))
 )}
 </TableBody>
 </Table>
 )}
 </CardContent>
 </Card>
 </div>
 </main>
 </>
 );
}
