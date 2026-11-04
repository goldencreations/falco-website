import { parseLoansFromApiResponse, type LoanListRow } from "./loan-adapters";

export type LoanPortfolioView = "current" | "paid_off";

export function loanPortfolioUrl(view: LoanPortfolioView, branchId: string | null, page: number): string {
  const params = new URLSearchParams({ page: String(page), page_size: "100" });
  params.set(view === "paid_off" ? "status" : "exclude_status", "paid_off");
  if (branchId) params.set("branch_id", branchId);
  return `/api/loans?${params}`;
}

/** Traverse backend metadata even when officer scoping leaves an intermediate page empty. */
export async function loadLoanPortfolio(
  view: LoanPortfolioView,
  branchId: string | null,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<LoanListRow[]> {
  const loans = new Map<string, LoanListRow>();
  let page = 1;
  let totalPages = 1;
  do {
    const response = await fetcher(loanPortfolioUrl(view, branchId, page), { cache: "no-store", signal });
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result.message === "string" ? result.message : "Failed to load loans");
    const meta = result.meta;
    if (!meta || !Number.isSafeInteger(meta.page) || meta.page !== page || !Number.isSafeInteger(meta.page_size) || meta.page_size <= 0 || !Number.isSafeInteger(meta.total) || meta.total < 0) {
      throw new Error("The loan list is incomplete. Refresh to try again.");
    }
    totalPages = Math.max(1, Math.ceil(meta.total / meta.page_size));
    for (const loan of parseLoansFromApiResponse(result)) {
      if ((loan.status === "paid_off") === (view === "paid_off")) loans.set(loan.id, loan);
    }
    page += 1;
  } while (page <= totalPages);
  return [...loans.values()];
}
