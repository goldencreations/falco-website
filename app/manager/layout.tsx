import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BranchAssignmentProvider } from "@/components/branch-assignment-context";
import { ManagerSidebar } from "@/components/manager-sidebar";
import { getServerSessionUser } from "@/lib/auth";
import { fetchBranchesForSessionUser } from "@/lib/branch-summary-fallback";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
 const user = await getServerSessionUser();
 if (!user) redirect("/");
 if (user.role !== "branch_manager") redirect("/dashboard");

 const branches = user.branch_id ? await fetchBranchesForSessionUser(user) : [];
 const branch = branches.find((b) => b.id === user.branch_id);
 const branchLabel = branch?.name ?? (user.branch_id ? `Branch ${user.branch_id}` : "Branch");

 return (
 <BranchAssignmentProvider>
 <SidebarProvider>
 <ManagerSidebar user={user} branchLabel={branchLabel} />
 <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</SidebarInset>
 </SidebarProvider>
 </BranchAssignmentProvider>
 );
}
