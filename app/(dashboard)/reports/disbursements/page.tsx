import { redirect } from "next/navigation";

/**
 * Report view is the same mock source as the operational workspace; avoid duplicating
 * a second report implementation until a dedicated report API exists.
 */
export default function DisbursementReportPage() {
  redirect("/disbursements");
}
