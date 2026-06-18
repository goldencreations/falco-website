import { extractApplicationsList } from "@/lib/application-adapters";
import { fetchStaffUsersForSessionUser } from "@/lib/branch-summary-fallback";
import { customerRegistrationDisplayName, extractCustomersList } from "@/lib/customer-adapters";
import { extractGroupsList } from "@/lib/group-adapters";
import {
  globalSearchMatchesQuery,
  type GlobalSearchResult,
  type GlobalSearchResultKind,
} from "@/lib/global-search";
import { extractLeadsList } from "@/lib/lead-adapters";
import { extractLoansList } from "@/lib/loan-adapters";
import { filterLoansForLoanOfficer } from "@/lib/loan-officer-portfolio-server";
import { extractPaymentsPayload } from "@/lib/payment-adapters";
import { falcoServerFetch } from "@/lib/server-falco";
import type { SessionUser } from "@/lib/auth";
import type { Payment } from "@/lib/types";

const MAX_PER_KIND = 6;

function pushResult(
  bucket: Map<GlobalSearchResultKind, GlobalSearchResult[]>,
  result: GlobalSearchResult
) {
  const list = bucket.get(result.kind) ?? [];
  if (list.length >= MAX_PER_KIND) return;
  if (list.some((row) => row.kind === result.kind && row.id === result.id)) return;
  list.push(result);
  bucket.set(result.kind, list);
}

export async function runGlobalSearch(
  user: SessionUser,
  query: string,
  request: Request
): Promise<GlobalSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const bucket = new Map<GlobalSearchResultKind, GlobalSearchResult[]>();

  const [
    customersRes,
    leadsRes,
    groupsRes,
    loansRes,
    applicationsRes,
    paymentsRes,
    staffList,
  ] = await Promise.all([
    falcoServerFetch<unknown>("/customers", {
      request,
      query: { q, page: "1", page_size: String(MAX_PER_KIND) },
    }),
    falcoServerFetch<unknown>("/leads", {
      request,
      query: { q, page: "1", page_size: String(MAX_PER_KIND) },
    }),
    falcoServerFetch<unknown>("/groups", {
      request,
      query: { q, page: "1", page_size: String(MAX_PER_KIND) },
    }),
    falcoServerFetch<unknown>("/loans", {
      request,
      query: { q, page: "1", page_size: "100" },
    }),
    falcoServerFetch<unknown>("/applications", {
      request,
      query: { q, page: "1", page_size: "100" },
    }),
    falcoServerFetch<unknown>("/payments", {
      request,
      query: { page: "1", page_size: "100" },
    }),
    fetchStaffUsersForSessionUser(user, { request, isActive: "true" }),
  ]);

  if (customersRes.ok) {
    for (const customer of extractCustomersList(customersRes.data)) {
      const name = customerRegistrationDisplayName(customer);
      pushResult(bucket, {
        id: customer.id,
        kind: "customer",
        title: name || customer.customer_number || `Customer ${customer.id}`,
        subtitle: customer.customer_number || customer.phone_primary || undefined,
        path: `/customers/${customer.id}`,
      });
    }
  }

  if (leadsRes.ok) {
    for (const lead of extractLeadsList(leadsRes.data)) {
      pushResult(bucket, {
        id: lead.id,
        kind: "lead",
        title: lead.fullName || lead.phoneNumber || `Lead ${lead.id}`,
        subtitle: lead.phoneNumber || lead.locationName || undefined,
        path: "/leads",
      });
    }
  }

  if (groupsRes.ok) {
    for (const group of extractGroupsList(groupsRes.data)) {
      pushResult(bucket, {
        id: group.id,
        kind: "group",
        title: group.group_name || group.group_code || `Group ${group.id}`,
        subtitle: group.group_code || undefined,
        path: `/groups/${group.id}`,
      });
    }
  }

  if (loansRes.ok) {
    let loans = extractLoansList(loansRes.data).filter((loan) =>
      globalSearchMatchesQuery(q, [
        loan.loan_number,
        loan.id,
        loan.application_id,
        loan.customerDisplayName,
        loan.customerPhone,
        loan.productName,
      ])
    );

    if (user.role === "loan_officer" && user.branch_id?.trim()) {
      loans = await filterLoansForLoanOfficer(loans, request, user.branch_id.trim(), user.id);
    }

    for (const loan of loans.slice(0, MAX_PER_KIND)) {
      pushResult(bucket, {
        id: loan.id,
        kind: "loan",
        title: loan.loan_number || `Loan ${loan.id}`,
        subtitle: loan.customerDisplayName || loan.productName || undefined,
        path: loan.customer_id ? `/customers/${loan.customer_id}` : "/loans",
      });
    }
  }

  if (applicationsRes.ok) {
    const applications = extractApplicationsList(applicationsRes.data).filter((app) =>
      globalSearchMatchesQuery(q, [
        app.application_number,
        app.id,
        app.loan_number,
        app.customerDisplayName,
        app.customerNumber,
        app.customerSearchText,
        app.productName,
        app.businessName,
      ])
    );

    for (const app of applications.slice(0, MAX_PER_KIND)) {
      pushResult(bucket, {
        id: app.id,
        kind: "application",
        title: app.application_number || `Application ${app.id}`,
        subtitle: app.customerDisplayName || app.productName || undefined,
        path: `/applications/${app.id}`,
      });
    }
  }

  for (const officer of staffList.filter((row) =>
    globalSearchMatchesQuery(q, [
      row.full_name,
      row.email,
      row.phone,
      row.employee_id,
      row.id,
    ])
  )) {
    pushResult(bucket, {
      id: officer.id,
      kind: "staff",
      title: officer.full_name || officer.email || `Staff ${officer.id}`,
      subtitle: [officer.role.replace(/_/g, " "), officer.employee_id].filter(Boolean).join(" · "),
      path: user.role === "super_admin" ? `/users/${officer.id}` : "/staff/team",
    });
  }

  if (paymentsRes.ok) {
    const { payments } = extractPaymentsPayload(paymentsRes.data);
    type PaymentRow = Payment & { loan_number?: string; customer_display_name?: string };
    const matchedPayments = (payments as PaymentRow[]).filter((row) =>
      globalSearchMatchesQuery(q, [
        row.payment_number,
        row.reference_number,
        row.loan_id,
        row.customer_id,
        row.loan_number,
        row.customer_display_name,
      ])
    );

    for (const payment of matchedPayments.slice(0, MAX_PER_KIND)) {
      pushResult(bucket, {
        id: payment.id,
        kind: "payment",
        title: payment.payment_number || `Payment ${payment.id}`,
        subtitle: payment.customer_display_name || payment.reference_number || undefined,
        path: "/payments",
      });
    }
  }

  const order: GlobalSearchResultKind[] = [
    "customer",
    "application",
    "loan",
    "staff",
    "lead",
    "group",
    "payment",
  ];

  return order.flatMap((kind) => bucket.get(kind) ?? []);
}
