export function formatCurrency(amount: number): string {
 return new Intl.NumberFormat("en-TZ", {
 style: "currency",
 currency: "TZS",
 minimumFractionDigits: 0,
 maximumFractionDigits: 0,
 }).format(amount);
}

/** Compact version: values ≥ 1B render as "TSh 2.5B", ≥ 1M as "TSh 1.5M", smaller values use the standard format. */
export function formatCurrencyCompact(amount: number): string {
 if (amount >= 1_000_000_000) {
 const billions = amount / 1_000_000_000;
 const formatted = parseFloat(billions.toFixed(2)).toString();
 return `TSh\u00A0${formatted}B`;
 }
 if (amount >= 1_000_000) {
 const millions = amount / 1_000_000;
 const formatted = parseFloat(millions.toFixed(2)).toString();
 return `TSh\u00A0${formatted}M`;
 }
 return formatCurrency(amount);
}

export function formatDate(dateString: string): string {
 const date = new Date(dateString);
 if (Number.isNaN(date.getTime())) return "-";

 const months = [
 "Jan",
 "Feb",
 "Mar",
 "Apr",
 "May",
 "Jun",
 "Jul",
 "Aug",
 "Sep",
 "Oct",
 "Nov",
 "Dec",
 ];
 const day = String(date.getUTCDate()).padStart(2, "0");
 const month = months[date.getUTCMonth()];
 const year = date.getUTCFullYear();

 return `${day} ${month} ${year}`;
}

/** Human-readable loan term from days (e.g. "3 months", "90 days"). */
export function formatTermDays(termDays: number): string {
 if (!termDays || termDays <= 0) return "—";
 if (termDays % 30 === 0) {
 const months = termDays / 30;
 return months === 1 ? "1 month" : `${months} months`;
 }
 return `${termDays} days`;
}

export function formatDateTime(dateString: string): string {
 const date = new Date(dateString);
 if (Number.isNaN(date.getTime())) return "-";

 const months = [
 "Jan",
 "Feb",
 "Mar",
 "Apr",
 "May",
 "Jun",
 "Jul",
 "Aug",
 "Sep",
 "Oct",
 "Nov",
 "Dec",
 ];
 const day = String(date.getUTCDate()).padStart(2, "0");
 const month = months[date.getUTCMonth()];
 const year = date.getUTCFullYear();
 const hours = String(date.getUTCHours()).padStart(2, "0");
 const minutes = String(date.getUTCMinutes()).padStart(2, "0");

 return `${day} ${month} ${year}, ${hours}:${minutes} UTC`;
}
