import type { Disbursement } from "@/lib/disbursement-types";

/** Server-authorized recovery only; never infer eligibility from the visible status. */
export function canShowManualPayout(
 row: Pick<Disbursement, "can_record_manual_payout">
): boolean {
 return row.can_record_manual_payout === true;
}
