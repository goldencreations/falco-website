import type {
  CashbookSummary,
  FinancialEntry,
  FinancialEntryDirection,
  FinancialEntrySource,
} from "@/lib/types";

function str(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asDirection(value: unknown): FinancialEntryDirection {
  const s = str(value).toLowerCase();
  if (s === "out" || s === "debit" || s === "outflow" || s === "cash_out") return "out";
  return "in";
}

function asSource(value: unknown): FinancialEntrySource {
  const s = str(value).toLowerCase();
  if (s === "clickpesa" || s === "gateway") return "clickpesa";
  if (s === "manual") return "manual";
  return "system";
}

function readNested(raw: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const v = raw[key];
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

function fullName(obj: Record<string, unknown> | undefined): string | undefined {
  if (!obj) return undefined;
  const full = str(obj.full_name ?? obj.name).trim();
  if (full) return full;
  const combined = `${str(obj.first_name)} ${str(obj.last_name)}`.trim();
  return combined || undefined;
}

function normalizedCategoryForUi(params: { category: string }): string {
  return (params.category ?? "").trim();
}

/** Category sentinels meaning "an accountant still needs to classify this receipt". */
const UNCLASSIFIED_CATEGORIES = new Set(["", "unclassified", "unclassified_gateway_income"]);

/** True when this entry is an unclassified ClickPesa receipt that still needs an accountant to classify it. */
export function financialEntryNeedsClassification(entry: Pick<FinancialEntry, "source" | "category" | "status" | "is_reversed">): boolean {
  if (entry.source !== "clickpesa") return false;
  if (entry.is_reversed || String(entry.status ?? "").toLowerCase() === "reversed") return false;
  const category = (entry.category ?? "").trim().toLowerCase();
  return UNCLASSIFIED_CATEGORIES.has(category);
}

/** True when a manual entry may be reversed (system-posted entries are never reversible here). */
export function financialEntryIsReversible(entry: Pick<FinancialEntry, "source" | "is_reversed">): boolean {
  return entry.source === "manual" && !entry.is_reversed;
}

const CATEGORY_LABELS: Record<string, string> = {
  loan_repayment: "Loan repayment",
  registration_fee: "Registration fee",
  loan_disbursement: "Loan disbursement",
  unclassified: "Unclassified",
  unclassified_gateway_income: "Unclassified",
};

export function financialEntryCategoryLabel(category: string | undefined | null): string {
  const key = (category ?? "").trim();
  if (!key) return "Unclassified";
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  return key
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function financialEntrySourceLabel(source: FinancialEntrySource): string {
  if (source === "clickpesa") return "ClickPesa";
  if (source === "manual") return "Manual";
  return "System";
}

/**
 * UI label for auto/manual/system classification.
 * - System + gateway + loan_repayment => Loan repayment · Gateway (Auto)
 * - System + gateway + registration_fee => Registration fee · Gateway (Auto)
 * - Reversed legacy clickpesa => Superseded by automatic payment
 * - Historical clickpesa unclassified => Needs investigation
 */
export function financialEntryDisplayLabel(entry: Pick<FinancialEntry, "source" | "category" | "status" | "payment_method" | "reversal_reason">): string {
  const category = (entry.category ?? "").trim().toLowerCase();
  const status = (entry.status ?? "").trim().toLowerCase();
  const method = String(entry.payment_method ?? "").trim().toLowerCase();
  const reversedSuperseded =
    entry.source === "clickpesa" &&
    status === "reversed" &&
    /superseded by an automatically allocated clickpesa payment/i.test(entry.reversal_reason ?? "");
  if (reversedSuperseded) return "Superseded by automatic payment";
  if (entry.source === "clickpesa" && status === "posted" && UNCLASSIFIED_CATEGORIES.has(category)) {
    return "Needs investigation";
  }
  if (entry.source === "system" && category === "loan_repayment" && method === "gateway") {
    return "Loan repayment · Gateway (Auto)";
  }
  if (entry.source === "system" && category === "registration_fee" && method === "gateway") {
    return "Registration fee · Gateway (Auto)";
  }
  return financialEntryCategoryLabel(entry.category);
}

export function adaptApiFinancialEntryRow(raw: Record<string, unknown>): FinancialEntry {
  const inner = readNested(raw, "financial_entry") ?? readNested(raw, "entry") ?? raw;

  const branch = readNested(inner, "branch");
  const customer = readNested(inner, "customer");
  const creator = readNested(inner, "created_by") ?? readNested(inner, "creator") ?? readNested(inner, "staff");

  const id = str(inner.id);
  const source = asSource(inner.source);
  const direction = asDirection(inner.direction ?? inner.type);
  const md = readNested(inner, "metadata");
  const customerId =
    inner.customer_id != null ? str(inner.customer_id) : customer?.id != null ? str(customer.id) : undefined;
  const category = normalizedCategoryForUi({
    category: str(inner.category ?? (source === "clickpesa" ? "unclassified" : "")),
  });

  return {
    id,
    entry_number: str(inner.entry_number ?? inner.reference_number ?? id),
    direction,
    category,
    amount: Math.abs(num(inner.amount)),
    transaction_date: str(inner.transaction_date ?? inner.date ?? inner.created_at),
    source,
    running_balance: num(inner.running_balance ?? inner.balance),
    branch_id: inner.branch_id != null ? str(inner.branch_id) : branch?.id != null ? str(branch.id) : undefined,
    branch_name: str(branch?.name ?? inner.branch_name) || undefined,
    customer_id: customerId,
    customer_name: fullName(customer) ?? (inner.customer_name != null ? str(inner.customer_name) : undefined),
    income_type: str(inner.income_type) || undefined,
    notes: str(inner.notes ?? inner.description) || undefined,
    reference: str(inner.reference_number ?? inner.reference ?? inner.external_reference) || undefined,
    status: str(inner.status) || undefined,
    payment_method: str(inner.payment_method) || undefined,
    metadata: md,
    account_name: str(inner.account_name ?? readNested(inner, "account")?.name) || undefined,
    is_reversed: Boolean(inner.is_reversed ?? inner.reversed ?? (str(inner.status).toLowerCase() === "reversed")),
    reversal_reason: str(inner.reversal_reason) || undefined,
    created_by: inner.created_by_id != null ? str(inner.created_by_id) : creator?.id != null ? str(creator.id) : undefined,
    created_by_name: fullName(creator),
    created_at: str(inner.created_at) || undefined,
  };
}

export function adaptApiCashbookSummary(raw: unknown): CashbookSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    opening_balance: num(o.opening_balance),
    cash_in: num(o.cash_in ?? o.total_in),
    cash_out: num(o.cash_out ?? o.total_out),
    closing_balance: num(o.closing_balance),
  };
}

export function extractFinancialEntriesPayload(json: unknown): {
  entries: FinancialEntry[];
  cashbook: CashbookSummary | null;
  meta?: { page?: number; page_size?: number; total?: number };
} {
  if (!json || typeof json !== "object") return { entries: [], cashbook: null };
  const o = json as Record<string, unknown>;
  const rows = Array.isArray(o.data)
    ? o.data
    : Array.isArray(o.financial_entries)
      ? o.financial_entries
      : Array.isArray(o.entries)
        ? o.entries
        : [];

  const entries = (rows as Record<string, unknown>[]).map(adaptApiFinancialEntryRow);
  const cashbook = adaptApiCashbookSummary(o.cashbook);
  const meta =
    o.meta && typeof o.meta === "object"
      ? (o.meta as { page?: number; page_size?: number; total?: number })
      : undefined;

  return { entries, cashbook, meta };
}

/** Map the "New manual entry" form → `POST /financial-entries` body. */
export function mapUiFinancialEntryCreateToApi(body: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    direction: str(body.direction ?? "in"),
    category: str(body.category).trim(),
    amount: num(body.amount),
    transaction_date: str(body.transaction_date ?? new Date().toISOString().slice(0, 10)),
    source: "manual",
  };
  if (body.branch_id) payload.branch_id = body.branch_id;
  if (body.notes && str(body.notes).trim()) payload.notes = str(body.notes).trim();
  return payload;
}

/**
 * Map the "Classify receipt" form → `PATCH /financial-entries/{id}/classification` body.
 *
 * Sends both the handoff spec's field names (`entry_type`, `description`, `classification_notes`)
 * and the previously-used ones (`income_type`, `notes`) so this keeps working whichever shape the
 * backend actually reads — the values are identical, just duplicated under both keys.
 */
export function mapUiFinancialEntryClassificationToApi(body: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    category: str(body.category).trim(),
  };
  if (body.branch_id) payload.branch_id = body.branch_id;
  if (body.customer_id) payload.customer_id = body.customer_id;
  const incomeType = str(body.entry_type ?? body.income_type).trim();
  if (incomeType) {
    payload.entry_type = incomeType;
    payload.income_type = incomeType;
  }
  const notes = str(body.classification_notes ?? body.notes).trim();
  if (notes) {
    payload.description = notes;
    payload.classification_notes = notes;
    payload.notes = notes;
  }
  return payload;
}
