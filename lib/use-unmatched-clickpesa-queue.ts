"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canViewUnmatchedCashbookQueue } from "@/lib/cashbook-access";
import { invalidateFetchCache } from "@/lib/client-fetch-cache";
import {
  dedupeUnmatchedFinancialEntries,
  financialEntryNeedsClassification,
} from "@/lib/financial-entry-adapters";
import { formatApiResponseError } from "@/lib/falco-api";
import { parseJsonResponse } from "@/lib/parse-json-response";
import type { FinancialEntry } from "@/lib/types";
import type { SessionUserClient } from "@/lib/use-session-user";

export type UnmatchedClickPesaQueueParams = {
  fromDate: string;
  toDate: string;
  user: SessionUserClient | null;
  /** Branch id enforced for branch-scoped roles only. */
  scopedBranchId?: string | null;
  enabled?: boolean;
};

export type UnmatchedClickPesaQueueResult = {
  entries: FinancialEntry[];
  count: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<FetchResult>;
};

type FetchResult = {
  entries: FinancialEntry[];
  error: string | null;
};

/** Drop in-memory unmatched state and cached GET responses for the queue. */
export function invalidateUnmatchedClickPesaQueueCache() {
  invalidateFetchCache("/api/financial-entries");
}

export function buildUnmatchedClickPesaQuery(params: {
  fromDate: string;
  toDate: string;
  scopedBranchId?: string | null;
  role?: string;
}): URLSearchParams {
  const search = new URLSearchParams();
  search.set("page", "1");
  search.set("page_size", "500");
  search.set("needs_classification", "1");
  search.set("source", "clickpesa");
  search.set("status", "posted");
  if (params.fromDate) search.set("from", params.fromDate);
  if (params.toDate) search.set("to", params.toDate);
  if (
    params.scopedBranchId &&
    (params.role === "branch_manager" || params.role === "loan_officer")
  ) {
    search.set("branch_id", params.scopedBranchId);
  }
  return search;
}

export async function fetchUnmatchedClickPesaQueue(
  params: UnmatchedClickPesaQueueParams
): Promise<FetchResult> {
  if (!params.user || !canViewUnmatchedCashbookQueue(params.user)) {
    return { entries: [], error: null };
  }

  const query = buildUnmatchedClickPesaQuery({
    fromDate: params.fromDate,
    toDate: params.toDate,
    scopedBranchId: params.scopedBranchId,
    role: params.user.role,
  });

  const res = await fetch(`/api/financial-entries?${query.toString()}`, { credentials: "include" });
  const { data } = await parseJsonResponse<{
    entries?: FinancialEntry[];
    data?: FinancialEntry[];
    message?: string;
  }>(res);

  if (res.status === 401) {
    return { entries: [], error: "Your session expired. Please sign in again and retry." };
  }
  if (res.status === 403) {
    return { entries: [], error: "You do not have permission to view the unmatched queue." };
  }
  if (res.status === 500) {
    return {
      entries: [],
      error: "Could not load the unmatched queue. Please retry without clearing the list.",
    };
  }
  if (!res.ok) {
    return {
      entries: [],
      error: formatApiResponseError(data, "Failed to load the unmatched queue"),
    };
  }

  const raw = data?.entries ?? data?.data ?? [];
  const needingClassification = raw.filter(financialEntryNeedsClassification);
  const entries = dedupeUnmatchedFinancialEntries(needingClassification);
  return { entries, error: null };
}

export function useUnmatchedClickPesaQueue(
  params: UnmatchedClickPesaQueueParams
): UnmatchedClickPesaQueueResult {
  const { fromDate, toDate, user, scopedBranchId, enabled = true } = params;
  const canLoad = Boolean(user && enabled && canViewUnmatchedCashbookQueue(user));

  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [loading, setLoading] = useState(canLoad);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    const nextUserId = user?.id ?? null;
    if (previousUserId.current && nextUserId !== previousUserId.current) {
      invalidateUnmatchedClickPesaQueueCache();
      setEntries([]);
      setError(null);
    }
    previousUserId.current = nextUserId;
  }, [user?.id]);

  const refresh = useCallback(async (): Promise<FetchResult> => {
    if (!canLoad || !user) {
      setEntries([]);
      setError(null);
      setLoading(false);
      return { entries: [], error: null };
    }

    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await fetchUnmatchedClickPesaQueue({
        fromDate,
        toDate,
        user,
        scopedBranchId,
        enabled,
      });
      if (id !== requestId.current) return result;

      if (result.error) {
        setError(result.error);
        return result;
      }

      setError(null);
      setEntries(result.entries);
      return result;
    } catch {
      const failure = {
        entries: [] as FinancialEntry[],
        error: "Could not load the unmatched queue. Please retry.",
      };
      if (id === requestId.current) {
        setError(failure.error);
      }
      return failure;
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [canLoad, enabled, fromDate, scopedBranchId, toDate, user]);

  useEffect(() => {
    if (!canLoad) {
      setEntries([]);
      setError(null);
      setLoading(false);
      return;
    }
    void refresh();
    // refresh identity is stable enough; date/user/branch inputs drive reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad, fromDate, toDate, user?.id, scopedBranchId]);

  return {
    entries,
    count: entries.length,
    loading,
    error,
    refresh,
  };
}
