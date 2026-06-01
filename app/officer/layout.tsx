import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BranchAssignmentProvider } from "@/components/branch-assignment-context";
import { OfficerPortalGate } from "@/components/officer-portal-gate";
import { OfficerSidebar } from "@/components/officer-sidebar";
import { getServerSessionUser } from "@/lib/auth";
import { loginRedirectForRole } from "@/lib/role-portal";

export default async function OfficerLayout({ children }: { children: React.ReactNode }) {
 const user = await getServerSessionUser();
 if (!user) redirect("/");
 if (user.role !== "loan_officer") {
 redirect(loginRedirectForRole(user.role));
 }

 const branchLabel = user.branch_id ? "Your branch" : "Branch";

 return (
 <BranchAssignmentProvider mode="light">
 <SidebarProvider>
 <OfficerSidebar user={user} branchLabel={branchLabel} />
 <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">
 <OfficerPortalGate>{children}</OfficerPortalGate>
 </SidebarInset>
 </SidebarProvider>
 </BranchAssignmentProvider>
 );
}
