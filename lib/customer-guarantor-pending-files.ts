import type { CustomerGuarantorFormRow } from "@/lib/customer-guarantors";
import type { GuarantorFileRow } from "@/lib/application-linked-uploads";

type PendingGuarantorFiles = GuarantorFileRow[];

const pendingByCustomerId = new Map<string, PendingGuarantorFiles>();

function formRowToPendingFiles(row: CustomerGuarantorFormRow): GuarantorFileRow {
  return {
    name: row.name.trim(),
    phone: row.phone.trim(),
    idFront: row.idFront,
    idBack: row.idBack,
    photo: row.photo,
    photoWithCustomer: row.photoWithCustomer,
    wardLetter: row.wardLetter,
    attachments: [...row.attachments],
  };
}

/** Hold guarantor documents in memory until the first application is created for this customer. */
export function setCustomerGuarantorPendingFiles(
  customerId: string,
  rows: CustomerGuarantorFormRow[]
): void {
  const id = customerId.trim();
  if (!id) return;
  pendingByCustomerId.set(
    id,
    rows.map(formRowToPendingFiles)
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
