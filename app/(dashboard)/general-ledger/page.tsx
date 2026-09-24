import { redirect } from "next/navigation";
import { GeneralLedgerWorkspace } from "./general-ledger-workspace";
import { getServerSessionUser } from "@/lib/auth";

export default async function GeneralLedgerPage() {
  const user = await getServerSessionUser();
  if (!user) redirect("/");
  if (user.must_change_password) redirect("/change-password");
  if (!user.features.includes("general_ledger")) redirect("/dashboard");

  return <GeneralLedgerWorkspace />;
}
