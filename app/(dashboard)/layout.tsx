import { Suspense } from "react";
import { DashboardNavigationShell } from "@/components/dashboard-navigation-shell";
import { SidebarProvider } from "@/components/ui/sidebar";
import { BranchAssignmentProvider } from "@/components/branch-assignment-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BranchAssignmentProvider>
      <SidebarProvider>
        <Suspense fallback={null}>
          <DashboardNavigationShell>{children}</DashboardNavigationShell>
        </Suspense>
      </SidebarProvider>
    </BranchAssignmentProvider>
  );
}
