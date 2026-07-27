import { digitsOnly, TZ_PHONE_MAX_DIGITS } from "@/lib/tz-form-inputs";

/** Extra numbers beyond the primary phone (max 10). */
export const MAX_ADDITIONAL_CUSTOMER_PHONES = 10;

/** Normalize a local/E.164-ish phone to LMS style (`255…`). */
export function normalizeCustomerPhoneToApi(raw: string): string {
  const digits = digitsOnly(raw);
  if (!digits) return "";
  if (digits.startsWith("0") && digits.length >= 9) return `255${digits.slice(1)}`;
  if (!digits.startsWith("255") && digits.length >= 9) return `255${digits}`;
  return digits;
}

export function buildCustomerPhoneNumbers(
  primary: string,
  additional: string[]
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of [primary, ...additional]) {
    const normalized = normalizeCustomerPhoneToApi(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function readPhoneList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const normalized = normalizeCustomerPhoneToApi(String(item ?? ""));
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

/** Prefer API `phone_numbers`; fall back to primary + alternate. */
export function parseCustomerPhoneNumbersFromRow(
  row: Record<string, unknown> | null | undefined
): string[] {
  if (!row) return [];
  const fromList = readPhoneList(row.phone_numbers);
  if (fromList.length > 0) return fromList;

  const primary = normalizeCustomerPhoneToApi(
    String(row.phone_number ?? row.phone_primary ?? "")
  );
  const alternate = normalizeCustomerPhoneToApi(
    String(row.alternate_phone ?? row.phone_secondary ?? "")
  );
  return buildCustomerPhoneNumbers(primary, alternate ? [alternate] : []);
}

/** Additional phones for forms (excludes primary). */
export function additionalPhonesFromRow(
  row: Record<string, unknown> | null | undefined,
  primary?: string
): string[] {
  const all = parseCustomerPhoneNumbersFromRow(row);
  const primaryNorm = normalizeCustomerPhoneToApi(
    primary ?? String(row?.phone_number ?? row?.phone_primary ?? "")
  );
  return all
    .filter((phone) => phone !== primaryNorm)
    .slice(0, MAX_ADDITIONAL_CUSTOMER_PHONES)
    .map((phone) => {
      // Prefer local 0… display when API stored 255…
      if (phone.startsWith("255") && phone.length >= 12) return `0${phone.slice(3)}`;
      return phone;
    });
}

export function validateAdditionalCustomerPhones(
  phones: string[]
): { ok: true } | { ok: false; error: string; field: string } {
  if (phones.length > MAX_ADDITIONAL_CUSTOMER_PHONES) {
    return {
      ok: false,
      error: `You can add at most ${MAX_ADDITIONAL_CUSTOMER_PHONES} additional phone numbers.`,
      field: "additional_phones",
    };
  }
  for (let i = 0; i < phones.length; i++) {
    const value = phones[i]?.trim() ?? "";
    if (!value) continue;
    if (digitsOnly(value).length !== TZ_PHONE_MAX_DIGITS) {
      return {
        ok: false,
        error: `Additional phone ${i + 1}: enter a 10 digit phone number.`,
        field: `additional_phones.${i}`,
      };
    }
  }
  return { ok: true };
}

export function customerDisplayPhones(customer: {
  phone_numbers?: string[];
  phone_primary?: string;
  phone_secondary?: string;
}): string[] {
  if (customer.phone_numbers && customer.phone_numbers.length > 0) {
    return customer.phone_numbers;
  }
  return [customer.phone_primary, customer.phone_secondary].filter(
    (v): v is string => Boolean(v?.trim())
  );
}
