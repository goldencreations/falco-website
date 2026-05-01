import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { BranchAssignmentProvider } from "@/components/branch-assignment-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BranchAssignmentProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col">{children}</SidebarInset>
      </SidebarProvider>
    </BranchAssignmentProvider>
  );
}
