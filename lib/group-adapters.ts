import type { LoanGroup } from "@/lib/types";

export type GroupMemberRow = {
 customerId: string;
 customerNumber: string;
 customerName: string;
 role?: string;
 leftAt?: string | null;
 riskGrade?: string;
 monthlyIncome?: number;
 phone?: string;
 nationalId?: string;
};

export type GroupDetailView = LoanGroup & {
 members: GroupMemberRow[];
};

function str(value: unknown, fallback = ""): string {
 if (value === null || value === undefined) return fallback;
 return String(value);
}

function memberIdsFromRow(row: Record<string, unknown>): string[] {
 if (Array.isArray(row.member_customer_ids)) {
 return row.member_customer_ids.map((id) => String(id));
 }
 if (Array.isArray(row.members)) {
 return (row.members as Record<string, unknown>[])
 .filter((m) => !m.left_at)
 .map((m) => str(m.customer_id ?? m.id))
 .filter(Boolean);
 }
 return [];
}

export function adaptApiGroupRowToLoanGroup(row: Record<string, unknown>): LoanGroup {
 const statusRaw = str(row.status, "active");
 const status =
 statusRaw === "inactive" || statusRaw === "suspended" ? statusRaw : "active";

 return {
 id: str(row.id),
 group_code: str(row.group_code),
 group_name: str(row.group_name, "Unnamed group"),
 branch_id: str(row.branch_id),
 loan_officer_id: str(row.loan_officer_id),
 chairperson_customer_id: str(row.chairperson_customer_id),
 secretary_customer_id: row.secretary_customer_id ? str(row.secretary_customer_id) : undefined,
 treasurer_customer_id: row.treasurer_customer_id ? str(row.treasurer_customer_id) : undefined,
 member_customer_ids: memberIdsFromRow(row),
 formation_date: str(row.formation_date).slice(0, 10),
 meeting_day: str(row.meeting_day),
 meeting_location: str(row.meeting_location),
 village_or_street: str(row.village_or_street),
 status,
 notes: row.notes ? str(row.notes) : undefined,
 created_at: str(row.created_at ?? new Date().toISOString()),
 updated_at: str(row.updated_at ?? row.created_at ?? new Date().toISOString()),
 };
}

export function extractGroupsList(json: unknown): LoanGroup[] {
 if (!json || typeof json !== "object") return [];
 const o = json as Record<string, unknown>;
 const rows = Array.isArray(o.data)
 ? o.data
 : Array.isArray(o.groups)
 ? o.groups
 : Array.isArray(o.items)
 ? o.items
 : [];
 return (rows as Record<string, unknown>[]).map(adaptApiGroupRowToLoanGroup);
}

function adaptMemberRow(row: Record<string, unknown>): GroupMemberRow {
 const first = str(row.first_name);
 const last = str(row.last_name);
 const full = str(row.full_name ?? row.customer_name);
 const customerName =
 full || [first, last].filter(Boolean).join(" ") || "Member";

 return {
 customerId: str(row.customer_id ?? row.id),
 customerNumber: str(row.customer_number),
 customerName,
 role: row.role ? str(row.role) : undefined,
 leftAt: row.left_at ? str(row.left_at) : null,
 riskGrade: row.risk_grade ? str(row.risk_grade) : undefined,
 monthlyIncome: row.monthly_income != null ? Number(row.monthly_income) : undefined,
 phone: str(row.phone_number ?? row.phone_primary ?? row.phone) || undefined,
 nationalId: str(row.national_id) || undefined,
 };
}

export function extractGroupDetail(json: unknown): GroupDetailView | null {
 if (!json || typeof json !== "object") return null;
 const o = json as Record<string, unknown>;
 const root =
 o.group && typeof o.group === "object" ? (o.group as Record<string, unknown>) : o;

 const group = adaptApiGroupRowToLoanGroup(root);
 const membersRaw = Array.isArray(root.members) ? root.members : [];
 const members = (membersRaw as Record<string, unknown>[])
 .map(adaptMemberRow)
 .filter((m) => m.customerId && !m.leftAt);

 if (members.length === 0 && group.member_customer_ids.length > 0) {
 return {
 ...group,
 members: group.member_customer_ids.map((id) => ({
 customerId: id,
 customerNumber: "",
 customerName: id,
 })),
 };
 }

 return { ...group, members };
}
