/**
 * Runtime overrides for customer → loan officer assignment (mock API persistence).
 */

import { customers } from "@/lib/mock-data";
import type { Customer } from "@/lib/types";

const assignedByCustomerId = new Map<string, string>();

export function getCustomersWithAssignments(): Customer[] {
  return customers.map((c) => ({
    ...c,
    assigned_loan_officer_id:
      assignedByCustomerId.get(c.id) ?? c.assigned_loan_officer_id ?? c.created_by,
  }));
}

export function setCustomerLoanOfficer(customerId: string, officerUserId: string): void {
  assignedByCustomerId.set(customerId, officerUserId);
}

export function getAssignmentOverride(customerId: string): string | undefined {
  return assignedByCustomerId.get(customerId);
}
