import type { LoanListRow } from "@/lib/loan-adapters";
import type { CollectionActivity, CollectionQueueRow, Customer, LoanStatus } from "@/lib/types";

export type CustomerLookup = Map<string, { name: string; phone: string }>;

export function buildCustomerLookup(customers: Customer[]): CustomerLookup {
 const map: CustomerLookup = new Map();
 for (const c of customers) {
 const name = `${c.first_name} ${c.middle_name ? `${c.middle_name} ` : ""}${c.last_name}`.trim();
 map.set(c.id, {
 name: name || c.customer_number || "Customer",
 phone: c.phone_primary || c.phone_secondary || "",
 });
 }
 return map;
}

function resolveCustomerForLoan(
 customerId: string,
 loan: LoanListRow | undefined,
 queue: CollectionQueueRow | undefined,
 customers: CustomerLookup
): { name: string; phone: string } {
 const fromMap = customers.get(customerId);
 const fromLoanName = loan?.customerDisplayName?.trim();
 const fromLoanPhone = loan?.customerPhone?.trim() ?? "";
 if (fromLoanName && fromLoanName !== "Customer") {
 return { name: fromLoanName, phone: fromLoanPhone || fromMap?.phone || "" };
 }
 if (queue?.customer_name?.trim()) {
 return {
 name: queue.customer_name.trim(),
 phone: fromLoanPhone || fromMap?.phone || "",
 };
 }
 if (fromMap) return fromMap;
 return { name: "Unknown customer", phone: "" };
}

/** Disbursed loan statuses eligible for collection activity (outstanding balance required by API). */
export const COLLECTION_ACTIVITY_LOAN_STATUSES: LoanStatus[] = [
 "active",
 "in_arrears",
 "defaulted",
 "restructured",
];

export type CollectionActivityLoanOption = {
 loanId: string;
 loanNumber: string;
 customerId: string;
 customerName: string;
 customerPhone: string;
 /** Principal / amount disbursed to the customer. */
 principalAmount: number;
 status: string;
 totalOutstanding: number;
 daysInArrears: number;
 inQueue: boolean;
};

export function buildCollectionActivityLoanOptions(
 loans: LoanListRow[],
 queue: CollectionQueueRow[],
 customers: CustomerLookup = new Map()
): CollectionActivityLoanOption[] {
 const queueById = new Map(queue.map((q) => [q.loan_id, q]));
 const seen = new Set<string>();
 const options: CollectionActivityLoanOption[] = [];

 for (const loan of loans) {
 if (!COLLECTION_ACTIVITY_LOAN_STATUSES.includes(loan.status)) continue;
 if (Number(loan.total_outstanding) <= 0) continue;
 const id = loan.id?.trim();
 if (!id || seen.has(id)) continue;
 seen.add(id);
 const q = queueById.get(id);
 const customer = resolveCustomerForLoan(loan.customer_id, loan, q, customers);
 options.push({
 loanId: id,
 loanNumber: loan.loan_number,
 customerId: loan.customer_id,
 customerName: customer.name,
 customerPhone: customer.phone,
 principalAmount: Number(loan.principal_amount) || 0,
 status: loan.status,
 totalOutstanding: Number(loan.total_outstanding) || 0,
 daysInArrears: q?.days_in_arrears ?? Number(loan.days_in_arrears) ?? 0,
 inQueue: Boolean(q),
 });
 }

 const loanById = new Map(loans.map((l) => [l.id, l]));

 for (const q of queue) {
 if (!q.loan_id || seen.has(q.loan_id)) continue;
 seen.add(q.loan_id);
 const full = loanById.get(q.loan_id);
 const customer = resolveCustomerForLoan(q.customer_id, full, q, customers);
 options.push({
 loanId: q.loan_id,
 loanNumber: q.loan_number,
 customerId: q.customer_id,
 customerName: customer.name,
 customerPhone: customer.phone,
 principalAmount: full ? Number(full.principal_amount) || 0 : 0,
 status: full?.status ?? "in_arrears",
 totalOutstanding: Number(q.total_outstanding) || 0,
 daysInArrears: q.days_in_arrears,
 inQueue: true,
 });
 }

 options.sort((a, b) => {
 if (a.inQueue !== b.inQueue) return a.inQueue ? -1 : 1;
 return (a.customerName || "").localeCompare(b.customerName || "", undefined, { sensitivity: "base" });
 });
 return options;
}

/**
 * Pulls the row array out of a paginated list response, tolerating a few response shapes beyond
 * the documented `{ data: [...] }` — a bare top-level array, alternate keys some endpoints use
 * (`items`, `results`, `collection_activities`), and a Laravel-paginator double-wrap
 * (`{ data: { data: [...] } }`) that happens if a controller returns the paginator object as-is
 * under a `data` key instead of spreading it.
 */
export function extractPaginatedData<T>(json: unknown): T[] {
  if (Array.isArray(json)) {
    return json.filter((row): row is T => row != null && typeof row === "object");
  }
  if (!json || typeof json !== "object") return [];
  const o = json as Record<string, unknown>;

  const candidates: unknown[] = [
    o.data,
    o.queue,
    o.activities,
    o.items,
    o.results,
    o.collection_activities,
  ];
  if (o.data && typeof o.data === "object" && !Array.isArray(o.data)) {
    const nested = o.data as Record<string, unknown>;
    candidates.push(nested.data, nested.items, nested.results);
  }

  const raw = candidates.find((c): c is unknown[] => Array.isArray(c)) ?? [];
  return raw.filter((row): row is T => row != null && typeof row === "object");
}

export function adaptCollectionQueueRow(raw: Record<string, unknown>): CollectionQueueRow {
 return {
 loan_id: String(raw.loan_id ?? raw.id ?? ""),
 loan_number: String(raw.loan_number ?? ""),
 customer_id: String(raw.customer_id ?? ""),
 customer_name: String(raw.customer_name ?? raw.customer_display_name ?? "Customer"),
 days_in_arrears: Number(raw.days_in_arrears ?? 0),
 risk_classification: String(raw.risk_classification ?? "substandard"),
 total_outstanding: Number(raw.total_outstanding ?? 0),
 last_activity_at:
 raw.last_activity_at != null && String(raw.last_activity_at).trim()
 ? String(raw.last_activity_at)
 : null,
 product_id: raw.product_id != null ? String(raw.product_id) : null,
 product_name: raw.product_name != null ? String(raw.product_name) : null,
 };
}

export function adaptCollectionActivityRow(raw: Record<string, unknown>): CollectionActivity {
 const inner =
 raw.activity && typeof raw.activity === "object"
 ? (raw.activity as Record<string, unknown>)
 : raw;
 return {
 id: String(inner.id ?? ""),
 loan_id: String(inner.loan_id ?? ""),
 customer_id: String(inner.customer_id ?? ""),
 action: String(inner.action ?? "other"),
 notes: String(inner.notes ?? ""),
 outcome: inner.outcome != null ? String(inner.outcome) : undefined,
 follow_up_date:
 inner.follow_up_date != null && String(inner.follow_up_date).trim()
 ? String(inner.follow_up_date)
 : undefined,
 metadata:
 inner.metadata && typeof inner.metadata === "object"
 ? (inner.metadata as Record<string, unknown>)
 : null,
 performed_by: String(inner.performed_by ?? ""),
 performed_at: String(inner.performed_at ?? inner.created_at ?? new Date().toISOString()),
 };
}

export type CollectionActivityView = CollectionActivity & {
 loan_number: string;
 customer_name: string;
 customer_phone?: string;
 principal_amount?: number;
 total_outstanding?: number;
 days_in_arrears?: number;
 loan_status?: string;
};

export function enrichActivitiesWithQueue(
 activities: CollectionActivity[],
 queue: CollectionQueueRow[]
): (CollectionActivity & { loan_number?: string; customer_name?: string })[] {
 const byLoan = new Map(queue.map((q) => [q.loan_id, q]));
 return activities.map((a) => {
 const q = byLoan.get(a.loan_id);
 return {
 ...a,
 loan_number: q?.loan_number,
 customer_name: q?.customer_name,
 };
 });
}

/** Full display context for activity list rows and detail view. */
export function enrichActivitiesForView(
 activities: CollectionActivity[],
 queue: CollectionQueueRow[],
 loans: LoanListRow[],
 customers: CustomerLookup = new Map()
): CollectionActivityView[] {
 const loanOptions = buildCollectionActivityLoanOptions(loans, queue, customers);
 const optionByLoan = new Map(loanOptions.map((o) => [o.loanId, o]));
 const queueByLoan = new Map(queue.map((q) => [q.loan_id, q]));
 const loanById = new Map(loans.map((l) => [l.id, l]));

 return activities.map((a) => {
 const opt = optionByLoan.get(a.loan_id);
 const q = queueByLoan.get(a.loan_id);
 const loan = loanById.get(a.loan_id);
 const cust = customers.get(a.customer_id);

 return {
 ...a,
 loan_number: opt?.loanNumber ?? q?.loan_number ?? a.loan_id,
 customer_name:
 opt?.customerName ??
 q?.customer_name ??
 cust?.name ??
 `Customer ${a.customer_id}`,
 customer_phone: opt?.customerPhone ?? loan?.customerPhone ?? cust?.phone,
 principal_amount: opt?.principalAmount ?? (loan ? Number(loan.principal_amount) : undefined),
 total_outstanding:
 opt?.totalOutstanding ??
 (q ? Number(q.total_outstanding) : undefined) ??
 (loan ? Number(loan.total_outstanding) : undefined),
 days_in_arrears:
 opt?.daysInArrears ??
 (q ? q.days_in_arrears : undefined) ??
 (loan ? Number(loan.days_in_arrears) : undefined),
 loan_status: loan?.status ?? opt?.status,
 };
 });
}
