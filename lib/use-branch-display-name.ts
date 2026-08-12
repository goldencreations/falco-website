"use client";

import { useEffect, useMemo, useState } from "react";
import { extractBranchesList } from "@/lib/branch-adapters";
import {
  isPlaceholderBranchName,
  resolveBranchDisplayName,
} from "@/lib/branch-display-name";
import { useOptionalBranchAssignment } from "@/components/branch-assignment-context";
import { useOptionalOfficerSession } from "@/components/officer-session-context";
import { useSessionUser } from "@/lib/use-session-user";
import type { Branch } from "@/lib/types";

function mergeBranchLists(...lists: Branch[][]): Branch[] {
  const byId = new Map<string, Branch>();
  for (const list of lists) {
    for (const branch of list) {
      const id = branch.id.trim();
      if (!id) continue;
      const existing = byId.get(id);
      if (!existing || (isPlaceholderBranchName(existing.name) && !isPlaceholderBranchName(branch.name))) {
        byId.set(id, branch);
      }
    }
  }
  return Array.from(byId.values());
}

export function useBranchDisplayName(): string | undefined {
  const { user: sessionUser } = useSessionUser();
  const officerUser = useOptionalOfficerSession();
  const branchCtx = useOptionalBranchAssignment();
  const [fetchedBranches, setFetchedBranches] = useState<Branch[]>([]);

  const branchId = officerUser?.branch_id?.trim() || sessionUser?.branch_id?.trim() || "";
  const sessionBranchName = officerUser?.branch_name ?? sessionUser?.branch_name;
  const contextBranches = branchCtx?.branches ?? [];
  const branches = useMemo(
    () => mergeBranchLists(contextBranches, fetchedBranches),
    [contextBranches, fetchedBranches]
  );

  const resolved = useMemo(
    () =>
      resolveBranchDisplayName({
        branchId,
        branchName: sessionBranchName,
        branches,
      }),
    [branchId, sessionBranchName, branches]
  );

  const needsFetch = Boolean(branchId) && (!resolved || isPlaceholderBranchName(resolved));

  useEffect(() => {
    if (!needsFetch) return;
    let cancelled = false;
    void fetch("/api/falco/branches", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled || !payload) return;
        const list = extractBranchesList(payload);
        if (list.length > 0) setFetchedBranches(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [needsFetch, branchId]);

  return resolved && !isPlaceholderBranchName(resolved) ? resolved : undefined;
}
