import { FinancialStatementsClient } from "@/components/general-ledger/financial-statements-client";
import { requireGeneralLedgerAccess } from "@/lib/general-ledger-access";

export default async function FinancialStatementsPage() {
  await requireGeneralLedgerAccess();
  return <FinancialStatementsClient />;
}
