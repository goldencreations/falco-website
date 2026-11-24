export const FINANCE_ACTION_DENIED_MESSAGE = "With this new update, this certain action is not allowed for you.";

/** Role restriction applies even to stale sessions with legacy finance permissions. */
export function canPostFinancialTransactions(user?: { role?: string | null } | null): boolean {
  return user?.role === "super_admin" || user?.role === "admin" || user?.role === "accountant";
}
