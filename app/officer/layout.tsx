import { redirect } from "next/navigation";
import { DashboardNavigationShell } from "@/components/dashboard-navigation-shell";
import { SidebarProvider } from "@/components/ui/sidebar";
import { BranchAssignmentProvider } from "@/components/branch-assignment-context";
import { OfficerPortalGate } from "@/components/officer-portal-gate";
import { OfficerSessionProvider } from "@/components/officer-session-context";
import { OfficerSidebar } from "@/components/officer-sidebar";
import { getServerSessionUser } from "@/lib/auth";
import { loginRedirectForRole } from "@/lib/role-portal";

export default async function OfficerLayout({ children }: { children: React.ReactNode }) {
 const user = await getServerSessionUser();
 if (!user) redirect("/?logged_out=1");
 if (user.role !== "loan_officer") {
 redirect(loginRedirectForRole(user.role));
 }

 const branchLabel = user.branch_id ? "Your branch" : "Branch";

 return (
 <BranchAssignmentProvider mode="light" sessionUser={user}>
 <SidebarProvider>
 <DashboardNavigationShell sidebar={<OfficerSidebar user={user} branchLabel={branchLabel} />}>
 <OfficerSessionProvider user={user}>
 <OfficerPortalGate>{children}</OfficerPortalGate>
 </OfficerSessionProvider>
 </DashboardNavigationShell>
 </SidebarProvider>
 </BranchAssignmentProvider>
 );
}
