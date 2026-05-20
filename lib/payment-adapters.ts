import { adaptApiPaymentRow, extractPaymentsList } from "@/lib/loan-adapters";
import type { Payment, PaymentMethod, PaymentStatus } from "@/lib/types";

export type ReconciliationStatus =
 | "matched"
 | "underpaid"
 | "overpaid"
 | "manual_review"
 | "unmatched";

export type PaymentViewRow = Payment & {
 loan_number?: string;
 customer_display_name?: string;
 customer_phone?: string;
 reconciliation_status?: ReconciliationStatus;
 reconciliation_note?: string;
 ledger_status?: string;
 metadata?: Record<string, unknown>;
};

export type ReconciliationSummary = Record<ReconciliationStatus, number>;

function readMetadata(raw: Record<string, unknown>): Record<string, unknown> {
 const md = raw.metadata;
 if (md && typeof md === "object" && !Array.isArray(md)) return md as Record<string, unknown>;
 return {};
}

export function reconciliationFromPayment(raw: Record<string, unknown>): {
 status: ReconciliationStatus;
 note: string;
} {
 const md = readMetadata(raw);
 const statusRaw = String(md.reconciliation_status ?? "").toLowerCase();
 const notes = String(raw.notes ?? "");

 if (
 statusRaw === "matched" ||
 statusRaw === "underpaid" ||
 statusRaw === "overpaid" ||
 statusRaw === "manual_review" ||
 statusRaw === "unmatched"
 ) {
 return {
 status: statusRaw as ReconciliationStatus,
 note: String(md.reconciliation_note ?? (notes || `Reconciliation status: ${statusRaw}.`)),
 };
 }

 if (notes.includes("[MANUAL_COLLECTION]")) {
 return {
 status: "manual_review",
 note: "Manual collection captured by loan officer; awaiting bank reconciliation.",
 };
 }

 if (String(raw.payment_method ?? "").toLowerCase() === "gateway") {
 return {
 status: "matched",
 note: "Automatic gateway payment — reconciled when webhook confirmed.",
 };
 }

 return {
 status: "unmatched",
 note: "No reconciliation metadata on this payment yet.",
 };
}

export function adaptPaymentViewRow(raw: Record<string, unknown>): PaymentViewRow {
 const base = adaptApiPaymentRow(raw);
 const inner = raw.payment && typeof raw.payment === "object" ? (raw.payment as Record<string, unknown>) : raw;
 const md = readMetadata(inner);
 const recon = reconciliationFromPayment(inner);

 const loan =
 inner.loan && typeof inner.loan === "object" ? (inner.loan as Record<string, unknown>) : undefined;
 const customer =
 inner.customer && typeof inner.customer === "object"
 ? (inner.customer as Record<string, unknown>)
 : loan?.customer && typeof loan.customer === "object"
 ? (loan.customer as Record<string, unknown>)
 : undefined;

 const custFn = customer ? String(customer.first_name ?? "") : "";
 const custLn = customer ? String(customer.last_name ?? "") : "";
 const custFull = customer ? String(customer.full_name ?? "").trim() : "";
 const customerDisplay = custFull || `${custFn} ${custLn}`.trim();

 return {
 ...base,
 payment_method: normalizePaymentMethod(base.payment_method, inner),
 loan_number: loan?.loan_number ? String(loan.loan_number) : undefined,
 customer_display_name: customerDisplay || undefined,
 customer_phone: customer
 ? String(customer.phone_number ?? customer.phone_primary ?? "")
 : undefined,
 reconciliation_status: recon.status,
 reconciliation_note: recon.note,
 ledger_status: inner.ledger_status ? String(inner.ledger_status) : undefined,
 metadata: Object.keys(md).length ? md : undefined,
 };
}

function normalizePaymentMethod(method: PaymentMethod, raw: Record<string, unknown>): PaymentMethod {
 const api = String(raw.payment_method ?? method).toLowerCase();
 if (api === "gateway") return "mobile_money";
 if (api === "mobile_money" || api === "bank_transfer" || api === "cheque" || api === "cash") {
 return api as PaymentMethod;
 }
 return method;
}

function normalizePaymentStatus(status: string | undefined): PaymentStatus {
 const s = (status ?? "completed").toLowerCase();
 if (s === "verified") return "completed";
 if (s === "pending" || s === "completed" || s === "failed" || s === "reversed") {
 return s as PaymentStatus;
 }
 return "completed";
}

export function extractPaymentsPayload(json: unknown): {
 payments: PaymentViewRow[];
 meta?: { page?: number; page_size?: number; total?: number };
} {
 if (!json || typeof json !== "object") return { payments: [] };
 const o = json as Record<string, unknown>;
 const rows = Array.isArray(o.data) ? o.data : Array.isArray(o.payments) ? o.payments : [];
 const payments = Array.isArray(rows)
 ? (rows as Record<string, unknown>[]).map(adaptPaymentViewRow)
 : extractPaymentsList(json).map((p) =>
 adaptPaymentViewRow({ payment: p } as Record<string, unknown>)
 );

 const meta =
 o.meta && typeof o.meta === "object" ? (o.meta as { page?: number; page_size?: number; total?: number }) : undefined;

 return { payments, meta };
}

export function computeReconciliationSummaryFromPayments(
 payments: Pick<PaymentViewRow, "reconciliation_status">[]
): ReconciliationSummary {
 const summary: ReconciliationSummary = {
 matched: 0,
 underpaid: 0,
 overpaid: 0,
 manual_review: 0,
 unmatched: 0,
 };
 for (const payment of payments) {
 const key = payment.reconciliation_status ?? "unmatched";
 if (key in summary) summary[key] += 1;
 else summary.unmatched += 1;
 }
 return summary;
}

export function extractReconciliationSummary(json: unknown): ReconciliationSummary {
 const empty: ReconciliationSummary = {
 matched: 0,
 underpaid: 0,
 overpaid: 0,
 manual_review: 0,
 unmatched: 0,
 };
 if (!json || typeof json !== "object") return empty;
 const o = json as Record<string, unknown>;
 const summary = o.summary && typeof o.summary === "object" ? (o.summary as Record<string, unknown>) : o;
 return {
 matched: Number(summary.matched ?? 0),
 underpaid: Number(summary.underpaid ?? 0),
 overpaid: Number(summary.overpaid ?? 0),
 manual_review: Number(summary.manual_review ?? 0),
 unmatched: Number(summary.unmatched ?? 0),
 };
}

/** Map UI record-payment form → `POST /payments` body. */
export function mapUiPaymentCreateToApi(body: Record<string, unknown>): Record<string, unknown> {
 const loanId = Number(body.loan_id);
 const amount = Number(body.amount);
 const method = String(body.method ?? body.payment_method ?? "cash");
 const reference = String(body.reference_number ?? "").trim();
 const paymentDate = String(body.payment_date ?? new Date().toISOString().slice(0, 10));

 let notes = body.notes != null ? String(body.notes).trim() : "";
 if (body.collection_channel === "manual_collection" && !notes.includes("[MANUAL_COLLECTION]")) {
 notes = notes
 ? `${notes} [MANUAL_COLLECTION]`
 : "[MANUAL_COLLECTION] Captured by loan officer in the field.";
 }

 const payload: Record<string, unknown> = {
 loan_id: Number.isFinite(loanId) && loanId > 0 ? loanId : body.loan_id,
 amount,
 payment_method: method,
 payment_date: paymentDate,
 };

 if (reference) payload.reference_number = reference;
 if (notes) payload.notes = notes;

 if (method === "mobile_money" || method === "gateway") {
 const provider = String(body.mobile_money_provider ?? body.provider ?? "mpesa").trim();
 const number = String(body.mobile_money_number ?? body.account_number ?? "").replace(/\s+/g, "");
 if (provider) payload.mobile_money_provider = provider;
 if (number) payload.mobile_money_number = number;
 }

 return payload;
}

export function paymentStatusForDisplay(status: PaymentStatus, ledgerStatus?: string): PaymentStatus {
 if (ledgerStatus === "verified") return "completed";
 return status;
}
