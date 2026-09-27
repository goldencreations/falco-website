import { redirect } from "next/navigation";
import { getServerSessionUser } from "@/lib/auth";

/** Enforces the private General Ledger feature gate for every direct route. */
export async function requireGeneralLedgerAccess(): Promise<void> {
  const user = await getServerSessionUser();

  if (!user) {
    redirect("/");
  }

  if (user.must_change_password) {
    redirect("/change-password");
  }

  if (!user.features.includes("general_ledger")) {
    redirect("/dashboard");
  }
}
