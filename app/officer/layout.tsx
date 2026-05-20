import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BranchAssignmentProvider } from "@/components/branch-assignment-context";
import { OfficerSidebar } from "@/components/officer-sidebar";
import { getServerSessionUser } from "@/lib/auth";
import { fetchBranchesForSessionUser } from "@/lib/branch-summary-fallback";

export default async function OfficerLayout({ children }: { children: React.ReactNode }) {
 const user = await getServerSessionUser();
 if (!user) redirect("/");
 if (user.role !== "loan_officer") {
 redirect(user.role === "branch_manager" ? "/manager/dashboard" : "/dashboard");
 }

 const branches = user.branch_id ? await fetchBranchesForSessionUser(user) : [];
 const branch = branches.find((b) => b.id === user.branch_id);
 const branchLabel = branch?.name ?? (user.branch_id ? `Branch ${user.branch_id}` : "Branch");

 return (
 <BranchAssignmentProvider>
 <SidebarProvider>
 <OfficerSidebar user={user} branchLabel={branchLabel} />
 <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</SidebarInset>
 </SidebarProvider>
 </BranchAssignmentProvider>
 );
}
