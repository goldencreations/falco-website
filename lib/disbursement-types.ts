/**
 * Aligns with docs/SYSTEM_ARCHITECTURE.md — `disbursements` table and enums.
 * `payment_channel` for disbursements uses the SQL enum (distinct from legacy Payment types).
 */

export type DisbursementPaymentChannel =
  | "mpesa"
  | "airtel_money"
  | "yas"
  | "halopesa"
  | "crdb"
  | "nmb"
  | "cash"
  | "other";

export const DISBURSEMENT_CHANNEL_LABELS: Record<DisbursementPaymentChannel, string> = {
  mpesa: "M-Pesa",
  airtel_money: "Airtel Money",
  yas: "Yas",
  halopesa: "Halopesa",
  crdb: "CRDB Bank",
  nmb: "NMB Bank",
  cash: "Cash",
  other: "Other",
};

export type DisbursementStatus =
  | "pending_approval"
  | "approved"
  | "completed"
  | "rejected";

export interface Disbursement {
  id: string;
  loan_id: string;
  amount: number;
  method: DisbursementPaymentChannel;
  account_name: string | null;
  account_number: string | null;
  bank_name: string | null;
  transaction_reference: string | null;
  status: DisbursementStatus;
  prepared_by: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  disbursed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DisbursementCreateInput {
  loan_id: string;
  amount: number;
  method: DisbursementPaymentChannel;
  account_name?: string | null;
  account_number?: string | null;
  bank_name?: string | null;
  transaction_reference?: string | null;
  notes?: string | null;
}

export interface DisbursementListQuery {
  status?: DisbursementStatus | "all";
  loan_id?: string;
  search?: string;
}

export type DisbursementPatchAction =
  | { action: "approve"; approved_by: string }
  | { action: "reject"; rejected_by: string; rejection_reason?: string | null }
  | {
      action: "complete";
      transaction_reference?: string | null;
      disbursed_at?: string | null;
    };
