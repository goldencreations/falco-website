export type GeneralLedgerRuleCategory = "expense" | "asset" | "liability";
export type GeneralLedgerRegisterKind = "expenses" | "assets" | "liabilities";
export type GeneralLedgerRule = Record<string, unknown>;

const requiredFields: Record<GeneralLedgerRuleCategory, string[]> = {
  expense: ["recognition_account_id", "settlement_account_id", "payable_account_id"],
  asset: ["recognition_account_id", "settlement_account_id", "payable_account_id"],
  liability: ["recognition_account_id", "settlement_account_id"],
};

export function requiredPostingFields(category: string): string[] {
  return requiredFields[category as GeneralLedgerRuleCategory] ?? [];
}

export function isRulePostingFieldVisible(fieldName: string, category: string): boolean {
  if (fieldName === "payable_account_id") return category === "expense" || category === "asset";
  if (fieldName === "grant_counterpart_account_id") return category === "asset";
  return true;
}

export function isRulePostingFieldRequired(fieldName: string, category: string): boolean {
  return requiredPostingFields(category).includes(fieldName);
}

export function isRuleReady(rule: GeneralLedgerRule): boolean {
  return requiredPostingFields(String(rule.category ?? "")).every((field) => hasValue(rule[field]));
}

export function allowedAccountTypes(fieldName: string, category: string): string[] {
  if (fieldName === "recognition_account_id") return [category];
  if (fieldName === "payable_account_id") return ["liability"];
  if (fieldName === "grant_counterpart_account_id") return ["equity", "income"];
  if (fieldName === "settlement_account_id" && category === "liability") return ["asset", "expense"];
  if (fieldName === "settlement_account_id") return ["asset"];
  return [];
}

export function postingConfigurationIssue(
  kind: GeneralLedgerRegisterKind,
  form: Record<string, string>,
  rule: GeneralLedgerRule | undefined,
): string | null {
  if (!rule) return "Choose a valid posting rule before continuing.";
  if (!hasValue(rule.recognition_account_id)) return "This rule has no debit/credit recognition account. Edit the rule and complete its accounting setup.";

  if (kind === "expenses") {
    return form.settlement_status === "unpaid"
      ? missing(rule.payable_account_id, "This expense rule needs an Accounts Payable account before an unpaid expense can be recorded.")
      : missing(rule.settlement_account_id, "This expense rule needs a cash, bank, or mobile-money account before a paid expense can be recorded.");
  }

  if (kind === "assets") {
    if (form.acquisition_type === "granted") {
      return missing(rule.grant_counterpart_account_id, "This asset rule needs an accountant-approved grant or donation source account before a granted asset can be recorded.");
    }

    return form.settlement_status === "unpaid"
      ? missing(rule.payable_account_id, "This asset rule needs an Accounts Payable account before an unpaid purchase can be recorded.")
      : missing(rule.settlement_account_id, "This asset rule needs a cash, bank, or mobile-money account before a paid purchase can be recorded.");
  }

  return missing(rule.settlement_account_id, "This liability rule needs its other-side account before the liability can be recorded.");
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

function missing(value: unknown, message: string): string | null {
  return hasValue(value) ? null : message;
}
