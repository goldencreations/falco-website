import { GeneralLedgerRegister } from "@/components/general-ledger/general-ledger-register";
import { requireGeneralLedgerAccess } from "@/lib/general-ledger-access";

export default async function GeneralLedgerLiabilitiesPage() {
  await requireGeneralLedgerAccess();

  return <GeneralLedgerRegister kind="liabilities" />;
}
