export type GeneralLedgerDraft = Record<string, unknown>;

export function hasPostingAccounts(entry: GeneralLedgerDraft): boolean {
  return entry.recognition_account_id !== null
    && entry.recognition_account_id !== undefined
    && entry.counterpart_account_id !== null
    && entry.counterpart_account_id !== undefined;
}

export function isAwaitingAccountingSetup(entry: GeneralLedgerDraft): boolean {
  const status = String(entry.status ?? entry.posting_status ?? "").toLowerCase();

  return status === "draft" && !hasPostingAccounts(entry);
}
