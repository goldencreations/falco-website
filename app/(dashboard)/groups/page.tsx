"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, UserCheck, MapPin, Wallet, Plus, Loader2, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { formatApiResponseError } from "@/lib/falco-api";
import { canCreateGroups, canManageGroups } from "@/lib/group-access";
import { formatDate } from "@/lib/formatters";
import type { LoanGroup } from "@/lib/types";
import { resolvePortalHref } from "@/lib/portal-paths";
import { useSessionUser } from "@/lib/use-session-user";

export default function GroupsPage() {
  const { user } = useSessionUser();
  const { branches, users } = useBranchAssignment();
  const isOfficerView = user?.role === "loan_officer";
  const canCreate = user ? canCreateGroups(user) : false;
  const canManage = user ? canManageGroups(user) : false;
  const scopeBranchId =
    user?.role === "branch_manager" || isOfficerView ? user.branch_id : null;

  const [groups, setGroups] = useState<LoanGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LoanGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
  const totalMembers = visibleGroups.reduce(
    (sum, group) => sum + group.member_customer_ids.length,
    0
  );

  const officerName = (id: string) => users.find((u) => u.id === id)?.full_name ?? "—";
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "—";
  const groupsNewHref = resolvePortalHref(user?.role, "/groups/new");
  const groupDetailHref = (id: string) => resolvePortalHref(user?.role, `/groups/${id}`);

  const handleDeleteGroup = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    const id = deleteTarget.id;
    try {
      const res = await fetch(`/api/groups/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as unknown;
        setDeleteError(formatApiResponseError(json, "Could not delete this vikundi"));
        return;
      }
      setGroups((prev) => prev.filter((g) => g.id !== id));
      setDeleteTarget(null);
      toast.success("Vikundi deleted");
    } catch {
      setDeleteError("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DashboardHeader
        title="Vikundi / Vikoba"
        description="Manage group-based lending, members, officers, and portfolio"
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {canCreate ? (
            <div className="flex justify-end">
              <Button asChild>
                <Link href={groupsNewHref}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Kikundi
                </Link>
              </Button>
            </div>
          ) : null}

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
                <CardTitle className="text-sm text-muted-foreground">Group records</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Current saved groups</p>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden border-emerald-100">
            <CardContent className="space-y-4 p-0">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading vikundi…
                </div>
              ) : (
                <>
                  <div className="grid gap-3 p-4 sm:hidden">
                    {visibleGroups.length === 0 ? (
                      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                        {isOfficerView
                          ? 'No vikundi assigned to you yet. Click "Add New Kikundi" to register a group.'
                          : 'No vikundi found. Click "Add New Kikundi" to register a group.'}
                      </p>
                    ) : (
                      visibleGroups.map((group) => (
                        <div
                          key={group.id}
                          className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium leading-snug">{group.group_name}</p>
                              <p className="font-mono text-xs text-muted-foreground">
                                {group.group_code || group.id}
                              </p>
                            </div>
                            <Badge
                              variant={group.status === "active" ? "default" : "secondary"}
                              className="shrink-0 capitalize"
                            >
                              {group.status}
                            </Badge>
                          </div>

                          <div className="mt-3 space-y-1.5 text-sm">
                            <p className="flex items-center gap-1.5">
                              <UserCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span className="truncate">
                                Officer:{" "}
                                <span className="font-medium">
                                  {officerName(group.loan_officer_id)}
                                </span>
                              </span>
                            </p>
                            <p className="text-muted-foreground">
                              Branch:{" "}
                              <span className="font-medium text-foreground">
                                {branchName(group.branch_id)}
                              </span>
                            </p>
                            <p className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span>{group.member_customer_ids.length} member(s)</span>
                            </p>
                          </div>

                          <div className="mt-3 text-sm">
                            <p className="font-medium">{group.meeting_day}</p>
                            <p className="mt-0.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span className="line-clamp-2">{group.meeting_location}</span>
                            </p>
                          </div>

                          <p className="mt-3 text-xs text-muted-foreground">
                            Created {formatDate(group.created_at)}
                          </p>

                          <div className="mt-3 flex flex-col gap-2">
                            <Button size="sm" variant="outline" className="h-8 w-full" asChild>
                              <Link href={groupDetailHref(group.id)}>
                                <Eye className="mr-1 h-3.5 w-3.5" />
                                View Details
                              </Link>
                            </Button>
                            {canManage ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 w-full text-destructive hover:text-destructive"
                                onClick={() => {
                                  setDeleteError("");
                                  setDeleteTarget(group);
                                }}
                              >
                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                                Delete
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="hidden sm:block">
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
                            <TableCell
                              colSpan={8}
                              className="py-10 text-center text-muted-foreground"
                            >
                              {isOfficerView && canCreate
                                ? 'No vikundi assigned to you yet. Click "Add New Kikundi" to register a group.'
                                : canCreate
                                  ? 'No vikundi found. Click "Add New Kikundi" to register a group.'
                                  : "No vikundi found."}
                            </TableCell>
                          </TableRow>
                        ) : (
                          visibleGroups.map((group) => (
                            <TableRow key={group.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{group.group_name}</p>
                                  <p className="font-mono text-xs text-muted-foreground">
                                    {group.group_code || group.id}
                                  </p>
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
                                <Badge
                                  variant={group.status === "active" ? "default" : "secondary"}
                                >
                                  {group.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatDate(group.created_at)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button size="sm" variant="outline" asChild>
                                    <Link href={groupDetailHref(group.id)}>
                                      <Wallet className="mr-2 h-4 w-4" />
                                      View Group
                                    </Link>
                                  </Button>
                                  {canManage ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive hover:text-destructive"
                                      onClick={() => {
                                        setDeleteError("");
                                        setDeleteTarget(group);
                                      }}
                                      aria-label={`Delete ${group.group_name}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  ) : null}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!deleting && !open) {
            setDeleteTarget(null);
            setDeleteError("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete vikundi?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  This permanently deletes{" "}
                  <span className="font-medium text-foreground">{deleteTarget?.group_name}</span>
                  {deleteTarget ? (
                    <>
                      {" "}
                      (
                      <span className="font-mono text-xs">
                        {deleteTarget.group_code || deleteTarget.id}
                      </span>
                      )
                    </>
                  ) : null}
                  . Existing member loan records may remain.
                </p>
                {deleteError ? <p className="text-destructive">{deleteError}</p> : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting || !deleteTarget}
              onClick={() => void handleDeleteGroup()}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
