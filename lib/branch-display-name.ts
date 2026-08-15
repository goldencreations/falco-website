import { branchMatchesScope, knownBranchNameFromCode } from "@/lib/branch-scope";
import type { Branch } from "@/lib/types";

const PLACEHOLDER_BRANCH_NAMES = new Set(["branch", "your branch"]);

/** True when a value looks like a backend branch key/slug, not a human branch name. */
export function isBranchIdentifierSlug(value: string | undefined | null): boolean {
  const v = value?.trim() ?? "";
  if (!v) return false;
  if (/^branch[-_][a-z0-9-]+$/i.test(v)) return true;
  return false;
}

/** True when a label is a generic placeholder, not a real branch name. */
export function isPlaceholderBranchName(name: string | undefined | null): boolean {
  const value = name?.trim() ?? "";
  if (!value) return true;
  if (isBranchIdentifierSlug(value)) return true;
  const lower = value.toLowerCase();
  if (PLACEHOLDER_BRANCH_NAMES.has(lower)) return true;
  if (/^branch\s+[a-z0-9][a-z0-9-]*$/i.test(value)) return true;
  return false;
}

export function findBranchForScope(
  branches: Branch[],
  scopedId: string | undefined | null
): Branch | undefined {
  const id = scopedId?.trim();
  if (!id || branches.length === 0) return undefined;

  const matches = branches.filter((branch) => branchMatchesScope(branch, id));
  const named = matches.find((branch) => branch.name?.trim() && !isPlaceholderBranchName(branch.name));
  if (named) return named;
  if (matches.length > 0) return matches[0];
  return undefined;
}

export function resolveBranchDisplayName(options: {
  branchId?: string | null;
  branchName?: string | null;
  branches?: Branch[];
}): string | undefined {
  const branchId = options.branchId?.trim() ?? "";
  const branches = options.branches ?? [];

  const scopedBranch = findBranchForScope(branches, branchId);
  if (scopedBranch?.name?.trim() && !isPlaceholderBranchName(scopedBranch.name)) {
    return scopedBranch.name.trim();
  }

  const sessionName = options.branchName?.trim();
  if (sessionName && !isPlaceholderBranchName(sessionName)) {
    return sessionName;
  }

  const known = branchId ? knownBranchNameFromCode(branchId) : null;
  if (known) return known;

  if (scopedBranch?.name?.trim()) return scopedBranch.name.trim();
  if (sessionName && !isBranchIdentifierSlug(sessionName)) return sessionName;

  return undefined;
}

/** User has a branch key on their account that does not map to any known branch record. */
export function hasOrphanBranchAssignment(options: {
  branchId?: string | null;
  branchName?: string | null;
  branches?: Branch[];
}): boolean {
  const branchId = options.branchId?.trim() ?? "";
  if (!branchId) return false;
  return !resolveBranchDisplayName(options);
}

/** Read-only session branch copy: show the resolved name and the raw `/api/me` branch_id. */
export function formatSessionBranchField(options: {
  branchId?: string | null;
  branchName?: string | null;
}): { name: string; branchId: string } {
  const branchId = options.branchId?.trim() ?? "";
  const resolvedName = options.branchName?.trim() ?? "";
  const name =
    resolvedName && !isPlaceholderBranchName(resolvedName) ? resolvedName : "";
  return { name, branchId };
}

/** Human-readable branch label for selects and read-only fields (never "Branch (branch-dom01)"). */
export function formatBranchOptionLabel(
  branch: Pick<Branch, "id" | "name" | "code">,
  allBranches: Branch[] = []
): string {
  const resolved = resolveBranchDisplayName({
    branchId: branch.id,
    branchName: branch.name,
    branches: allBranches.length > 0 ? allBranches : [branch as Branch],
  });
  if (resolved) return resolved;

  const code = branch.code?.trim();
  if (code && !isPlaceholderBranchName(code)) return code;

  return branch.id?.trim() || "Unknown branch";
}

/** Resolve branch columns in report rows; return null to drop orphan slug rows with no catalog match. */
export function resolveReportBranchFields(options: {
  branchId?: string | null;
  branchName?: string | null;
  branches: Branch[];
  /** When the API returns an orphan key like `branch-dom01`, remap onto the viewer's scoped branch. */
  fallbackBranchId?: string | null;
  fallbackBranchName?: string | null;
}): { branch_id: string; branch_name: string } | null {
  const branchId = options.branchId?.trim() ?? "";
  const branchName = options.branchName?.trim() ?? "";
  if (!branchId && !branchName) return { branch_id: "—", branch_name: "—" };

  const matched = findBranchForScope(options.branches, branchId || branchName);
  const resolved = resolveBranchDisplayName({
    branchId: branchId || matched?.id,
    branchName: branchName || matched?.name,
    branches: options.branches,
  });

  if (matched || resolved) {
    return {
      branch_id: matched?.code?.trim() || matched?.id?.trim() || branchId || "—",
      branch_name: resolved || matched?.name?.trim() || branchName || "—",
    };
  }

  const orphan =
    isBranchIdentifierSlug(branchId) ||
    isBranchIdentifierSlug(branchName) ||
    isPlaceholderBranchName(branchName);

  if (orphan && options.fallbackBranchId?.trim()) {
    const fallbackMatched = findBranchForScope(options.branches, options.fallbackBranchId);
    const fallbackName = resolveBranchDisplayName({
      branchId: options.fallbackBranchId,
      branchName: options.fallbackBranchName,
      branches: options.branches,
    });
    if (fallbackMatched || fallbackName) {
      return {
        branch_id:
          fallbackMatched?.code?.trim() ||
          fallbackMatched?.id?.trim() ||
          options.fallbackBranchId.trim(),
        branch_name:
          fallbackName ||
          options.fallbackBranchName?.trim() ||
          fallbackMatched?.name?.trim() ||
          "—",
      };
    }
  }

  // Do not surface non-existent catalog keys such as `branch-dom01`.
  if (orphan) return null;

  return {
    branch_id: branchId || "—",
    branch_name: branchName || "—",
  };
}

/** Options for customer create/edit — includes the customer's stored branch even when the id is a legacy slug. */
export function branchesForCustomerEdit(
  branches: Branch[],
  options: { lockedBranchId?: string; customerBranchId?: string }
): Branch[] {
  const locked = options.lockedBranchId?.trim() ?? "";
  const customer = options.customerBranchId?.trim() ?? "";
  const base = branches.filter(
    (branch) =>
      branch.is_active !== false && (!locked || branchMatchesScope(branch, locked))
  );

  if (!customer) return base;
  if (base.some((branch) => branchMatchesScope(branch, customer))) return base;

  const resolved = findBranchForScope(branches, customer);
  if (resolved) {
    return [
      ...base,
      {
        ...resolved,
        id: customer,
        name: formatBranchOptionLabel(resolved, branches),
        code: resolved.code || customer,
      },
    ];
  }

  const lockedBranch = locked ? findBranchForScope(branches, locked) : undefined;
  if (lockedBranch) {
    return [
      ...base,
      {
        ...lockedBranch,
        id: customer,
        name: formatBranchOptionLabel(lockedBranch, branches),
        code: lockedBranch.code || customer,
      },
    ];
  }

  const label = resolveBranchDisplayName({ branchId: customer, branches }) ?? customer;
  return [
    ...base,
    {
      id: customer,
      name: label,
      code: customer,
      region: "",
      address: "",
      phone: "",
      manager_id: "",
      is_active: true,
    },
  ];
}
