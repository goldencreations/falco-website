import type { ApplicationViewRow } from "@/lib/application-adapters";
import { extractCustomersList } from "@/lib/customer-adapters";
import { extractProductsList } from "@/lib/product-adapters";
import type { Customer, LoanProduct, RiskGrade, User, UserRole } from "@/lib/types";
import { extractUsersListPayload } from "@/lib/user-adapters";

export type ProductLookupEntry = {
 name: string;
 required_documents: string[];
};

export type CustomerLookupEntry = {
 displayName: string;
 customerNumber: string;
 searchText: string;
 assignedOfficerId?: string;
 businessName?: string;
 monthlyIncome?: number;
 riskGrade?: RiskGrade | string;
 creditScore?: number;
};

export type EnrichmentContext = {
 productMap: Map<string, ProductLookupEntry>;
 staffMap: Map<string, string>;
 customerMap: Map<string, CustomerLookupEntry>;
};

export function buildProductMap(products: LoanProduct[]): Map<string, ProductLookupEntry> {
 const map = new Map<string, ProductLookupEntry>();
 for (const p of products) {
 map.set(p.id, {
 name: p.name,
 required_documents: p.required_documents ?? [],
 });
 }
 return map;
}

export function buildStaffMap(users: User[]): Map<string, string> {
 const map = new Map<string, string>();
 for (const u of users) {
 const name = u.full_name?.trim() || u.email?.trim() || u.id;
 map.set(String(u.id), name);
 }
 return map;
}

export function buildCustomerMap(customers: Customer[]): Map<string, CustomerLookupEntry> {
 const map = new Map<string, CustomerLookupEntry>();
 for (const c of customers) {
 const displayName =
 `${c.first_name} ${c.last_name}`.trim() ||
 c.customer_number ||
 `Customer #${c.id}`;
 const customerNumber = c.customer_number || "";
 const searchText = `${c.first_name} ${c.last_name} ${c.customer_number} ${c.id}`
 .trim()
 .toLowerCase();
 const monthlyIncome =
 c.monthly_income > 0
 ? c.monthly_income + (c.other_income && c.other_income > 0 ? c.other_income : 0)
 : undefined;
 map.set(String(c.id), {
 displayName,
 customerNumber,
 searchText,
 assignedOfficerId: c.assigned_loan_officer_id?.trim() || undefined,
 businessName: c.business_name?.trim() || undefined,
 monthlyIncome,
 riskGrade: c.risk_grade,
 creditScore: c.credit_score,
 });
 }
 return map;
}

function resolveOfficerId(
 row: ApplicationViewRow,
 customer?: CustomerLookupEntry
): string | undefined {
 if (row.assigned_officer_id?.trim()) return row.assigned_officer_id.trim();
 if (customer?.assignedOfficerId?.trim()) return customer.assignedOfficerId.trim();
 const createdBy = row.created_by?.trim();
 if (createdBy && createdBy !== row.customer_id) return createdBy;
 return undefined;
}

function isPlaceholderCustomerName(name: string): boolean {
 const n = name.trim().toLowerCase();
 return !n || n === "customer";
}

export function enrichApplicationRow(
 row: ApplicationViewRow,
 ctx: EnrichmentContext
): ApplicationViewRow {
 const product = ctx.productMap.get(row.product_id);
 const customer = row.customer_id ? ctx.customerMap.get(String(row.customer_id)) : undefined;
 const officerId = resolveOfficerId(row, customer);
 const staffName = officerId ? ctx.staffMap.get(officerId) : undefined;

 const customerDisplayName = !isPlaceholderCustomerName(row.customerDisplayName)
 ? row.customerDisplayName
 : customer?.displayName ||
 (row.customer_id ? `Customer #${row.customer_id}` : "—");

 const customerNumber = row.customerNumber || customer?.customerNumber || "";
 const customerSearchText =
 row.customerSearchText ||
 customer?.searchText ||
 customerDisplayName.toLowerCase();

 const officerName =
 row.officerName?.trim() ||
 staffName ||
 (officerId ? `Officer #${officerId}` : "");

 return {
 ...row,
 customerDisplayName,
 customerNumber,
 customerSearchText,
 productName: row.productName || product?.name || (row.product_id ? `Product #${row.product_id}` : ""),
 officerName: officerName || "Unassigned",
 assigned_officer_id: officerId ?? row.assigned_officer_id,
 required_documents: product?.required_documents ?? row.required_documents,
 businessName: row.businessName || customer?.businessName || undefined,
 monthlyIncome: row.monthlyIncome ?? customer?.monthlyIncome,
 riskGrade: row.riskGrade || customer?.riskGrade,
 creditScore: row.creditScore ?? customer?.creditScore,
 };
}

export function enrichApplicationRows(
 rows: ApplicationViewRow[],
 ctx: EnrichmentContext
): ApplicationViewRow[] {
 return rows.map((row) => enrichApplicationRow(row, ctx));
}

export type ApplicationEnrichmentOptions = {
 role?: UserRole;
};

export async function fetchApplicationEnrichmentContext(
 scopeBranchId?: string | null,
 options?: ApplicationEnrichmentOptions
): Promise<EnrichmentContext> {
 const isOfficer = options?.role === "loan_officer";
 const listPageSize = isOfficer ? "80" : "150";

 const customerParams = new URLSearchParams();
 customerParams.set("page_size", listPageSize);
 if (scopeBranchId) customerParams.set("branch_id", scopeBranchId);

 const staffParams = new URLSearchParams();
 staffParams.set("page_size", isOfficer ? "40" : listPageSize);
 if (scopeBranchId) staffParams.set("branch_id", scopeBranchId);
 if (isOfficer) staffParams.set("role", "loan_officer");

 const [prodRes, staffRes, custRes] = await Promise.all([
 fetch("/api/falco/products?is_active=true", { credentials: "include" }),
 fetch(`/api/staff/directory?${staffParams.toString()}`, { credentials: "include" }),
 fetch(`/api/customers?${customerParams.toString()}`, { credentials: "include" }),
 ]);

 const products = prodRes.ok ? extractProductsList(await prodRes.json()) : [];
 const staffJson = staffRes.ok ? await staffRes.json() : {};
 const { users } = extractUsersListPayload(staffJson);
 const customers = custRes.ok ? extractCustomersList(await custRes.json()) : [];

 return {
 productMap: buildProductMap(products),
 staffMap: buildStaffMap(users),
 customerMap: buildCustomerMap(customers),
 };
}