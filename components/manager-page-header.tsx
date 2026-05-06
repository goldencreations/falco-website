"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

export function ManagerPageHeader({
  title,
  description,
  branchLabel,
}: {
  title: string;
  description?: string;
  branchLabel: string;
}) {
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
      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
        {branchLabel}
      </Badge>
    </header>
  );
}
