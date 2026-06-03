import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AccountantSidebar } from "@/components/accountant-sidebar";
import { BranchAssignmentProvider } from "@/components/branch-assignment-context";
import { getServerSessionUser } from "@/lib/auth";
import { loginRedirectForRole } from "@/lib/role-portal";

export default async function AccountantLayout({ children }: { children: React.ReactNode }) {
 const user = await getServerSessionUser();
 if (!user) redirect("/");
 if (user.role !== "accountant") {
 redirect(loginRedirectForRole(user.role));
 }

 const branchLabel = user.branch_id ? "Your branch" : "Branch";

 return (
 <BranchAssignmentProvider mode="light" sessionUser={user}>
 <SidebarProvider>
 <AccountantSidebar user={user} branchLabel={branchLabel} />
 <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</SidebarInset>
 </SidebarProvider>
 </BranchAssignmentProvider>
 );
}
