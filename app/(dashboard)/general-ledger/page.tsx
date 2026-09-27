import { redirect } from "next/navigation";
import { requireGeneralLedgerAccess } from "@/lib/general-ledger-access";

export default async function GeneralLedgerPage() {
  await requireGeneralLedgerAccess();

  redirect("/general-ledger/loans");
}
