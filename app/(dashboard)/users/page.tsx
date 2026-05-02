import { redirect } from "next/navigation";
import { currentUser } from "@/lib/mock-data";
import { StaffManagementPage } from "@/components/staff-management/staff-management-page";

export default function UsersPage() {
  if (currentUser.role !== "super_admin") {
    redirect("/dashboard");
  }
  return <StaffManagementPage />;
}
