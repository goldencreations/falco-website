"use client";

import Link from "next/link";
import { Filter } from "lucide-react";

import { useBranchAssignment } from "@/components/branch-assignment-context";
import { PortfolioChart } from "@/components/dashboard/portfolio-chart";
import { AgingChart } from "@/components/dashboard/aging-chart";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DashboardBranchScope } from "@/lib/dashboard-analytics";
import { useState } from "react";

export function DashboardChartsPanel() {
  const { branches } = useBranchAssignment();
  const [scope, setScope] = useState<DashboardBranchScope>("all");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">Analysis scope</span>
          </div>
          <Select
            value={scope}
            onValueChange={(v) => setScope(v as DashboardBranchScope)}
          >
            <SelectTrigger className="w-full min-w-0 sm:w-[min(100%,280px)] touch-manipulation">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches (platform)</SelectItem>
              {branches
                .filter((b) => b.is_active)
                .map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 touch-manipulation" asChild>
          <Link href="/reports">Full reports overview</Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-3 xl:items-stretch">
        <PortfolioChart branchScope={scope} />
        <AgingChart branchScope={scope} />
      </div>
    </div>
  );
}
