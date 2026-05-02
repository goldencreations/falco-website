import { NextResponse } from "next/server";
import { currentUser } from "@/lib/mock-data";
import { getCustomersWithAssignments, setCustomerLoanOfficer } from "@/lib/mock-customer-assignment";
import { getDirectoryUserById } from "@/lib/mock-user-directory";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: customerId } = await context.params;
  if (currentUser.role !== "branch_manager" && currentUser.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { assigned_loan_officer_id?: string };
  if (!body.assigned_loan_officer_id) {
    return NextResponse.json({ error: "assigned_loan_officer_id required" }, { status: 400 });
  }

  const officer = getDirectoryUserById(body.assigned_loan_officer_id);
  if (!officer) {
    return NextResponse.json({ error: "Officer not found" }, { status: 404 });
  }
  if (officer.role !== "loan_officer") {
    return NextResponse.json({ error: "Target must be a loan officer" }, { status: 400 });
  }

  const customers = getCustomersWithAssignments();
  const customer = customers.find((c) => c.id === customerId);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  if (currentUser.role === "branch_manager") {
    if (customer.branch_id !== currentUser.branch_id) {
      return NextResponse.json({ error: "Customer not in your branch" }, { status: 403 });
    }
    if (officer.branch_id !== currentUser.branch_id) {
      return NextResponse.json({ error: "Officer not in your branch" }, { status: 403 });
    }
  }

  setCustomerLoanOfficer(customerId, body.assigned_loan_officer_id);

  const updated = getCustomersWithAssignments().find((c) => c.id === customerId);
  return NextResponse.json({ customer: updated });
}
