/**
 * Money input formatting: thousands with comma, optional cents as `,00`
 * (e.g. `1,000,000` or `1,000,000,50`).
 */

/** Format a numeric amount for display in inputs. */
export function formatMoneyFromNumber(amount: number): string {
 if (!Number.isFinite(amount) || amount === 0) return "";
 const fixed = Math.abs(amount).toFixed(2);
 const [intPart, decPart] = fixed.split(".");
 const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
 if (decPart === "00") return grouped;
 return `${grouped},${decPart}`;
}

/** Format while typing (keeps only digits and commas). */
export function formatMoneyInput(raw: string): string {
 if (!raw) return "";
 const s = raw.replace(/[^\d,]/g, "");
 if (!s) return "";

 const lastComma = s.lastIndexOf(",");
 let intPart = s;
 let decPart = "";

 if (lastComma >= 0) {
 const after = s.slice(lastComma + 1);
 if (after.length <= 2 && /^\d*$/.test(after)) {
 decPart = after;
 intPart = s.slice(0, lastComma);
 } else {
 intPart = s.replace(/,/g, "");
 decPart = "";
 }
 }

 const intDigits = intPart.replace(/,/g, "").replace(/\D/g, "");
 if (!intDigits && !decPart) return "";
 const grouped = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
 if (decPart) return `${grouped},${decPart}`;
 return grouped;
}

/** Parse formatted money string to a number. */
export function parseMoneyInput(value: string): number {
 if (!value?.trim()) return 0;
 const s = value.replace(/\s/g, "");
 const lastComma = s.lastIndexOf(",");
 if (lastComma >= 0) {
 const after = s.slice(lastComma + 1);
 if (/^\d{1,2}$/.test(after)) {
 const intPart = s.slice(0, lastComma).replace(/,/g, "");
 const n = parseFloat(`${intPart}.${after}`);
 return Number.isFinite(n) ? n : 0;
 }
 }
 const n = parseFloat(s.replace(/,/g, ""));
 return Number.isFinite(n) ? n : 0;
}
