import { extractCustomersList } from "@/lib/customer-adapters";
import type { Customer } from "@/lib/types";

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGES = 50;

export function extractCustomersListMeta(json: unknown): {
  page: number;
  pageSize: number;
  total: number | null;
} {
  if (!json || typeof json !== "object") {
    return { page: 1, pageSize: DEFAULT_PAGE_SIZE, total: null };
  }
  const o = json as Record<string, unknown>;
  const meta =
    o.meta && typeof o.meta === "object" ? (o.meta as Record<string, unknown>) : null;
  const page = Number(meta?.page ?? o.page ?? 1);
  const pageSize = Number(meta?.page_size ?? o.page_size ?? DEFAULT_PAGE_SIZE);
  const totalRaw = meta?.total ?? o.total;
  const total =
    totalRaw != null && Number.isFinite(Number(totalRaw)) ? Number(totalRaw) : null;
  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE,
    total,
  };
}

/** Newest registration first so recently created customers appear at the top of the list. */
export function sortCustomersNewestFirst(customers: Customer[]): Customer[] {
  return [...customers].sort((a, b) => {
    const aTime = Date.parse(a.created_at || "") || 0;
    const bTime = Date.parse(b.created_at || "") || 0;
    if (bTime !== aTime) return bTime - aTime;
    // Stable fallback for equal timestamps / missing dates.
    return String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
  });
}

export type CustomersPageResult = {
  customers: Customer[];
  page: number;
  pageSize: number;
  total: number;
};

/**
 * Loads a single page of customers (default page_size 10).
 * Prefer this for list UIs so the first paint does not wait on every page.
 */
export async function fetchCustomersPage(
  baseParams: URLSearchParams,
  options?: {
    endpoint?: string;
    page?: number;
    pageSize?: number;
    signal?: AbortSignal;
  }
): Promise<CustomersPageResult> {
  const endpoint = options?.endpoint ?? "/api/customers";
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 10;
  const params = new URLSearchParams(baseParams);
  params.set("page", String(page));
  params.set("page_size", String(pageSize));

  const res = await fetch(`${endpoint}?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
    signal: options?.signal,
  });
  const json = (await res.json().catch(() => ({}))) as {
    message?: string;
    customers?: Customer[];
    data?: unknown;
    meta?: unknown;
  };
  if (!res.ok) {
    throw new Error(
      typeof json.message === "string" ? json.message : `Failed to load customers (${res.status})`
    );
  }

  const list = Array.isArray(json.customers)
    ? json.customers
    : extractCustomersList(json);
  const meta = extractCustomersListMeta(json);
  const customers = sortCustomersNewestFirst(list);

  let total = meta.total;
  if (total == null) {
    if (customers.length < pageSize) {
      total = (page - 1) * pageSize + customers.length;
    } else {
      // Full page and no reported total — keep Next enabled until a short page.
      total = page * pageSize + 1;
    }
  }

  return {
    customers,
    page: meta.page || page,
    pageSize: meta.pageSize || pageSize,
    total,
  };
}

/**
 * Loads every page of `GET /api/customers` (backend max page_size is 100).
 * Without this, customers with id > first-page window never appear in the UI.
 */
export async function fetchAllCustomersFromApi(
  baseParams: URLSearchParams,
  options?: { endpoint?: string; pageSize?: number; signal?: AbortSignal }
): Promise<Customer[]> {
  const endpoint = options?.endpoint ?? "/api/customers";
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const byId = new Map<string, Customer>();
  let page = 1;
  let total: number | null = null;

  while (page <= MAX_PAGES) {
    const params = new URLSearchParams(baseParams);
    params.set("page", String(page));
    params.set("page_size", String(pageSize));

    const res = await fetch(`${endpoint}?${params.toString()}`, {
      credentials: "include",
      cache: "no-store",
      signal: options?.signal,
    });
    const json = (await res.json().catch(() => ({}))) as {
      message?: string;
      customers?: Customer[];
      data?: unknown;
      meta?: unknown;
    };
    if (!res.ok) {
      throw new Error(
        typeof json.message === "string" ? json.message : `Failed to load customers (${res.status})`
      );
    }

    const list = Array.isArray(json.customers)
      ? json.customers
      : extractCustomersList(json);
    let added = 0;
    for (const customer of list) {
      if (!customer?.id) continue;
      const id = String(customer.id);
      if (byId.has(id)) continue;
      byId.set(id, customer);
      added += 1;
    }

    const meta = extractCustomersListMeta(json);
    total = meta.total;
    // Stop when the page added nothing new (e.g. enriched endpoints that ignore `page`)
    // or when we've exhausted the reported total / short page.
    if (added === 0) break;
    if (list.length < pageSize) break;
    if (total != null && byId.size >= total) break;
    page += 1;
  }

  return sortCustomersNewestFirst([...byId.values()]);
}
