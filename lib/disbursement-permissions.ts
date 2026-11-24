import type { SessionUser } from "@/lib/auth";
import { canPostFinancialTransactions } from "@/lib/finance-action-access";

export function canPrepareDisbursement(user: Pick<SessionUser, "role" | "permissions">): boolean {
  return canPostFinancialTransactions(user);
}

export function canApproveDisbursement(user: Pick<SessionUser, "role" | "permissions">): boolean {
  return canPostFinancialTransactions(user);
}
