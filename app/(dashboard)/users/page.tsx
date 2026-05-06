import { redirect } from "next/navigation";
import { getServerSessionUser } from "@/lib/auth";
import { StaffManagementPage } from "@/components/staff-management/staff-management-page";

export default async function UsersPage() {
  const user = await getServerSessionUser();
  if (!user || user.role !== "super_admin") {
    redirect("/dashboard");
  }
  return <StaffManagementPage />;
}
