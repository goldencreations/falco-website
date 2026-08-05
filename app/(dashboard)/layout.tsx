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
 <DashboardNavigationShell>
 {children}
 </DashboardNavigationShell>
 </SidebarProvider>
 </BranchAssignmentProvider>
 );
}
