import type { LoanGroup } from "@/lib/types";

/** Leadership label for a customer on a vikundi, if any. */
export function leadershipRoleForCustomer(
 customerId: string,
 group: Pick<
  LoanGroup,
  "chairperson_customer_id" | "secretary_customer_id" | "treasurer_customer_id"
 >
): string | null {
 const id = customerId.trim();
 if (!id) return null;
 if (id === group.chairperson_customer_id.trim()) return "Chairperson";
 if (group.secretary_customer_id && id === group.secretary_customer_id.trim()) return "Secretary";
 if (group.treasurer_customer_id && id === group.treasurer_customer_id.trim()) return "Treasurer";
 return null;
}

export function isLeadershipMember(
 customerId: string,
 group: Pick<
  LoanGroup,
  "chairperson_customer_id" | "secretary_customer_id" | "treasurer_customer_id"
 >
): boolean {
 return leadershipRoleForCustomer(customerId, group) !== null;
}

/** Body for `POST /groups/{group}/members`. */
export function buildAddGroupMemberBody(customerId: string): Record<string, string> {
 return { customer_id: customerId.trim() };
}
