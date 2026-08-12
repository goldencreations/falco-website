"use client";

import { MapPin } from "lucide-react";
import { GlobalSearch } from "@/components/global-search";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useBranchDisplayName } from "@/lib/use-branch-display-name";

interface DashboardHeaderProps {
 title: string;
 description?: string;
}

export function DashboardHeader({ title, description }: DashboardHeaderProps) {
 const branchBadgeLabel = useBranchDisplayName();

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
