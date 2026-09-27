import { GeneralLedgerWorkspace } from "../general-ledger-workspace";
import { requireGeneralLedgerAccess } from "@/lib/general-ledger-access";

export default async function GeneralLedgerLoansPage() {
  await requireGeneralLedgerAccess();

  return <GeneralLedgerWorkspace />;
}
