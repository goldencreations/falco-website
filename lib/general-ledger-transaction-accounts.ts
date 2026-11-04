type Account = Record<string, unknown>;
const guidedMode = (account: Account) => (account.metadata as { guided_setup?: { mode?: string } } | undefined)?.guided_setup?.mode;
export function moneyAccount(account: Account): boolean {
  return account.type === "asset" && guidedMode(account) !== "review" && (["1000", "1010", "1020"].includes(String(account.code)) || (/^COA-\d+$/.test(String(account.code)) && String(account.report_category ?? "").startsWith("bs.cash.")));
}
export function transactionFieldVisible(kind: string, name: string, form: Record<string, string>): boolean {
  if (kind === "rules") return true;
  if (name === "grant_counterpart_account_id") return kind === "assets" && form.acquisition_type === "granted";
  if (name === "cash_account_id") return Number(form.cash_amount) > 0;
  if (name === "bank_account_id") return Number(form.bank_amount) > 0;
  if (name !== "settlement_account_id") return true;
  if (kind === "expenses") return form.settlement_status === "paid";
  if (kind === "assets") return form.acquisition_type !== "granted" && form.settlement_status === "paid";
  return true;
}
export function applyAccountDefaults(form: Record<string, string>, rule: Account | undefined): Record<string, string> {
  const defaults = rule?.defaults as Record<string, unknown> | undefined;
  return { ...form, ...(defaults?.liability_kind ? { liability_type: String(defaults.liability_kind) } : {}), ...(defaults?.asset_class ? { asset_type: String(defaults.asset_class) } : {}) };
}
