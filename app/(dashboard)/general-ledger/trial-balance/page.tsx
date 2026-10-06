import { TrialBalanceClient } from "@/components/general-ledger/trial-balance-client";
import { requireGeneralLedgerAccess } from "@/lib/general-ledger-access";

export default async function TrialBalancePage() {
  await requireGeneralLedgerAccess();

  return <TrialBalanceClient />;
}
