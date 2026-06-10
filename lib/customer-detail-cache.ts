import { adaptApiCustomerRowToCustomer, extractCustomerDetail } from "@/lib/customer-adapters";
import { invalidateFetchCache } from "@/lib/client-fetch-cache";
import type { Customer } from "@/lib/types";

const CACHE_MS = 10 * 60 * 1000;
const SESSION_PREFIX = "falco-customer-detail:";

type CacheEntry = {
  row: Record<string, unknown>;
  customer: Customer;
  expiresAt: number;
};

const memory = new Map<string, CacheEntry>();

function readSession(id: string): CacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${SESSION_PREFIX}${id}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() >= entry.expiresAt) {
      sessionStorage.removeItem(`${SESSION_PREFIX}${id}`);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function writeSession(id: string, entry: CacheEntry) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${SESSION_PREFIX}${id}`, JSON.stringify(entry));
  } catch {
    /* quota */
  }
}

export function getCachedCustomerDetail(
  id: string
): { row: Record<string, unknown>; customer: Customer } | null {
  const now = Date.now();
  const mem = memory.get(id);
  if (mem && now < mem.expiresAt) {
    return { row: mem.row, customer: mem.customer };
  }
  if (mem) memory.delete(id);

  const session = readSession(id);
  if (session) {
    memory.set(id, session);
    return { row: session.row, customer: session.customer };
  }
  return null;
}

export function setCachedCustomerDetail(
  id: string,
  row: Record<string, unknown>,
  customer: Customer
) {
  const entry: CacheEntry = { row, customer, expiresAt: Date.now() + CACHE_MS };
  memory.set(id, entry);
  writeSession(id, entry);
}

export function cacheCustomerFromApiResponse(id: string, json: unknown): boolean {
  const row = extractCustomerDetail(json);
  if (!row) return false;
  setCachedCustomerDetail(id, row, adaptApiCustomerRowToCustomer(row));
  return true;
}

export function invalidateCustomerDetailCache(id?: string) {
  if (id) {
    memory.delete(id);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(`${SESSION_PREFIX}${id}`);
      } catch {
        /* ignore */
      }
    }
    invalidateFetchCache(`/api/customers/${id}`);
    return;
  }
  memory.clear();
  if (typeof window !== "undefined") {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(SESSION_PREFIX)) sessionStorage.removeItem(key);
    }
  }
  invalidateFetchCache("/api/customers");
}
