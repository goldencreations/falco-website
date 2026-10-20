import { AccountHierarchyWorkspace } from "@/components/general-ledger/account-hierarchy";
import { requireGeneralLedgerAccess } from "@/lib/general-ledger-access";

export default async function GeneralLedgerRulesPage() {
  await requireGeneralLedgerAccess();

  return <AccountHierarchyWorkspace />;
}
