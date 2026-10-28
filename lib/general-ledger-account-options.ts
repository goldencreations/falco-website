type LedgerAccountOption = { id?: unknown; code?: unknown };

/** Accounts created through Rules / Chart of Accounts use a separate ledger code namespace. */
export function isUserChartAccount(account: LedgerAccountOption): boolean {
  return typeof account.code === "string" && /^COA-\d+$/.test(account.code);
}

/** Keep a saved historical selection visible during editing, without offering other defaults. */
export function entryAccountOptions<T extends LedgerAccountOption>(accounts: T[], savedAccountId?: string): T[] {
  return accounts.filter(account => isUserChartAccount(account)
    || Boolean(savedAccountId && String(account.id) === savedAccountId));
}
