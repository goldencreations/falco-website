export type CustomerIdType = "NIDA" | "passport" | "voter_id" | "driving_license";

export const CUSTOMER_ID_TYPE_OPTIONS: Array<{ value: CustomerIdType; label: string }> = [
 { value: "NIDA", label: "NIDA" },
 { value: "voter_id", label: "Voter ID" },
 { value: "driving_license", label: "Driver Licence" },
 { value: "passport", label: "Passport" },
];

export function customerIdTypeLabel(value: string | null | undefined): string {
 return CUSTOMER_ID_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value ?? "NIDA";
}

export function normalizeCustomerIdType(value: unknown): CustomerIdType {
 const raw = String(value ?? "")
  .trim()
  .toLowerCase()
  .replace(/\s+/g, "_");
 if (raw === "nida") return "NIDA";
 if (raw === "passport") return "passport";
 if (raw === "voter_id" || raw === "voters_id") return "voter_id";
 if (raw === "driving_license" || raw === "driver_licence" || raw === "drivers_license") {
  return "driving_license";
 }
 return "NIDA";
}
