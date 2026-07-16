import {
 extractApplicationDetail,
 extractApplicationsList,
 type ApplicationViewRow,
} from "@/lib/application-adapters";
import { extractCustomerDetail } from "@/lib/customer-adapters";
import {
 extractLoanDetail,
 extractLoansList,
 extractScheduleList,
 type LoanListRow,
} from "@/lib/loan-adapters";
import { nextDueDateFromSchedule } from "@/lib/loan-due-date";
import { extractPaymentsPayload, type PaymentViewRow } from "@/lib/payment-adapters";
import { extractProductsList } from "@/lib/product-adapters";
import { falcoServerFetch } from "@/lib/server-falco";

function displayNameFromCustomerRow(c: Record<string, unknown>): string {
 const full = String(c.full_name ?? "").trim();
 const fn = String(c.first_name ?? "").trim();
 const ln = String(c.last_name ?? "").trim();
 return full || `${fn} ${ln}`.trim();
}

function phoneFromCustomerRow(c: Record<string, unknown>): string {
 return String(c.phone_number ?? c.phone_primary ?? "").trim();
}

function isPlaceholderCustomerName(name: string | undefined): boolean {
 const n = (name ?? "").trim();
 return !n || n === "—" || n === "Customer" || n === "Unknown";
}

function isPlaceholderProductName(name: string | undefined): boolean {
 const n = (name ?? "").trim();
 return !n || n === "—" || n === "Product" || n === "Unknown";
}

/** `LN-APP-20260518-356503` → `APP-20260518-356503` */
export function applicationNumberFromLoanNumber(loanNumber: string): string {
 const ln = loanNumber.trim();
 if (ln.toUpperCase().startsWith("LN-")) return ln.slice(3).trim();
 return "";
}

async function loadProductNameMap(request?: Request): Promise<Map<string, string>> {
 const map = new Map<string, string>();
 const res = await falcoServerFetch<unknown>("/products", {
 request,
 query: { page_size: "200", is_active: "true" },
 });
 if (!res.ok) return map;
 for (const product of extractProductsList(res.data)) {
 if (product.id && product.name) map.set(String(product.id), product.name);
 }
 return map;
}

async function fetchCustomerById(
 customerId: string,
 request?: Request
): Promise<{ name: string; phone: string } | null> {
 const res = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(customerId)}`, {
 request,
 });
 if (!res.ok) return null;
 const row = extractCustomerDetail(res.data);
 if (!row) return null;
 const name = displayNameFromCustomerRow(row);
 if (!name) return null;
 return { name, phone: phoneFromCustomerRow(row) };
}

async function fetchContextFromApplication(
 applicationId: string,
 request?: Request
): Promise<{ customerId?: string; customerName?: string; customerPhone?: string; productName?: string }> {
 const res = await falcoServerFetch<unknown>(`/applications/${encodeURIComponent(applicationId)}`, {
 request,
 });
 if (!res.ok) return {};
 const appRow = extractApplicationDetail(res.data);
 if (!appRow) return {};

 const customerId = String(appRow.customer_id ?? "").trim();
 let customerName = "";
 let customerPhone = "";

 const cust = appRow.customer;
 if (cust && typeof cust === "object") {
 customerName = displayNameFromCustomerRow(cust as Record<string, unknown>);
 customerPhone = phoneFromCustomerRow(cust as Record<string, unknown>);
 }

 if (!customerName) {
 customerName = String(
 appRow.customer_name ?? appRow.customer_full_name ?? appRow.borrower_name ?? ""
 ).trim();
 }

 let productName = String(appRow.product_name ?? "").trim();
 const product = appRow.product;
 if (!productName && product && typeof product === "object") {
 productName = String((product as Record<string, unknown>).name ?? "").trim();
 }

 return { customerId, customerName, customerPhone, productName };
}

async function loadApplicationsIndex(
 branchId: string | undefined,
 request?: Request
): Promise<{ byId: Map<string, ApplicationViewRow>; byNumber: Map<string, ApplicationViewRow> }> {
 const byId = new Map<string, ApplicationViewRow>();
 const byNumber = new Map<string, ApplicationViewRow>();

 for (let page = 1; page <= 15; page++) {
 const res = await falcoServerFetch<unknown>("/applications", {
 request,
 query: {
 page: String(page),
 page_size: "200",
 branch_id: branchId || undefined,
 },
 });
 if (!res.ok) break;
 const batch = extractApplicationsList(res.data);
 for (const app of batch) {
 if (app.id) byId.set(String(app.id), app);
 const num = app.application_number?.trim().toLowerCase();
 if (num) byNumber.set(num, app);
 }
 if (batch.length < 200) break;
 }

 return { byId, byNumber };
}

/** Link loans to applications via `application_id` or `LN-{application_number}` loan numbers. */
export async function enrichLoansWithApplicationLink(
 loans: LoanListRow[],
 options?: { request?: Request; branchId?: string }
): Promise<LoanListRow[]> {
 const needsLink = loans.some(
 (l) =>
 !l.application_id?.trim() ||
 isPlaceholderCustomerName(l.customerDisplayName) ||
 isPlaceholderProductName(l.productName) ||
 !l.customer_id?.trim()
 );
 if (!needsLink) return loans;

 const { byId, byNumber } = await loadApplicationsIndex(options?.branchId, options?.request);

 return loans.map((loan) => {
 const next = { ...loan };
 let app: ApplicationViewRow | undefined;

 if (next.application_id?.trim()) {
 app = byId.get(next.application_id.trim());
 }

 if (!app) {
 const appNum = applicationNumberFromLoanNumber(next.loan_number);
 if (appNum) app = byNumber.get(appNum.toLowerCase());
 }

 if (!app) return next;

 if (!next.application_id?.trim()) next.application_id = app.id;
 if (!next.customer_id?.trim()) next.customer_id = app.customer_id;
 if (isPlaceholderCustomerName(next.customerDisplayName) && app.customerDisplayName?.trim()) {
 next.customerDisplayName = app.customerDisplayName;
 }
 if (!next.customerPhone?.trim() && app.customerNumber) {
 /* customerNumber is id string on app row — phone comes from customer fetch */
 }
 if (isPlaceholderProductName(next.productName) && app.productName?.trim()) {
 next.productName = app.productName;
 }
 if (!next.product_id?.trim() && app.product_id) next.product_id = app.product_id;

 return next;
 });
}

async function fetchContextFromLoanDetail(
 loanId: string,
 request?: Request
): Promise<Partial<LoanListRow>> {
 const res = await falcoServerFetch<unknown>(`/loans/${encodeURIComponent(loanId)}`, { request });
 if (!res.ok) return {};
 const detail = extractLoanDetail(res.data);
 if (!detail) return {};
 return {
 customer_id: detail.customer_id,
 customerDisplayName: detail.customerDisplayName,
 customerPhone: detail.customerPhone,
 product_id: detail.product_id,
 productName: detail.productName,
 application_id: detail.application_id,
 total_paid: detail.total_paid,
 total_outstanding: detail.total_outstanding,
 };
}

/** Fill missing customer/product labels from application, customer, and loan detail APIs. */
export async function enrichLoansWithCustomerContext(
 loans: LoanListRow[],
 options?: { request?: Request; branchId?: string }
): Promise<LoanListRow[]> {
 let result = await enrichLoansWithApplicationLink(loans, options);
 const productNames = await loadProductNameMap(options?.request);
 const customerById = new Map<string, { name: string; phone: string }>();

 const ensureCustomer = async (loan: LoanListRow) => {
 if (!isPlaceholderCustomerName(loan.customerDisplayName) && !isPlaceholderProductName(loan.productName)) {
 return;
 }
 const cid = loan.customer_id?.trim();
 if (cid && isPlaceholderCustomerName(loan.customerDisplayName)) {
 if (!customerById.has(cid)) {
 const cached = await fetchCustomerById(cid, options?.request);
 if (cached) customerById.set(cid, cached);
 }
 }
 if (loan.application_id?.trim() && isPlaceholderCustomerName(loan.customerDisplayName)) {
 const fromApp = await fetchContextFromApplication(loan.application_id, options?.request);
 if (fromApp.customerId && !loan.customer_id) loan.customer_id = fromApp.customerId;
 if (fromApp.customerName) loan.customerDisplayName = fromApp.customerName;
 if (fromApp.customerPhone) loan.customerPhone = loan.customerPhone || fromApp.customerPhone;
 if (fromApp.productName && isPlaceholderProductName(loan.productName)) loan.productName = fromApp.productName;
 if (fromApp.customerId && isPlaceholderCustomerName(loan.customerDisplayName)) {
 if (!customerById.has(fromApp.customerId)) {
 const cached = await fetchCustomerById(fromApp.customerId, options?.request);
 if (cached) customerById.set(fromApp.customerId, cached);
 }
 }
 }
 if (loan.id?.trim() && (isPlaceholderCustomerName(loan.customerDisplayName) || isPlaceholderProductName(loan.productName))) {
 const fromDetail = await fetchContextFromLoanDetail(loan.id, options?.request);
 if (fromDetail.application_id && !loan.application_id) loan.application_id = fromDetail.application_id;
 if (fromDetail.customer_id && !loan.customer_id) loan.customer_id = fromDetail.customer_id;
 if (fromDetail.customerDisplayName && isPlaceholderCustomerName(loan.customerDisplayName)) {
 loan.customerDisplayName = fromDetail.customerDisplayName;
 }
 if (fromDetail.customerPhone) loan.customerPhone = fromDetail.customerPhone;
 if (fromDetail.product_id && !loan.product_id) loan.product_id = fromDetail.product_id;
 if (fromDetail.productName && isPlaceholderProductName(loan.productName)) {
 loan.productName = fromDetail.productName;
 }
 }
 };

 await Promise.all(result.map((loan) => ensureCustomer(loan)));

 return result.map((loan) => {
 let customerDisplayName = loan.customerDisplayName;
 let customerPhone = loan.customerPhone;
 const cid = loan.customer_id?.trim();
 if (cid && isPlaceholderCustomerName(customerDisplayName)) {
 const cust = customerById.get(cid);
 if (cust) {
 customerDisplayName = cust.name;
 customerPhone = customerPhone?.trim() ? customerPhone : cust.phone;
 }
 }

 let productName = loan.productName;
 if (isPlaceholderProductName(productName) && loan.product_id?.trim()) {
 productName = productNames.get(loan.product_id.trim()) ?? productName;
 }

 return {
 ...loan,
 customerDisplayName,
 customerPhone,
 productName,
 };
 });
}

type PaymentAgg = { total: number; count: number; lastDate?: string };

function isSettledPayment(p: PaymentViewRow): boolean {
 const status = String(p.status ?? "").toLowerCase();
 if (status === "reversed" || status === "failed") return false;
 if (status === "completed") return true;
 const ledger = String(p.ledger_status ?? "").toLowerCase();
 if (ledger === "verified" || ledger === "posted" || ledger === "confirmed") return true;
 if (p.reconciliation_status === "matched") return true;
 const rawStatus = String((p.metadata as Record<string, unknown> | undefined)?.status ?? "").toLowerCase();
 if (rawStatus === "verified" || rawStatus === "completed") return true;
 return false;
}

async function loadBranchPayments(
 branchId: string | undefined,
 request?: Request
): Promise<PaymentViewRow[]> {
 const all: PaymentViewRow[] = [];
 for (let page = 1; page <= 25; page++) {
 const res = await falcoServerFetch<unknown>("/payments", {
 request,
 query: {
 page: String(page),
 page_size: "200",
 branch_id: branchId || undefined,
 },
 });
 if (!res.ok) break;
 const { payments } = extractPaymentsPayload(res.data);
 all.push(...payments);
 if (payments.length < 200) break;
 }
 return all;
}

function buildPaymentAggregates(
 payments: PaymentViewRow[],
 loans: LoanListRow[]
): Map<string, PaymentAgg> {
 const byLoanId = new Map<string, PaymentAgg>();
 const loanIdByNumber = new Map<string, string>();
 for (const loan of loans) {
 if (loan.id) byLoanId.set(loan.id, { total: 0, count: 0 });
 if (loan.loan_number) loanIdByNumber.set(loan.loan_number.trim().toLowerCase(), loan.id);
 }

 for (const payment of payments) {
 if (!isSettledPayment(payment)) continue;
 let loanId = payment.loan_id?.trim();
 if (!loanId && payment.loan_number) {
 loanId = loanIdByNumber.get(payment.loan_number.trim().toLowerCase()) ?? "";
 }
 if (!loanId) continue;

 const prev = byLoanId.get(loanId) ?? { total: 0, count: 0 };
 const amount = Number(payment.amount ?? 0);
 prev.total += amount;
 prev.count += 1;
 const pd = payment.payment_date;
 if (pd && (!prev.lastDate || pd > prev.lastDate)) prev.lastDate = pd;
 byLoanId.set(loanId, prev);
 }

 return byLoanId;
}

/** Sum completed / verified payments per loan and merge into `total_paid` + progress fields. */
export async function enrichLoansWithPaymentTotals(
 loans: LoanListRow[],
 options?: { request?: Request; branchId?: string }
): Promise<LoanListRow[]> {
 if (!loans.length) return loans;
 const payments = await loadBranchPayments(options?.branchId, options?.request);
 const agg = buildPaymentAggregates(payments, loans);

 return loans.map((loan) => {
 const row = agg.get(loan.id);
 if (!row || row.total <= 0) return loan;

 const payments_recorded_total = row.total;
 const total_paid = Math.max(Number(loan.total_paid ?? 0), payments_recorded_total);

 return {
 ...loan,
 payments_recorded_total,
 payment_count: row.count,
 last_payment_date: row.lastDate ?? loan.last_payment_date,
 total_paid,
 principal_paid: Math.max(Number(loan.principal_paid ?? 0), payments_recorded_total),
 };
 });
}

/** Load repayment schedules and attach the next unpaid installment due date. */
export async function enrichLoansWithNextDueDates(
 loans: LoanListRow[],
 options?: { request?: Request }
): Promise<LoanListRow[]> {
 const targets = loans.filter((loan) => loan.status === "active" || loan.status === "in_arrears");
 if (!targets.length) return loans;

 const scheduleDueByLoanId = new Map<string, string>();

 for (let i = 0; i < targets.length; i += 8) {
 const chunk = targets.slice(i, i + 8);
 await Promise.all(
 chunk.map(async (loan) => {
 if (loan.next_due_date) {
 scheduleDueByLoanId.set(loan.id, loan.next_due_date);
 return;
 }
 const res = await falcoServerFetch<unknown>(
 `/loans/${encodeURIComponent(loan.id)}/schedule`,
 { request: options?.request }
 );
 if (!res.ok) return;
 const nextDue = nextDueDateFromSchedule(extractScheduleList(res.data));
 if (nextDue) scheduleDueByLoanId.set(loan.id, nextDue);
 })
 );
 }

 return loans.map((loan) => {
 const nextDue = scheduleDueByLoanId.get(loan.id);
 if (!nextDue) return loan;
 return { ...loan, next_due_date: nextDue };
 });
}

/** Full server-side enrichment for loan list and detail routes. */
export async function enrichLoansFully(
 loans: LoanListRow[],
 options?: { request?: Request; branchId?: string; includeNextDue?: boolean }
): Promise<LoanListRow[]> {
 if (!loans.length) return loans;
 let result = await enrichLoansWithCustomerContext(loans, options);
 result = await enrichLoansWithPaymentTotals(result, options);
 if (options?.includeNextDue) {
 result = await enrichLoansWithNextDueDates(result, options);
 }
 return result;
}

function extractAttentionItems(raw: unknown): Record<string, unknown>[] {
 if (!raw || typeof raw !== "object") return [];
 const o = raw as Record<string, unknown>;
 for (const key of ["items", "data", "loans"]) {
 const candidate = o[key];
 if (Array.isArray(candidate)) {
 return candidate.filter((row) => row && typeof row === "object") as Record<string, unknown>[];
 }
 }
 return [];
}

/** Enrich dashboard “loans requiring attention” payload with customer names. */
export async function enrichLoansRequiringAttentionPayload(
 raw: unknown,
 options?: { request?: Request; branchId?: string }
): Promise<unknown> {
 if (!raw || typeof raw !== "object") return raw;
 const o = raw as Record<string, unknown>;
 const items = extractAttentionItems(raw);
 if (!items.length) return raw;

 const loans = await enrichLoansFully(extractLoansList({ data: items }), options);
 const byId = new Map(loans.map((l) => [l.id, l]));

 const mergedItems = items.map((item, index) => {
 const id = String(item.id ?? item.loan_id ?? `loan-${index}`);
 const loan = byId.get(id);
 if (!loan) return item;
 return {
 ...item,
 customer_name:
 loan.customerDisplayName ||
 item.customer_name ||
 item.customer_display_name,
 customer_phone: loan.customerPhone || item.customer_phone,
 product_name: loan.productName || item.product_name,
 loan_number: loan.loan_number || item.loan_number,
 outstanding_amount: item.outstanding_amount ?? item.total_outstanding ?? loan.total_outstanding,
 total_outstanding: item.total_outstanding ?? loan.total_outstanding,
 total_paid: loan.total_paid ?? item.total_paid,
 payments_recorded_total: loan.payments_recorded_total,
 };
 });

 if (Array.isArray(o.items)) return { ...o, items: mergedItems };
 if (Array.isArray(o.data)) return { ...o, data: mergedItems };
 if (Array.isArray(o.loans)) return { ...o, loans: mergedItems };
 return mergedItems;
}

/** Merge enriched display + payment fields into a loan detail API payload. */
export function mergeEnrichedLoanIntoDetailPayload(
 raw: unknown,
 enriched: LoanListRow
): unknown {
 if (!raw || typeof raw !== "object") return raw;
 const o = { ...(raw as Record<string, unknown>) };
 const loanObj =
 o.loan && typeof o.loan === "object"
 ? { ...(o.loan as Record<string, unknown>) }
 : { ...o };

 loanObj.customer_id = enriched.customer_id || loanObj.customer_id;
 loanObj.product_id = enriched.product_id || loanObj.product_id;
 loanObj.application_id = enriched.application_id || loanObj.application_id;
 loanObj.customer_name = enriched.customerDisplayName;
 loanObj.customer_display_name = enriched.customerDisplayName;
 loanObj.customer_phone = enriched.customerPhone;
 loanObj.product_name = enriched.productName;
 loanObj.total_paid = enriched.total_paid;
 loanObj.payments_recorded_total = enriched.payments_recorded_total;
 loanObj.payment_count = enriched.payment_count;
 loanObj.last_payment_date = enriched.last_payment_date;

 if (o.loan && typeof o.loan === "object") {
 o.loan = loanObj;
 } else {
 Object.assign(o, loanObj);
 }

 o.customer_display_name = enriched.customerDisplayName;
 o.product_name = enriched.productName;
 o.total_paid = enriched.total_paid;
 return o;
}
