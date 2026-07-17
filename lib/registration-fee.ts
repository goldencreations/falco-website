import { parseCustomerMetadata } from "@/lib/customer-location";

export type RegistrationFeeProgress = {
 expected: number;
 paid: number;
 remaining: number;
 completed: boolean;
 statusLabel: string;
};

export type ClickPesaBillPayReference = {
 reference: string;
 gateway: string;
 is_active?: boolean;
};

export function readCustomerMetadataRecord(
 customer: Record<string, unknown> | null | undefined
): Record<string, unknown> {
 if (!customer) return {};
 const top =
  customer.metadata && typeof customer.metadata === "object" && customer.metadata !== null
   ? (customer.metadata as Record<string, unknown>)
   : {};
 return { ...parseCustomerMetadata(customer), ...top };
}

export function registrationFeeStatus(metadata: Record<string, unknown>): string {
 const expected = Number(metadata.registration_fee_amount ?? 0);
 const paid = Number(metadata.registration_fee_paid_amount ?? 0);

 if (metadata.registration_fee_paid === true) {
  return "Paid";
 }

 if (paid > 0 && paid < expected) {
  return "Partially paid";
 }

 return "Awaiting payment";
}

export function registrationFeeProgress(
 customer: Record<string, unknown> | null | undefined
): RegistrationFeeProgress {
 const metadata = readCustomerMetadataRecord(customer);
 const expected = Number(metadata.registration_fee_amount ?? 0);
 const paid = Number(metadata.registration_fee_paid_amount ?? 0);
 const remaining = Math.max(expected - paid, 0);
 const completed = metadata.registration_fee_paid === true;

 return {
  expected,
  paid,
  remaining,
  completed,
  statusLabel: registrationFeeStatus(metadata),
 };
}

export function findClickPesaBillPayReference(
 customer: Record<string, unknown> | null | undefined
): ClickPesaBillPayReference | null {
 if (!customer) return null;
 const references = Array.isArray(customer.payment_references)
  ? customer.payment_references
  : [];
 const clickPesa =
  references.find(
   (row) =>
    row &&
    typeof row === "object" &&
    String((row as Record<string, unknown>).gateway ?? "").toLowerCase() === "clickpesa"
  ) ?? references.find((row) => row && typeof row === "object");
 if (!clickPesa || typeof clickPesa !== "object") return null;
 const record = clickPesa as Record<string, unknown>;
 const reference = String(record.reference ?? "").trim();
 if (!reference) return null;
 return {
  reference,
  gateway: String(record.gateway ?? "clickpesa"),
  is_active: record.is_active === true,
 };
}
