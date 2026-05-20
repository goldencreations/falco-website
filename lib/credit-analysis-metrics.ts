import type { CashFlowFormState, CommitteeRow, LoanProposalFormState } from "@/lib/credit-analysis-prefill";

function toNumber(value: string): number {
 const n = parseFloat(String(value).replace(/,/g, ""));
 return Number.isFinite(n) ? n : 0;
}

/** Matches server `CreditAnalysisService::cashFlow`. */
export function computeCashFlowMetrics(cashFlow: CashFlowFormState) {
 const grossCashFlow = toNumber(cashFlow.salesRevenue) + toNumber(cashFlow.otherIncome);
 const operatingNet = grossCashFlow - toNumber(cashFlow.purchasesCogs) - toNumber(cashFlow.businessExpenses);
 const disposableIncome =
 operatingNet -
 toNumber(cashFlow.existingMonthlyDebtRepayments) -
 toNumber(cashFlow.householdExpenses);
 const repaymentCapacity = Math.max(disposableIncome, 0) * 0.4;
 return { grossCashFlow, operatingNet, disposableIncome, repaymentCapacity };
}

/** Matches server `CreditAnalysisService::ratios`. */
export function computeRatioMetrics(
 cashFlow: ReturnType<typeof computeCashFlowMetrics>,
 loanProposal: LoanProposalFormState
) {
 const amountRequested = toNumber(loanProposal.amountRequested);
 const proposedInstallment = toNumber(loanProposal.proposedInstallment);
 const equityNum = toNumber(loanProposal.equity);
 const totalLoansNum = toNumber(loanProposal.totalLoans);
 const inventoryNum = toNumber(loanProposal.inventory);
 const currentAssetsNum = toNumber(loanProposal.currentAssets);
 const currentLiabilitiesNum = toNumber(loanProposal.currentLiabilities);

 const ratio = (numerator: number, denominator: number): number | null => {
 if (denominator <= 0) return null;
 return Math.round((numerator / denominator) * 10000) / 100;
 };

 return {
 debtServiceRatio: ratio(proposedInstallment, cashFlow.disposableIncome),
 leverageRatio: ratio(totalLoansNum, equityNum),
 rotationRatio: ratio(amountRequested, inventoryNum),
 liquidityRatio: ratio(currentAssetsNum, currentLiabilitiesNum),
 };
}

export function formatCommitteeDecision(decision: string): string {
 switch (decision) {
 case "approved":
 return "Approved";
 case "rejected":
 return "Rejected";
 case "pending":
 return "Pending";
 default:
 return decision.replace(/_/g, " ");
 }
}

/** Mirrors server `committeeDecision()` in CreditAnalysisService. */
export function previewCommitteeDecision(votes: CommitteeRow[]): string {
 const named = votes.filter((v) => v.memberName.trim());
 if (named.length === 0) return "pending";

 const voteValues = named.map((v) => v.vote);
 if (voteValues.includes("reject")) return "rejected";
 if (
 !voteValues.includes("pending") &&
 !voteValues.includes("abstain") &&
 voteValues.every((v) => v === "approve")
 ) {
 return "approved";
 }
 return "pending";
}

export function committeeVoteStats(votes: CommitteeRow[]) {
 return votes.reduce(
 (acc, vote) => {
 if (vote.vote === "approve") acc.approve += 1;
 if (vote.vote === "reject") acc.reject += 1;
 if (vote.vote === "abstain") acc.abstain += 1;
 if (vote.vote === "pending") acc.pending += 1;
 return acc;
 },
 { approve: 0, reject: 0, abstain: 0, pending: 0 }
 );
}

export type PolicyIndicator = { label: string; status: "ok" | "warn" };

/** Policy hints using the same formulas as the API — not a substitute for committee decision. */
export function buildPolicyIndicators(input: {
 cashFlow: ReturnType<typeof computeCashFlowMetrics>;
 ratios: ReturnType<typeof computeRatioMetrics>;
 creditScore: string;
 proposedInstallment: number;
}): PolicyIndicator[] {
 const { cashFlow, ratios, creditScore, proposedInstallment } = input;
 const score = creditScore ? Number(creditScore) : null;

 const items: PolicyIndicator[] = [
 {
 label: "Repayment capacity is positive",
 status: cashFlow.repaymentCapacity > 0 ? "ok" : "warn",
 },
 {
 label: "Proposed installment within 40% of disposable income",
 status:
 proposedInstallment <= 0 ||
 (cashFlow.disposableIncome > 0 && proposedInstallment <= cashFlow.repaymentCapacity)
 ? "ok"
 : "warn",
 },
 {
 label: "Debt service ratio within typical policy band (≤ 40%)",
 status: ratios.debtServiceRatio == null || ratios.debtServiceRatio <= 40 ? "ok" : "warn",
 },
 {
 label: "Liquidity ratio at least 100%",
 status: ratios.liquidityRatio == null || ratios.liquidityRatio >= 100 ? "ok" : "warn",
 },
 {
 label: "Credit score at least 600 (when provided)",
 status: score == null || !Number.isFinite(score) || score >= 600 ? "ok" : "warn",
 },
 ];

 return items;
}

export function formatRatioPercent(value: unknown): string {
 if (value == null || value === "") return "—";
 const n = Number(value);
 return Number.isFinite(n) ? `${n.toFixed(1)}%` : "—";
}

export function amountDecisionText(amountRequested: number, amountApproved: number): string {
 if (amountApproved === 0) return "No approved amount set";
 if (amountApproved < amountRequested) return "Approved below requested";
 if (amountApproved > amountRequested) return "Approved above requested";
 return "Approved matches requested";
}
