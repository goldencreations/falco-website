"use client";

import { useCallback, useEffect, useState } from "react";
import { formatApiResponseError } from "@/lib/falco-api";
import {
  buildTrialBalanceUrl,
  type TrialBalanceFilters,
  type TrialBalanceReport,
  type TrialBalanceResponse,
} from "@/lib/trial-balance";

type TrialBalanceQuery = {
  report: TrialBalanceReport | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
};

export function useTrialBalanceQuery(filters: TrialBalanceFilters): TrialBalanceQuery {
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const reload = useCallback(() => setRequestVersion((version) => version + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    async function load(): Promise<void> {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(buildTrialBalanceUrl(filters), {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const json = await response.json().catch(() => null) as TrialBalanceResponse | null;
        if (!response.ok) {
          throw new Error(formatApiResponseError(json, "Unable to load the trial balance."));
        }
        if (!json?.data || !Array.isArray(json.data.rows)) {
          throw new Error("The trial balance response was incomplete.");
        }

        setReport(json.data);
      } catch (reason) {
        if (controller.signal.aborted) {
          return;
        }
        setError(reason instanceof Error ? reason.message : "Unable to load the trial balance.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [filters.from, filters.includeZeroActivity, filters.to, filters.type, requestVersion]);

  return { report, isLoading, error, reload };
}
