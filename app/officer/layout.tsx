import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { OfficerSidebar } from "@/components/officer-sidebar";
import { getServerSessionUser } from "@/lib/auth";
import { getBranchById } from "@/lib/mock-data";

export default async function OfficerLayout({ children }: { children: React.ReactNode }) {
 const user = await getServerSessionUser();
 if (!user) redirect("/");
 if (user.role !== "loan_officer") {
 redirect(user.role === "branch_manager" ? "/manager/dashboard" : "/dashboard");
 }

 const branch = getBranchById(user.branch_id);
 const branchLabel = branch ? `${branch.name} (${branch.code})` : user.branch_id;

 return (
 <SidebarProvider>
 <OfficerSidebar user={user} branchLabel={branchLabel} />
 <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</SidebarInset>
 </SidebarProvider>
 );
}
