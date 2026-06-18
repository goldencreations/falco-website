import { extractGroupDetail, extractGroupsList } from "@/lib/group-adapters";
import { extractLeadsList } from "@/lib/lead-adapters";
import { extractLoansList } from "@/lib/loan-adapters";
import { adaptCollectionQueueRow, extractPaginatedData } from "@/lib/collection-adapters";
import {
  adaptApiCustomerRowToCustomer,
  customerRegistrationDisplayName,
  customerRegistrationDisplayNameFromRow,
  extractCustomerDetail,
  extractCustomersList,
} from "@/lib/customer-adapters";
import type { GroupDetailView } from "@/lib/group-adapters";
import { extractPaymentsPayload } from "@/lib/payment-adapters";
import { falcoServerFetch } from "@/lib/server-falco";
import type { Customer, Payment } from "@/lib/types";
import { memberIdsForGroup } from "@/lib/vikundi-collection-summary";

export async function hydrateCustomersForMemberIds(
  request: Request,
  customers: Customer[],
  memberIds: string[]
): Promise<Customer[]> {
  const byId = new Map(customers.map((customer) => [customer.id, customer]));
  const uniqueMemberIds = [...new Set(memberIds.map((id) => id.trim()).filter(Boolean))];

  await Promise.all(
    uniqueMemberIds.map(async (id) => {
      const res = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(id)}`, {
        request,
      });
      if (!res.ok) return;
      const row = extractCustomerDetail(res.data);
      if (!row) return;
      try {
        const adapted = adaptApiCustomerRowToCustomer(row);
        const registrationName = customerRegistrationDisplayNameFromRow(row);
        if (registrationName) {
          const parts = registrationName.split(/\s+/).filter(Boolean);
          adapted.first_name = parts[0] ?? adapted.first_name;
          adapted.last_name = parts.length > 1 ? parts.slice(1).join(" ") : adapted.last_name;
        }
        byId.set(adapted.id || id, adapted);
      } catch {
        /* skip malformed customer */
      }
    })
  );

  return Array.from(byId.values());
}

export function enrichGroupMembersWithCustomers(
  group: GroupDetailView,
  customers: Customer[]
): GroupDetailView {
  const byId = new Map(customers.map((customer) => [customer.id, customer]));
  const byNumber = new Map(
    customers
      .filter((customer) => customer.customer_number?.trim())
      .map((customer) => [customer.customer_number.trim(), customer])
  );

  return {
    ...group,
    members: group.members.map((member) => {
      const customer =
        byId.get(member.customerId) ??
        (member.customerNumber ? byNumber.get(member.customerNumber.trim()) : undefined);
      const registrationName = customer ? customerRegistrationDisplayName(customer) : "";
      return {
        ...member,
        customerName: registrationName || member.customerName,
        customerNumber: member.customerNumber || customer?.customer_number || "",
        phone: member.phone || customer?.phone_primary || "",
        monthlyIncome: member.monthlyIncome ?? customer?.monthly_income,
        nationalId: member.nationalId || customer?.national_id,
        riskGrade: member.riskGrade || customer?.risk_grade,
      };
    }),
  };
}

export async function loadVikundiCollectionSourceData(
  request: Request,
  branchId?: string | null
) {
  const query = {
    branch_id: branchId || undefined,
    page: "1",
    page_size: "500",
  };

  const [groupsRes, loansRes, paymentsRes, queueRes, leadsRes, customersRes] = await Promise.all([
    falcoServerFetch<unknown>("/groups", { request, query }),
    falcoServerFetch<unknown>("/loans", { request, query }),
    falcoServerFetch<unknown>("/payments", {
      request,
      query: { ...query, status: "completed" },
    }),
    falcoServerFetch<unknown>("/collections/queue", { request, query }),
    falcoServerFetch<unknown>("/leads", { request, query }),
    falcoServerFetch<unknown>("/customers", {
      request,
      query: { ...query, is_active: "true" },
    }),
  ]);

  return {
    groupsRes,
    loansRes,
    paymentsRes,
    queueRes,
    leadsRes,
    customersRes,
    groups: groupsRes.ok ? extractGroupsList(groupsRes.data) : [],
    loans: loansRes.ok ? extractLoansList(loansRes.data) : [],
    payments: (paymentsRes.ok
      ? extractPaymentsPayload(paymentsRes.data).payments
      : []) as Payment[],
    queue: queueRes.ok
      ? extractPaginatedData<Record<string, unknown>>(queueRes.data).map(adaptCollectionQueueRow)
      : [],
    leads: leadsRes.ok ? extractLeadsList(leadsRes.data) : [],
    customers: customersRes.ok ? extractCustomersList(customersRes.data) : [],
  };
}

export async function loadVikundiGroupDetail(request: Request, groupId: string) {
  const res = await falcoServerFetch<unknown>(`/groups/${encodeURIComponent(groupId)}`, {
    request,
  });
  if (!res.ok) return { ok: false as const, error: res.error };
  const group = extractGroupDetail(res.data);
  if (!group) return { ok: false as const, error: { status: 404, message: "Group not found" } };
  return { ok: true as const, group };
}
