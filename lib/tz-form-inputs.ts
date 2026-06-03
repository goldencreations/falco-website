/** Local Tanzania mobile number (digits only, no country code). */
export const TZ_PHONE_MAX_DIGITS = 10;
export const TZ_PHONE_PLACEHOLDER = "0712345678";

/** Tanzania NIDA: 20 digits displayed as YYYYMMDD-NNNNN-NNNNN-NN. */
export const TZ_NIDA_MAX_DIGITS = 20;
export const TZ_NIDA_PLACEHOLDER = "19941234-12345-00001-12";

export function digitsOnly(raw: string): string {
 return raw.replace(/\D/g, "");
}

/** Formats up to 20 digits into the standard Tanzania NIDA display. */
export function formatTzNida(digits: string): string {
 const d = digits.slice(0, TZ_NIDA_MAX_DIGITS);
 const p1 = d.slice(0, 8);
 const p2 = d.slice(8, 13);
 const p3 = d.slice(13, 18);
 const p4 = d.slice(18, 20);
 let out = p1;
 if (p2.length > 0) out += `-${p2}`;
 if (p3.length > 0) out += `-${p3}`;
 if (p4.length > 0) out += `-${p4}`;
 return out;
}

export function sanitizeTzPhoneInput(
 raw: string,
 previousValue: string
): { value: string; rejected: boolean } {
 const digits = digitsOnly(raw);
 if (digits.length > TZ_PHONE_MAX_DIGITS) {
 return { value: previousValue, rejected: true };
 }
 return { value: digits, rejected: false };
}

export function sanitizeTzNidaInput(
 raw: string,
 previousValue: string
): { value: string; rejected: boolean } {
 const digits = digitsOnly(raw);
 if (digits.length > TZ_NIDA_MAX_DIGITS) {
 return { value: previousValue, rejected: true };
 }
 return { value: formatTzNida(digits), rejected: false };
}
