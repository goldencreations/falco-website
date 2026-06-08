import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BranchAssignmentProvider } from "@/components/branch-assignment-context";
import { ManagerSidebar } from "@/components/manager-sidebar";
import { getServerSessionUser } from "@/lib/auth";
import { loginRedirectForRole } from "@/lib/role-portal";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
 const user = await getServerSessionUser();
 if (!user) redirect("/?logged_out=1");
 if (user.role !== "branch_manager") redirect(loginRedirectForRole(user.role));

 const branchLabel = user.branch_id ? "Your branch" : "Branch";

 return (
 <BranchAssignmentProvider mode="light" sessionUser={user}>
 <SidebarProvider>
 <ManagerSidebar user={user} branchLabel={branchLabel} />
 <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</SidebarInset>
 </SidebarProvider>
 </BranchAssignmentProvider>
 );
}
