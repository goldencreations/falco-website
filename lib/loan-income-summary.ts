export type LoanIncomeRow = { category: "interest" | "penalties" | "fees"; gross_collections: string; reversals: string; net_collections: string; posted_ledger_income: string; difference: string };
export type LoanIncomeSummary = { from: string; to: string; generated_at: string; rows: LoanIncomeRow[]; totals: Omit<LoanIncomeRow, "category">; reconciliation_note: string; issues: { ambiguous_fee_payments: number; ambiguous_fee_amount: string; missing_reversal_dates: number; historical_interest_loans: number }; synchronization: { posting_enabled: boolean; unposted_events: number; payments_without_events: number; status: string } };

export function eatIncomeDates(now = new Date()): { from: string; to: string } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (name: string) => parts.find(part => part.type === name)!.value;
  const month = `${part("year")}-${part("month")}`;
  return { from: `${month}-01`, to: `${month}-${part("day")}` };
}
export function loanIncomeSummaryUrl(from: string, to: string, allTime: boolean): string {
  const params = new URLSearchParams(allTime ? { all_time: "1", to } : { from, to });
  return `/api/general-ledger/income/loan-summary?${params}`;
}
