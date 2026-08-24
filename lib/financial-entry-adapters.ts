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

function metadataFlag(entry: Pick<FinancialEntry, "metadata">, key: string): unknown {
  return entry.metadata?.[key];
}

function metadataString(entry: Pick<FinancialEntry, "metadata">, key: string): string {
  const v = metadataFlag(entry, key);
  return v == null ? "" : String(v).trim();
}

/** Posted unmatched ClickPesa income that still needs classification (not a failed payment). */
export function financialEntryIsUnmatchedClickPesa(
  entry: Pick<FinancialEntry, "source" | "category" | "direction" | "status" | "is_reversed" | "metadata">
): boolean {
  if (entry.source !== "clickpesa") return false;
  if (entry.direction && entry.direction !== "in") return false;
  if (entry.is_reversed) return false;
  const status = String(entry.status ?? "posted").toLowerCase();
  if (status !== "posted") return false;
  const classification = metadataString(entry, "classification").toLowerCase();
  if (classification === "classified") return false;
  const category = (entry.category ?? "").trim().toLowerCase();
  const unmatchedFlag = metadataFlag(entry, "unmatched");
  if (unmatchedFlag === false) return false;
  const unmatched =
    unmatchedFlag === true || classification === "unclassified_gateway_income" || UNCLASSIFIED_CATEGORIES.has(category);
  return unmatched;
}

/** True when this entry still needs classification (unmatched ClickPesa or explicit unclassified markers). */
export function financialEntryNeedsClassification(
  entry: Pick<FinancialEntry, "source" | "category" | "direction" | "status" | "is_reversed" | "metadata">
): boolean {
  if (entry.is_reversed) return false;
  const status = String(entry.status ?? "posted").toLowerCase();
  if (status !== "posted") return false;

  const category = (entry.category ?? "").trim();
  const classification = metadataString(entry, "classification");
  const unmatchedFlag = metadataFlag(entry, "unmatched");

  if (classification.toLowerCase() === "classified") return false;
  if (unmatchedFlag === false) return false;

  if (category === "unclassified_gateway_income" || category === "unclassified") return true;
  if (unmatchedFlag === true) return true;
  if (classification === "unclassified_gateway_income" || classification === "unclassified") return true;

  return financialEntryIsUnmatchedClickPesa(entry);
}

/** Newest-first ordering with tie-breakers so merged matched/unmatched rows interleave correctly. */
export function compareFinancialEntriesNewestFirst(
  a: Pick<FinancialEntry, "id" | "entry_number" | "transaction_date" | "created_at">,
  b: Pick<FinancialEntry, "id" | "entry_number" | "transaction_date" | "created_at">
): number {
  const dateDiff =
    new Date(b.transaction_date || 0).getTime() - new Date(a.transaction_date || 0).getTime();
  if (dateDiff !== 0) return dateDiff;

  const createdDiff =
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  if (createdDiff !== 0) return createdDiff;

  const entryNumberDiff = String(b.entry_number ?? "").localeCompare(String(a.entry_number ?? ""));
  if (entryNumberDiff !== 0) return entryNumberDiff;

  return String(b.id ?? "").localeCompare(String(a.id ?? ""));
}

export function sortFinancialEntriesChronologically(entries: FinancialEntry[]): FinancialEntry[] {
  return [...entries].sort(compareFinancialEntriesNewestFirst);
}

/** Merge cashbook rows by id (later lists win) and sort newest transaction first. */
export function mergeFinancialEntriesById(...lists: FinancialEntry[][]): FinancialEntry[] {
  const byId = new Map<string, FinancialEntry>();
  for (const list of lists) {
    for (const entry of list) {
      if (entry.id) byId.set(entry.id, entry);
    }
  }
  return sortFinancialEntriesChronologically(Array.from(byId.values()));
}

function entryReferenceKey(entry: FinancialEntry): string {
  const direct = (entry.reference ?? "").trim();
  if (direct) return direct;
  const meta = entry.metadata?.reference_number;
  return meta == null ? "" : String(meta).trim();
}

/** Deduplicate unmatched rows before counting or rendering (id → entry_number → reference). */
export function dedupeUnmatchedFinancialEntries(entries: FinancialEntry[]): FinancialEntry[] {
  const seenIds = new Set<string>();
  const seenEntryNumbers = new Set<string>();
  const seenReferences = new Set<string>();
  const unique: FinancialEntry[] = [];

  for (const entry of entries) {
    const id = String(entry.id ?? "").trim();
    const entryNumber = String(entry.entry_number ?? "").trim();
    const reference = entryReferenceKey(entry);

    if (id && seenIds.has(id)) continue;
    if (entryNumber && seenEntryNumbers.has(entryNumber)) continue;
    if (reference && seenReferences.has(reference)) continue;

    if (id) seenIds.add(id);
    if (entryNumber) seenEntryNumbers.add(entryNumber);
    if (reference) seenReferences.add(reference);
    unique.push(entry);
  }

  return sortFinancialEntriesChronologically(unique);
}

export function countFinancialEntriesNeedingClassification(entries: FinancialEntry[]): number {
  return entries.filter(financialEntryNeedsClassification).length;
}

/** True when a manual entry may be reversed (system-posted entries are never reversible here). */
export function financialEntryIsReversible(entry: Pick<FinancialEntry, "source" | "is_reversed">): boolean {
  return entry.source === "manual" && !entry.is_reversed;
}

const CATEGORY_LABELS: Record<string, string> = {
  loan_repayment: "Loan repayment",
  registration_fee: "Registration fee",
  loan_disbursement: "Loan disbursement",
  unclassified: "Unmatched ClickPesa receipt",
  unclassified_gateway_income: "Unmatched ClickPesa receipt",
  application_fee: "Application fee",
  other_income: "Other income",
};

/** Income `entry_type` values for classifying unmatched ClickPesa receipts. */
export const FINANCIAL_ENTRY_TYPE_OPTIONS = [
  { value: "interest", label: "Interest" },
  { value: "penalty", label: "Penalty" },
  { value: "other_income", label: "Other income" },
  { value: "principal", label: "Principal" },
  { value: "compulsory_saving", label: "Compulsory saving" },
  { value: "loan_recovery", label: "Loan recovery" },
] as const;

export function financialEntryTypeLabel(entryType: string | undefined | null): string {
  const key = (entryType ?? "").trim();
  if (!key) return "Other income";
  const match = FINANCIAL_ENTRY_TYPE_OPTIONS.find((option) => option.value === key);
  if (match) return match.label;
  return financialEntryCategoryLabel(key);
}

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
  return "Automatic";
}

export function financialEntrySourceBadgeLabel(
  entry: Pick<FinancialEntry, "source" | "category" | "direction" | "status" | "is_reversed" | "metadata">
): string {
  if (financialEntryIsUnmatchedClickPesa(entry)) return "ClickPesa unmatched";
  if (entry.source === "system") return "Automatic";
  return financialEntrySourceLabel(entry.source);
}

/** Payment channel/provider — never the ClickPesa payer/group name, never "Gateway (Auto)". */
export function financialEntryMethodLabel(
  entry: Pick<FinancialEntry, "account_name" | "payment_method" | "source" | "metadata">
): string {
  const channel = metadataString(entry, "channel");
  if (channel) return channel;
  if (entry.source !== "clickpesa") {
    const account = (entry.account_name ?? "").trim();
    if (account) return account;
  }
  if (entry.source === "clickpesa") return "ClickPesa";
  const method = String(entry.payment_method ?? "").trim();
  if (method && !/^gateway(\s*\(\s*auto\s*\))?$/i.test(method)) return method;
  return "ClickPesa";
}

export function financialEntryOrderReference(
  entry: Pick<FinancialEntry, "metadata" | "notes">
): string | undefined {
  const order = metadataString(entry, "order_reference");
  if (order) return order;
  const notes = entry.notes ?? "";
  const match = notes.match(/order reference\s+([A-Za-z0-9]+)/i);
  return match?.[1];
}

export function financialEntryPayerHint(
  entry: Pick<FinancialEntry, "account_name" | "metadata">
): {
  name?: string;
  phone?: string;
} {
  const name =
    metadataString(entry, "gateway_customer_name") || (entry.account_name ?? "").trim();
  const phone = metadataString(entry, "gateway_customer_phone");
  return {
    name: name || undefined,
    phone: phone || undefined,
  };
}

/** Case/whitespace-normalized ClickPesa payer or Falco group name for exact matching. */
export function normalizeClickPesaPayerName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export type AllocationGroupMatch = {
  id: string;
  group_name: string;
  group_code?: string;
  status?: string;
  branch_id?: string;
};

/**
 * Unique active Falco group whose normalized name or code equals the ClickPesa payer.
 * A name that merely resembles a group (for example contains "GROUP") is not a match.
 */
export function exactActiveGroupMatch<T extends AllocationGroupMatch>(
  groups: T[],
  payerName: string | undefined
): T | undefined {
  const needle = normalizeClickPesaPayerName(payerName ?? "");
  if (!needle) return undefined;
  const matches = groups.filter((group) => {
    if ((group.status ?? "active").toLowerCase() !== "active") return false;
    const name = normalizeClickPesaPayerName(group.group_name);
    const code = normalizeClickPesaPayerName(group.group_code ?? "");
    return name === needle || (code.length > 0 && code === needle);
  });
  return matches.length === 1 ? matches[0] : undefined;
}

export function hasExactActiveGroupMatch(
  groups: AllocationGroupMatch[],
  payerName: string | undefined
): boolean {
  const needle = normalizeClickPesaPayerName(payerName ?? "");
  if (!needle) return false;
  return groups.some((group) => {
    if ((group.status ?? "active").toLowerCase() !== "active") return false;
    const name = normalizeClickPesaPayerName(group.group_name);
    const code = normalizeClickPesaPayerName(group.group_code ?? "");
    return name === needle || (code.length > 0 && code === needle);
  });
}

/**
 * Category label for the cashbook row.
 * Unmatched ClickPesa income => Needs investigation. Matched auto rows stay Loan repayment / Registration fee.
 * Never "Payment failed" or "Gateway (Auto)".
 */
export function financialEntryDisplayLabel(
  entry: Pick<
    FinancialEntry,
    "source" | "category" | "direction" | "status" | "payment_method" | "reversal_reason" | "is_reversed" | "metadata"
  >
): string {
  const status = (entry.status ?? "").trim().toLowerCase();
  const reversedSuperseded =
    entry.source === "clickpesa" &&
    status === "reversed" &&
    /superseded by an automatically allocated clickpesa payment/i.test(entry.reversal_reason ?? "");
  if (reversedSuperseded) return "Superseded by automatic payment";
  if (financialEntryIsUnmatchedClickPesa(entry)) return "Needs investigation";
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
  const customerIdRaw =
    inner.customer_id != null ? str(inner.customer_id) : customer?.id != null ? str(customer.id) : "";
  const customerId = customerIdRaw.trim() || undefined;
  const category = normalizedCategoryForUi({
    category: str(inner.category ?? (source === "clickpesa" ? "unclassified_gateway_income" : "")),
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
    // Only a confirmed Falco customer — never ClickPesa payer name / account_name.
    customer_name: customerId
      ? fullName(customer) ?? (inner.customer_name != null ? str(inner.customer_name) : undefined)
      : undefined,
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
    payload.classification_notes = notes;
    payload.notes = notes;
  }
  const description = str(body.description ?? notes).trim();
  if (description) payload.description = description;
  return payload;
}

function idForAllocate(value: unknown): string | number | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = str(value).trim();
  if (!s) return undefined;
  if (/^\d+$/.test(s)) return Number(s);
  return s;
}

/**
 * Map Allocate-to-loan form → `POST /financial-entries/{id}/allocate-to-loan`.
 * Never sends amount, direction, reference, or source — the backend uses the original receipt.
 */
export function mapUiFinancialEntryAllocateToLoanToApi(body: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    branch_id: str(body.branch_id).trim(),
    customer_id: idForAllocate(body.customer_id),
    loan_id: idForAllocate(body.loan_id),
    notes: str(body.notes).trim(),
  };
  return payload;
}

export type GroupReceiptAllocationRow = {
  loan_id: string;
  amount: number;
  outstanding?: number;
};

function roundTzs(value: unknown): number {
  return Math.max(0, Math.round(num(value)));
}

/** Split a receipt across payable loans in proportion to outstanding, never above each loan's outstanding. */
export function splitReceiptAcrossOutstanding(
  receiptAmount: number,
  loans: GroupReceiptAllocationRow[]
): GroupReceiptAllocationRow[] {
  const receipt = roundTzs(receiptAmount);
  const payable = loans
    .map((loan) => ({
      loan_id: str(loan.loan_id).trim(),
      outstanding: roundTzs(loan.outstanding ?? loan.amount),
    }))
    .filter((loan) => loan.loan_id && loan.outstanding > 0);
  const totalOut = payable.reduce((sum, loan) => sum + loan.outstanding, 0);
  if (receipt <= 0 || totalOut <= 0) return [];
  const toAllocate = Math.min(receipt, totalOut);
  const amounts = payable.map((loan) =>
    Math.min(loan.outstanding, Math.floor((toAllocate * loan.outstanding) / totalOut))
  );
  let remainder = toAllocate - amounts.reduce((sum, amount) => sum + amount, 0);
  const order = payable
    .map((_, index) => index)
    .sort((a, b) => payable[b].outstanding - payable[a].outstanding);
  for (const index of order) {
    if (remainder <= 0) break;
    const room = payable[index].outstanding - amounts[index];
    if (room <= 0) continue;
    const add = Math.min(room, remainder);
    amounts[index] += add;
    remainder -= add;
  }
  return payable
    .map((loan, index) => ({ loan_id: loan.loan_id, amount: amounts[index] }))
    .filter((row) => row.amount > 0);
}

function mapGroupAllocationRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const loan_id = idForAllocate(o.loan_id);
      const amount = roundTzs(o.amount);
      if (loan_id == null || amount <= 0) return null;
      const item: Record<string, unknown> = { loan_id, amount };
      const customer_id = idForAllocate(o.customer_id);
      if (customer_id != null) item.customer_id = customer_id;
      return item;
    })
    .filter((row): row is Record<string, unknown> => row != null);
}

/**
 * Map Group-loans form → `POST /financial-entries/{id}/allocate-to-group`.
 * Sends `allocations` rows (loan_id, customer_id, amount). Never sends a top-level amount
 * or POST /payments — the receipt total still comes from the original unmatched row.
 */
export function mapUiFinancialEntryAllocateToGroupToApi(body: Record<string, unknown>): Record<string, unknown> {
  return {
    branch_id: str(body.branch_id).trim(),
    group_id: idForAllocate(body.group_id),
    notes: str(body.notes).trim(),
    allocations: mapGroupAllocationRows(body.allocations ?? body.allocation),
  };
}

export type FinancialEntryLoanAllocation = {
  already_allocated: boolean;
  payment_id?: string;
  loan_id?: string;
  group_id?: string;
  amount?: number;
  penalty_allocated: number;
  fees_allocated: number;
  interest_allocated: number;
  principal_allocated: number;
  loan_total_outstanding?: number;
  loan_total_paid?: number;
  loan_penalty_outstanding?: number;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function allocationParts(source: Record<string, unknown> | undefined): {
  penalty_allocated: number;
  fees_allocated: number;
  interest_allocated: number;
  principal_allocated: number;
  amount?: number;
} {
  return {
    penalty_allocated: num(source?.penalty_allocated ?? source?.penalty_amount),
    fees_allocated: num(source?.fees_allocated ?? source?.fees_amount),
    interest_allocated: num(source?.interest_allocated ?? source?.interest_amount),
    principal_allocated: num(source?.principal_allocated ?? source?.principal_amount),
    amount: source?.amount != null ? num(source.amount) : undefined,
  };
}

/** Parse `POST /financial-entries/{id}/allocate-to-loan` 201/200 body. */
export function extractAllocateToLoanResult(json: unknown): FinancialEntryLoanAllocation {
  const root = asRecord(json) ?? {};
  const data = asRecord(root.data) ?? root;
  const payment = asRecord(data.payment) ?? asRecord(root.payment);
  const loan = asRecord(data.loan) ?? asRecord(root.loan);
  const allocation = asRecord(data.allocation) ?? asRecord(root.allocation) ?? payment ?? data;
  const already =
    data.already_allocated === true ||
    root.already_allocated === true ||
    str(data.status).toLowerCase() === "already_allocated";
  const parts = allocationParts(allocation);

  return {
    already_allocated: already,
    payment_id: str(payment?.id ?? data.payment_id ?? allocation?.payment_id) || undefined,
    loan_id: str(loan?.id ?? data.loan_id ?? allocation?.loan_id) || undefined,
    group_id: str(data.group_id ?? root.group_id ?? allocation?.group_id) || undefined,
    amount: parts.amount,
    penalty_allocated: parts.penalty_allocated,
    fees_allocated: parts.fees_allocated,
    interest_allocated: parts.interest_allocated,
    principal_allocated: parts.principal_allocated,
    loan_total_outstanding:
      loan?.total_outstanding != null ? num(loan.total_outstanding) : undefined,
    loan_total_paid: loan?.total_paid != null ? num(loan.total_paid) : undefined,
    loan_penalty_outstanding:
      loan?.penalty_outstanding != null
        ? num(loan.penalty_outstanding)
        : loan?.penalty != null
          ? num(loan.penalty)
          : undefined,
  };
}

/** Parse `POST /financial-entries/{id}/allocate-to-group` 201/200 body. */
export function extractAllocateToGroupResult(json: unknown): FinancialEntryLoanAllocation {
  const root = asRecord(json) ?? {};
  const data = asRecord(root.data) ?? root;
  const nested =
    Array.isArray(data.allocations)
      ? data.allocations
      : Array.isArray(data.payments)
        ? data.payments
        : Array.isArray(root.allocations)
          ? root.allocations
          : Array.isArray(root.payments)
            ? root.payments
            : [];
  const rows = nested.filter((row): row is Record<string, unknown> => Boolean(asRecord(row)));
  const summed = rows.reduce(
    (acc, row) => {
      const parts = allocationParts(row);
      acc.penalty_allocated += parts.penalty_allocated;
      acc.fees_allocated += parts.fees_allocated;
      acc.interest_allocated += parts.interest_allocated;
      acc.principal_allocated += parts.principal_allocated;
      if (parts.amount != null) acc.amount = (acc.amount ?? 0) + parts.amount;
      return acc;
    },
    { penalty_allocated: 0, fees_allocated: 0, interest_allocated: 0, principal_allocated: 0, amount: undefined as number | undefined }
  );
  const base = extractAllocateToLoanResult(json);
  const firstPayment = asRecord(rows[0]);
  return {
    ...base,
    group_id: str(data.group_id ?? root.group_id ?? base.group_id) || undefined,
    payment_id: base.payment_id || str(firstPayment?.id ?? firstPayment?.payment_id) || undefined,
    loan_id: base.loan_id || str(firstPayment?.loan_id) || undefined,
    penalty_allocated: rows.length > 0 ? summed.penalty_allocated : base.penalty_allocated,
    fees_allocated: rows.length > 0 ? summed.fees_allocated : base.fees_allocated,
    interest_allocated: rows.length > 0 ? summed.interest_allocated : base.interest_allocated,
    principal_allocated: rows.length > 0 ? summed.principal_allocated : base.principal_allocated,
    amount: rows.length > 0 ? summed.amount : base.amount,
  };
}
