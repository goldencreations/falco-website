import type { GroupDetailView, GroupMemberRow } from "@/lib/group-adapters";
import { leadershipRoleForCustomer } from "@/lib/group-members";
import { customerRegistrationDisplayName } from "@/lib/customer-adapters";
import type { LeadView } from "@/lib/lead-adapters";
import type { LoanListRow } from "@/lib/loan-adapters";
import type { CollectionQueueRow, Customer, LoanGroup, Payment } from "@/lib/types";

export type VikundiCollectionSummary = {
  group_id: string;
  group_name: string;
  group_code: string;
  branch_id: string;
  status: string;
  member_count: number;
  active_loans: number;
  loans_in_arrears: number;
  total_collected: number;
  total_outstanding: number;
  total_principal: number;
  total_monthly_income: number;
  open_leads: number;
  max_days_in_arrears: number;
  meeting_day: string;
  meeting_location: string;
};

export type VikundiMemberCollectionRow = {
  customer_id: string;
  customer_name: string;
  customer_number: string;
  phone: string;
  monthly_income: number;
  role: string | null;
  loan_count: number;
  active_loans: number;
  total_outstanding: number;
  total_collected: number;
  principal_disbursed: number;
  open_leads: number;
  days_in_arrears: number;
  risk_classification: string;
};

export type VikundiCollectionDetail = VikundiCollectionSummary & {
  formation_date: string;
  village_or_street: string;
  loan_officer_id: string;
  notes?: string;
  members: VikundiMemberCollectionRow[];
};

function digitsOnly(value: string | undefined): string {
  return value?.replace(/\D/g, "") ?? "";
}

export function memberIdsForGroup(group: Pick<LoanGroup, "member_customer_ids" | "chairperson_customer_id" | "secretary_customer_id" | "treasurer_customer_id">): Set<string> {
  const ids = new Set<string>();
  for (const id of group.member_customer_ids ?? []) {
    const trimmed = id?.trim();
    if (trimmed) ids.add(trimmed);
  }
  for (const id of [
    group.chairperson_customer_id,
    group.secretary_customer_id,
    group.treasurer_customer_id,
  ]) {
    const trimmed = id?.trim();
    if (trimmed) ids.add(trimmed);
  }
  return ids;
}

function loanBelongsToGroup(
  loan: Pick<LoanListRow, "customer_id" | "group_id">,
  groupId: string,
  memberIds: Set<string>
): boolean {
  if (loan.group_id && loan.group_id === groupId) return true;
  return memberIds.has(loan.customer_id);
}

function queueBelongsToGroup(
  row: Pick<CollectionQueueRow, "customer_id">,
  memberIds: Set<string>
): boolean {
  return memberIds.has(row.customer_id);
}

function paymentBelongsToGroup(
  payment: Pick<Payment, "customer_id" | "loan_id">,
  memberIds: Set<string>,
  loanIds: Set<string>
): boolean {
  if (payment.loan_id && loanIds.has(payment.loan_id)) return true;
  return memberIds.has(payment.customer_id);
}

function leadBelongsToGroup(
  lead: LeadView,
  memberIds: Set<string>,
  customersById: Map<string, Customer>
): boolean {
  if (lead.customerId && memberIds.has(lead.customerId)) return true;
  if (lead.status === "converted") return false;
  const leadPhone = digitsOnly(lead.phoneNumber);
  if (!leadPhone) return false;
  for (const id of memberIds) {
    const customer = customersById.get(id);
    if (!customer) continue;
    if (digitsOnly(customer.phone_primary) === leadPhone) return true;
    if (digitsOnly(customer.phone_secondary) === leadPhone) return true;
  }
  return false;
}

function customerMonthlyIncome(customer: Customer | undefined, member?: GroupMemberRow): number {
  if (member?.monthlyIncome != null && Number.isFinite(member.monthlyIncome)) {
    return Number(member.monthlyIncome);
  }
  return Number(customer?.monthly_income) || 0;
}

function isUsableMemberName(name: string | undefined): boolean {
  const value = name?.trim() ?? "";
  if (!value) return false;
  if (/^member$/i.test(value)) return false;
  if (value === "—" || value === "Unassigned") return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return false;
  }
  return true;
}

function customerNameFromRecord(customer: Customer | undefined): string {
  if (!customer) return "";
  return customerRegistrationDisplayName(customer);
}

function findCustomerForMember(
  member: GroupMemberRow,
  customersById: Map<string, Customer>,
  customersByNumber: Map<string, Customer>
): Customer | undefined {
  const byId = customersById.get(member.customerId);
  if (byId) return byId;
  const number = member.customerNumber?.trim();
  if (number) return customersByNumber.get(number);
  return undefined;
}

function customerDisplayName(
  customer: Customer | undefined,
  member?: GroupMemberRow,
  fallbackNames?: { loanName?: string; queueName?: string }
): string {
  const fromMember = isUsableMemberName(member?.customerName) ? member!.customerName.trim() : "";
  const fromCustomer = customerNameFromRecord(customer);
  if (fromCustomer) return fromCustomer;
  if (fromMember) return fromMember;
  if (isUsableMemberName(fallbackNames?.loanName)) return fallbackNames!.loanName!.trim();
  if (isUsableMemberName(fallbackNames?.queueName)) return fallbackNames!.queueName!.trim();
  return "—";
}

function buildCustomerNameDirectory(
  customers: Customer[],
  loans: LoanListRow[],
  queue: CollectionQueueRow[]
): Map<string, string> {
  const names = new Map<string, string>();

  const put = (id: string | undefined, name: string | undefined) => {
    const customerId = id?.trim();
    if (!customerId || !isUsableMemberName(name)) return;
    if (!names.has(customerId)) names.set(customerId, name!.trim());
  };

  for (const customer of customers) {
    put(customer.id, customerNameFromRecord(customer));
  }
  for (const loan of loans) {
    put(loan.customer_id, loan.customerDisplayName);
  }
  for (const row of queue) {
    put(row.customer_id, row.customer_name);
  }

  return names;
}

export function buildVikundiCollectionSummary(
  group: LoanGroup,
  ctx: {
    loans: LoanListRow[];
    payments: Payment[];
    queue: CollectionQueueRow[];
    leads: LeadView[];
    customers: Customer[];
  }
): VikundiCollectionSummary {
  const memberIds = memberIdsForGroup(group);
  const groupLoans = ctx.loans.filter((loan) => loanBelongsToGroup(loan, group.id, memberIds));
  const loanIds = new Set(groupLoans.map((loan) => loan.id));
  const groupQueue = ctx.queue.filter((row) => queueBelongsToGroup(row, memberIds));
  const groupPayments = ctx.payments.filter((payment) =>
    paymentBelongsToGroup(payment, memberIds, loanIds)
  );
  const customersById = new Map(ctx.customers.map((customer) => [customer.id, customer]));
  const openLeads = ctx.leads.filter(
    (lead) => lead.status !== "converted" && leadBelongsToGroup(lead, memberIds, customersById)
  );

  const totalMonthlyIncome = [...memberIds].reduce((sum, id) => {
    const customer = customersById.get(id);
    return sum + customerMonthlyIncome(customer);
  }, 0);

  return {
    group_id: group.id,
    group_name: group.group_name,
    group_code: group.group_code,
    branch_id: group.branch_id,
    status: group.status,
    member_count: memberIds.size,
    active_loans: groupLoans.filter((loan) =>
      ["active", "in_arrears", "defaulted", "restructured"].includes(loan.status)
    ).length,
    loans_in_arrears: groupQueue.length,
    total_collected: groupPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0),
    total_outstanding: groupLoans.reduce(
      (sum, loan) => sum + (Number(loan.total_outstanding) || 0),
      0
    ),
    total_principal: groupLoans.reduce(
      (sum, loan) => sum + (Number(loan.principal_amount) || 0),
      0
    ),
    total_monthly_income: totalMonthlyIncome,
    open_leads: openLeads.length,
    max_days_in_arrears: groupQueue.reduce(
      (max, row) => Math.max(max, Number(row.days_in_arrears) || 0),
      0
    ),
    meeting_day: group.meeting_day,
    meeting_location: group.meeting_location,
  };
}

export function buildVikundiCollectionDetail(
  group: GroupDetailView,
  ctx: {
    loans: LoanListRow[];
    payments: Payment[];
    queue: CollectionQueueRow[];
    leads: LeadView[];
    customers: Customer[];
  }
): VikundiCollectionDetail {
  const summary = buildVikundiCollectionSummary(group, ctx);
  const memberIds = memberIdsForGroup(group);
  const customersById = new Map(ctx.customers.map((customer) => [customer.id, customer]));
  const customersByNumber = new Map(
    ctx.customers
      .filter((customer) => customer.customer_number?.trim())
      .map((customer) => [customer.customer_number.trim(), customer])
  );
  const groupLoans = ctx.loans.filter((loan) => loanBelongsToGroup(loan, group.id, memberIds));
  const loanIds = new Set(groupLoans.map((loan) => loan.id));
  const nameDirectory = buildCustomerNameDirectory(ctx.customers, groupLoans, ctx.queue);
  const queueByCustomer = new Map<string, CollectionQueueRow[]>();
  for (const row of ctx.queue) {
    if (!queueBelongsToGroup(row, memberIds)) continue;
    const list = queueByCustomer.get(row.customer_id) ?? [];
    list.push(row);
    queueByCustomer.set(row.customer_id, list);
  }

  const members: VikundiMemberCollectionRow[] = group.members
    .filter((member) => !member.leftAt)
    .map((member) => {
      const customer = findCustomerForMember(member, customersById, customersByNumber);
      const memberLoans = groupLoans.filter((loan) => loan.customer_id === member.customerId);
      const memberLoanIds = new Set(memberLoans.map((loan) => loan.id));
      const memberPayments = ctx.payments.filter((payment) =>
        paymentBelongsToGroup(payment, new Set([member.customerId]), memberLoanIds)
      );
      const memberQueue = queueByCustomer.get(member.customerId) ?? [];
      const memberLeads = ctx.leads.filter(
        (lead) =>
          lead.status !== "converted" &&
          leadBelongsToGroup(lead, new Set([member.customerId]), customersById)
      );
      const maxDays = memberQueue.reduce(
        (max, row) => Math.max(max, Number(row.days_in_arrears) || 0),
        0
      );
      const worstRisk =
        memberQueue.find((row) => row.risk_classification)?.risk_classification ??
        memberLoans.find((loan) => loan.risk_classification)?.risk_classification ??
        "current";
      const queueName = memberQueue.find((row) => isUsableMemberName(row.customer_name))?.customer_name;
      const loanName = memberLoans.find((loan) => isUsableMemberName(loan.customerDisplayName))
        ?.customerDisplayName;

      return {
        customer_id: member.customerId,
        customer_name:
          customerDisplayName(customer, member, { loanName, queueName }) ||
          nameDirectory.get(member.customerId) ||
          "—",
        customer_number: member.customerNumber || customer?.customer_number || "—",
        phone: member.phone || customer?.phone_primary || "—",
        monthly_income: customerMonthlyIncome(customer, member),
        role: leadershipRoleForCustomer(member.customerId, group),
        loan_count: memberLoans.length,
        active_loans: memberLoans.filter((loan) =>
          ["active", "in_arrears", "defaulted", "restructured"].includes(loan.status)
        ).length,
        total_outstanding: memberLoans.reduce(
          (sum, loan) => sum + (Number(loan.total_outstanding) || 0),
          0
        ),
        total_collected: memberPayments.reduce(
          (sum, payment) => sum + (Number(payment.amount) || 0),
          0
        ),
        principal_disbursed: memberLoans.reduce(
          (sum, loan) => sum + (Number(loan.principal_amount) || 0),
          0
        ),
        open_leads: memberLeads.length,
        days_in_arrears: maxDays,
        risk_classification: worstRisk,
      };
    })
    .sort((a, b) => a.customer_name.localeCompare(b.customer_name));

  return {
    ...summary,
    formation_date: group.formation_date,
    village_or_street: group.village_or_street,
    loan_officer_id: group.loan_officer_id,
    notes: group.notes,
    members,
  };
}

export function aggregateVikundiTotals(summaries: VikundiCollectionSummary[]) {
  return {
    group_count: summaries.length,
    active_groups: summaries.filter((row) => row.status === "active").length,
    total_members: summaries.reduce((sum, row) => sum + row.member_count, 0),
    total_collected: summaries.reduce((sum, row) => sum + row.total_collected, 0),
    total_outstanding: summaries.reduce((sum, row) => sum + row.total_outstanding, 0),
    total_monthly_income: summaries.reduce((sum, row) => sum + row.total_monthly_income, 0),
    open_leads: summaries.reduce((sum, row) => sum + row.open_leads, 0),
    loans_in_arrears: summaries.reduce((sum, row) => sum + row.loans_in_arrears, 0),
  };
}
