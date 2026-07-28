export const HIDDEN_CUSTOMERS_STORAGE_KEY = "falco.customers.hidden";

export function getHiddenCustomerIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(HIDDEN_CUSTOMERS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed
        .map((v) => String(v ?? "").trim())
        .filter(Boolean)
    );
  } catch {
    return new Set();
  }
}

export function persistHiddenCustomerIds(ids: Iterable<string>): void {
  if (typeof window === "undefined") return;
  const unique = Array.from(
    new Set(
      Array.from(ids)
        .map((id) => String(id ?? "").trim())
        .filter(Boolean)
    )
  );
  window.localStorage.setItem(HIDDEN_CUSTOMERS_STORAGE_KEY, JSON.stringify(unique));
}

export function addHiddenCustomerId(id: string): void {
  const next = getHiddenCustomerIds();
  const normalized = id.trim();
  if (!normalized) return;
  next.add(normalized);
  persistHiddenCustomerIds(next);
}

export function filterHiddenCustomers<T extends { id: string }>(customers: T[]): T[] {
  const hidden = getHiddenCustomerIds();
  if (hidden.size === 0) return customers;
  return customers.filter((customer) => !hidden.has(customer.id));
}

