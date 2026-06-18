import type { CustomerGuarantorFormRow } from "@/lib/customer-guarantors";

type PendingGuarantorFiles = Array<{ idFront: File | null; idBack: File | null }>;

const pendingByCustomerId = new Map<string, PendingGuarantorFiles>();

/** Hold guarantor ID scans in memory until the first application is created for this customer. */
export function setCustomerGuarantorPendingFiles(
  customerId: string,
  rows: CustomerGuarantorFormRow[]
): void {
  const id = customerId.trim();
  if (!id) return;
  pendingByCustomerId.set(
    id,
    rows.map((row) => ({ idFront: row.idFront, idBack: row.idBack }))
  );
}

export function getCustomerGuarantorPendingFiles(
  customerId: string
): PendingGuarantorFiles | undefined {
  const id = customerId.trim();
  if (!id) return undefined;
  return pendingByCustomerId.get(id);
}

export function clearCustomerGuarantorPendingFiles(customerId: string): void {
  const id = customerId.trim();
  if (!id) return;
  pendingByCustomerId.delete(id);
}
