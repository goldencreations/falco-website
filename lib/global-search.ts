export type GlobalSearchResultKind =
  | "customer"
  | "loan"
  | "application"
  | "staff"
  | "lead"
  | "group"
  | "payment";

export interface GlobalSearchResult {
  id: string;
  kind: GlobalSearchResultKind;
  title: string;
  subtitle?: string;
  /** App path without role portal prefix (e.g. `/customers/1`). */
  path: string;
}

export const GLOBAL_SEARCH_KIND_LABEL: Record<GlobalSearchResultKind, string> = {
  customer: "Customers",
  loan: "Loans",
  application: "Applications",
  staff: "Staff",
  lead: "Leads",
  group: "Vikundi",
  payment: "Payments",
};

export function globalSearchMatchesQuery(
  query: string,
  parts: Array<string | number | null | undefined>
): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return false;
  return parts.some((part) => {
    const value = String(part ?? "")
      .trim()
      .toLowerCase();
    return value.length > 0 && value.includes(needle);
  });
}
