import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ManagerSidebar } from "@/components/manager-sidebar";
import { getServerSessionUser } from "@/lib/auth";
import { getBranchById } from "@/lib/mock-data";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSessionUser();
  if (!user) redirect("/");
  if (user.role !== "branch_manager") redirect("/dashboard");

  const branch = getBranchById(user.branch_id);
  const branchLabel = branch ? `${branch.name} (${branch.code})` : user.branch_id;

  return (
    <SidebarProvider>
      <ManagerSidebar user={user} branchLabel={branchLabel} />
      <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</SidebarInset>
    </SidebarProvider>
  );
}
