import {
  adaptApiCustomerRowToCustomer,
  extractCustomerDetail,
  extractCustomersList,
} from "@/lib/customer-adapters";
import type { GroupDetailView, GroupMemberRow } from "@/lib/group-adapters";
import { enrichGroupMembersWithCustomers } from "@/lib/group-adapters";
import type { Customer } from "@/lib/types";

function memberNeedsEnrichment(member: GroupMemberRow): boolean {
  return !member.customerName?.trim() || !member.customerNumber || !member.phone;
}

/** Client-side fallback when group members lack nested customer fields. */
export async function enrichGroupMembersOnClient(
  detail: GroupDetailView
): Promise<GroupDetailView> {
  if (!detail.members.some(memberNeedsEnrichment)) return detail;

  const customers: Customer[] = [];

  if (detail.branch_id) {
    try {
      const params = new URLSearchParams({
        branch_id: detail.branch_id,
        is_active: "true",
        page_size: "500",
      });
      const custRes = await fetch(`/api/customers?${params.toString()}`, {
        credentials: "include",
      });
      if (custRes.ok) {
        customers.push(...extractCustomersList((await custRes.json()) as unknown));
      }
    } catch {
      /* keep partial member rows */
    }
  }

  const foundIds = new Set(customers.map((customer) => customer.id.trim()));
  const missing = detail.members.filter((member) => !foundIds.has(member.customerId.trim()));
  if (missing.length > 0) {
    await Promise.all(
      missing.map(async (member) => {
        try {
          const res = await fetch(`/api/customers/${encodeURIComponent(member.customerId)}`, {
            credentials: "include",
          });
          if (!res.ok) return;
          const row = extractCustomerDetail((await res.json()) as unknown);
          if (!row) return;
          customers.push(adaptApiCustomerRowToCustomer(row));
        } catch {
          /* keep partial member rows */
        }
      })
    );
  }

  return enrichGroupMembersWithCustomers(detail, customers);
}
