import type { ApplicationViewRow } from "@/lib/application-adapters";
import { invalidateFetchCache } from "@/lib/client-fetch-cache";

const CACHE_MS = 10 * 60 * 1000;
const SESSION_PREFIX = "falco-app-detail:";

type CacheEntry = {
  application: ApplicationViewRow;
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

export function getCachedApplicationDetail(id: string): ApplicationViewRow | null {
  const now = Date.now();
  const mem = memory.get(id);
  if (mem && now < mem.expiresAt) return mem.application;
  if (mem) memory.delete(id);

  const session = readSession(id);
  if (session) {
    memory.set(id, session);
    return session.application;
  }
  return null;
}

export function setCachedApplicationDetail(id: string, application: ApplicationViewRow) {
  const entry: CacheEntry = {
    application,
    expiresAt: Date.now() + CACHE_MS,
  };
  memory.set(id, entry);
  writeSession(id, entry);
}

export function invalidateApplicationDetailCache(id?: string) {
  if (id) {
    memory.delete(id);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(`${SESSION_PREFIX}${id}`);
      } catch {
        /* ignore */
      }
    }
    invalidateFetchCache(`/api/applications/${id}`);
    return;
  }
  memory.clear();
  if (typeof window !== "undefined") {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(SESSION_PREFIX)) sessionStorage.removeItem(key);
    }
  }
  invalidateFetchCache("/api/applications");
}
