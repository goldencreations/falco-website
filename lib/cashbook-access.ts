import type { SessionUser } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

const CASHBOOK_VIEW_ROLES = new Set<UserRole>(["super_admin", "accountant", "branch_manager"]);

const CASHBOOK_MANAGE_ROLES = new Set<UserRole>(["super_admin", "accountant"]);

const UNMATCHED_QUEUE_ROLES = new Set<UserRole>(["super_admin", "accountant"]);

export const FINANCIAL_ENTRIES_UNASSIGNED_VIEW = "financial_entries.unassigned.view";

type CashbookActor = Pick<SessionUser, "role" | "branch_id"> & {
  permissions?: string[];
};

export function canViewCashbook(user: CashbookActor): boolean {
  return (
    CASHBOOK_VIEW_ROLES.has(user.role) ||
    Boolean(user.permissions?.includes("financial_entries.view")) ||
    Boolean(user.permissions?.includes("payments.view"))
  );
}

export function canManageCashbook(user: CashbookActor): boolean {
  return (
    CASHBOOK_MANAGE_ROLES.has(user.role) ||
    Boolean(user.permissions?.includes("financial_entries.create"))
  );
}

export function canClassifyCashbookEntry(user: CashbookActor): boolean {
  return (
    canManageCashbook(user) ||
    Boolean(user.permissions?.includes("financial_entries.classify")) ||
    Boolean(user.permissions?.includes("payments.create"))
  );
}

export function canAllocateCashbookToLoan(user: CashbookActor): boolean {
  return canClassifyCashbookEntry(user);
}

export function canReverseCashbookEntry(user: CashbookActor): boolean {
  return (
    CASHBOOK_MANAGE_ROLES.has(user.role) ||
    Boolean(user.permissions?.includes("financial_entries.reverse"))
  );
}

/** Org-wide ClickPesa unmatched queue — not available to branch managers unless explicitly granted. */
export function canViewUnmatchedCashbookQueue(user: CashbookActor): boolean {
  if (user.permissions?.includes(FINANCIAL_ENTRIES_UNASSIGNED_VIEW)) return true;
  return UNMATCHED_QUEUE_ROLES.has(user.role);
}

/**
 * Branch id enforced on cashbook filters for branch-scoped staff.
 * Branch managers are view-only; accountants retain full manage actions within scope.
 */
export function cashbookScopedBranchId(user: CashbookActor): string | null {
  if (user.role === "super_admin") return null;
  const branchId = user.branch_id?.trim();
  if (!branchId) return null;
  if (user.role === "branch_manager" || user.role === "accountant") return branchId;
  return null;
}

export const CASHBOOK_ACCOUNTANT_BASE = "/accountant/cashbook";
export const CASHBOOK_WEBHOOK_HEALTH_ACCOUNTANT = "/accountant/webhook-health";
