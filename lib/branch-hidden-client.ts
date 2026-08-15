export const HIDDEN_BRANCHES_STORAGE_KEY = "falco.branches.hidden";

export function getHiddenBranchIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(HIDDEN_BRANCHES_STORAGE_KEY);
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

export function persistHiddenBranchIds(ids: Iterable<string>): void {
  if (typeof window === "undefined") return;
  const unique = Array.from(
    new Set(
      Array.from(ids)
        .map((id) => String(id ?? "").trim())
        .filter(Boolean)
    )
  );
  window.localStorage.setItem(HIDDEN_BRANCHES_STORAGE_KEY, JSON.stringify(unique));
}

export function addHiddenBranchId(id: string): void {
  const next = getHiddenBranchIds();
  const normalized = id.trim();
  if (!normalized) return;
  next.add(normalized);
  persistHiddenBranchIds(next);
}

export function filterHiddenBranches<T extends { id: string }>(branches: T[]): T[] {
  const hidden = getHiddenBranchIds();
  if (hidden.size === 0) return branches;
  return branches.filter((branch) => !hidden.has(branch.id));
}
