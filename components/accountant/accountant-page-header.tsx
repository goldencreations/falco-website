"use client";

import { RefreshCcw } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/use-translations";
import { useBranchDisplayName } from "@/lib/use-branch-display-name";
import { isPlaceholderBranchName } from "@/lib/branch-display-name";

export function AccountantPageHeader({
 branchLabel,
 onRefresh,
 refreshing,
}: {
 branchLabel?: string;
 onRefresh: () => void;
 refreshing?: boolean;
}) {
 const { t } = useTranslations();
 const resolvedBranchLabel = useBranchDisplayName();
 const override =
  branchLabel?.trim() && !isPlaceholderBranchName(branchLabel) ? branchLabel.trim() : undefined;
 const label = override || resolvedBranchLabel || t("common.branch");

 return (
 <header className="flex h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 lg:px-6">
 <div className="flex items-center gap-4">
 <SidebarTrigger className="-ml-2" />
 <div className="hidden h-6 w-px bg-border lg:block" />
 <div>
 <h1 className="text-lg font-bold text-foreground">{t("accountant.dashboardTitle")}</h1>
 <p className="text-sm text-muted-foreground">
 {t("accountant.financeOverview", { branch: label })}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
 {label}
 </Badge>
 <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
 <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
 {t("accountant.refresh")}
 </Button>
 </div>
 </header>
 );
}
