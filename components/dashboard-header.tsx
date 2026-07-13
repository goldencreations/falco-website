"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { GlobalSearch } from "@/components/global-search";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import type { Branch } from "@/lib/types";
import { branchIdsMatch, knownBranchNameFromCode } from "@/lib/branch-scope";
import { useSessionUser } from "@/lib/use-session-user";

interface DashboardHeaderProps {
 title: string;
 description?: string;
}

export function DashboardHeader({ title, description }: DashboardHeaderProps) {
 const { user } = useSessionUser();
 const [branches, setBranches] = useState<Branch[]>([]);
 // Every role needs this (not just super_admin) to resolve their own branch's real name — the
 // backend session payload doesn't reliably include `branch_name`, and `/api/falco/branches`
 // scopes non-admins to their own branch, so it's safe and returns the actual name instead of
 // falling through to the `Branch {id}` placeholder below.
 const needsBranchLookup = Boolean(user?.branch_id?.trim());

 useEffect(() => {
 if (!needsBranchLookup) return;
 let cancelled = false;
 void fetch("/api/falco/branches", { credentials: "include" })
 .then((r) => {
 if (!r.ok) return null;
 return r.json() as Promise<{ branches?: Branch[] }>;
 })
 .then((d) => {
 if (!cancelled && d) setBranches(d.branches ?? []);
 })
 .catch(() => {});
 return () => {
 cancelled = true;
 };
 }, [needsBranchLookup]);

 const currentBranch = branches.find((b) => branchIdsMatch(b.id, user?.branch_id));
 const branchBadgeLabel =
 currentBranch?.name ??
 (user?.branch_name?.trim() ? user.branch_name.trim() : undefined) ??
 (user?.branch_id?.trim() ? knownBranchNameFromCode(user.branch_id.trim()) ?? undefined : undefined) ??
 (user?.branch_id?.trim() ? `Branch ${user.branch_id.trim()}` : undefined);

 return (
 <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
 <div className="flex items-center gap-4">
 <SidebarTrigger className="-ml-2" />
 <div className="hidden h-6 w-px bg-border lg:block" />
 <div className="hidden lg:block">
 <h1 className="text-lg font-bold text-foreground">{title}</h1>
 {description && (
 <p className="text-sm text-muted-foreground">{description}</p>
 )}
 </div>
 </div>

 <div className="flex items-center gap-3">
 <GlobalSearch className="hidden md:block" />

 {branchBadgeLabel ? (
 <Badge variant="outline" className="hidden text-xs lg:inline-flex gap-1.5 bg-primary/5 text-primary border-primary/20">
 <MapPin className="h-3 w-3" />
 {branchBadgeLabel}
 </Badge>
 ) : null}
 </div>
 </header>
 );
}
