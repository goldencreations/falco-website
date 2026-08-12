"use client";

import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useBranchDisplayName } from "@/lib/use-branch-display-name";
import { isPlaceholderBranchName } from "@/lib/branch-display-name";

export function OfficerPageHeader({
 title,
 description,
 branchLabel,
}: {
 title: string;
 description?: string;
 /** Optional override; otherwise resolved from session + branch API. */
 branchLabel?: string;
}) {
 const resolvedBranchLabel = useBranchDisplayName();
 const override =
  branchLabel?.trim() && !isPlaceholderBranchName(branchLabel) ? branchLabel.trim() : undefined;
 const label = override || resolvedBranchLabel;

 return (
 <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
 <div className="flex items-center gap-4">
 <SidebarTrigger className="-ml-2" />
 <div className="hidden h-6 w-px bg-border lg:block" />
 <div>
 <h1 className="text-lg font-bold text-foreground">{title}</h1>
 {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
 </div>
 </div>
 {label ? (
 <Badge variant="outline" className="gap-1.5 border-blue-200 bg-blue-50 text-blue-700">
 <MapPin className="h-3 w-3" />
 {label}
 </Badge>
 ) : null}
 </header>
 );
}
