import {
  customerRegistrationDisplayName,
  customerRegistrationDisplayNameFromRow,
} from "@/lib/customer-adapters";
import type { Customer, LoanGroup } from "@/lib/types";
import { parseMeetingGeoFromNotes, stripMeetingGeoFromNotes } from "@/lib/group-meeting-location";

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
 const notes = row.notes ? str(row.notes) : undefined;
 const geo =
 row.meeting_latitude != null && row.meeting_longitude != null
 ? {
 latitude: Number(row.meeting_latitude),
 longitude: Number(row.meeting_longitude),
 }
 : parseMeetingGeoFromNotes(notes);

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
 notes: notes ? stripMeetingGeoFromNotes(notes) : undefined,
 meeting_latitude: geo?.latitude ?? null,
 meeting_longitude: geo?.longitude ?? null,
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
 const nested =
 row.customer && typeof row.customer === "object"
 ? (row.customer as Record<string, unknown>)
 : null;
 const customerRef =
 typeof row.customer === "string" || typeof row.customer === "number"
 ? str(row.customer)
 : "";
 const source = nested ?? row;
 const customerName =
 customerRegistrationDisplayNameFromRow(source) ||
 customerRegistrationDisplayNameFromRow(row);

 return {
 customerId: str(
 row.customer_id ?? customerRef ?? nested?.id ?? row.id
 ).trim(),
 customerNumber: str(
 row.customer_number ?? nested?.customer_number ?? source.customer_number
 ),
 customerName,
 role: row.role ? str(row.role) : undefined,
 leftAt: row.left_at ? str(row.left_at) : null,
 riskGrade: str(row.risk_grade ?? nested?.risk_grade ?? source.risk_grade) || undefined,
 monthlyIncome:
 row.monthly_income != null
 ? Number(row.monthly_income)
 : nested?.monthly_income != null
 ? Number(nested.monthly_income)
 : source.monthly_income != null
 ? Number(source.monthly_income)
 : undefined,
 phone:
 str(
 row.phone_number ??
 row.phone_primary ??
 row.phone ??
 nested?.phone_primary ??
 nested?.phone ??
 source.phone_primary ??
 source.phone
 ) || undefined,
 nationalId: str(row.national_id ?? nested?.national_id ?? source.national_id) || undefined,
 };
}

/** Serialize enriched member rows back into API member shape for proxied responses. */
export function groupMembersToApiRows(members: GroupMemberRow[]): Record<string, unknown>[] {
 return members.map((member) => ({
 customer_id: member.customerId,
 customer_number: member.customerNumber || undefined,
 full_name: member.customerName || undefined,
 phone_primary: member.phone,
 phone: member.phone,
 national_id: member.nationalId,
 risk_grade: member.riskGrade,
 monthly_income: member.monthlyIncome,
 role: member.role,
 left_at: member.leftAt,
 }));
}

export function attachEnrichedMembersToGroupPayload(
 data: unknown,
 members: GroupMemberRow[]
): unknown {
 if (!data || typeof data !== "object") return data;
 const apiMembers = groupMembersToApiRows(members);
 const o = data as Record<string, unknown>;
 if (o.group && typeof o.group === "object") {
 return {
 ...o,
 group: { ...(o.group as Record<string, unknown>), members: apiMembers },
 };
 }
 return { ...o, members: apiMembers };
}

export function extractGroupDetail(json: unknown): GroupDetailView | null {
 if (!json || typeof json !== "object") return null;
 const o = json as Record<string, unknown>;
 const root =
 o.group && typeof o.group === "object" ? (o.group as Record<string, unknown>) : o;

 const group = adaptApiGroupRowToLoanGroup(root);
 const membersRaw = Array.isArray(root.members)
 ? root.members
 : Array.isArray(root.group_members)
 ? root.group_members
 : [];
 const members = (membersRaw as Record<string, unknown>[])
 .map(adaptMemberRow)
 .filter((m) => m.customerId && !m.leftAt);

 if (members.length === 0 && group.member_customer_ids.length > 0) {
 return {
 ...group,
 members: group.member_customer_ids.map((id) => ({
 customerId: id,
 customerNumber: "",
 customerName: "",
 })),
 };
 }

 return { ...group, members };
}

export function enrichGroupMembersWithCustomers(
 group: GroupDetailView,
 customers: Customer[]
): GroupDetailView {
 const byId = new Map(
 customers.map((customer) => [String(customer.id ?? "").trim(), customer])
 );
 const byNumber = new Map(
 customers
 .filter((customer) => customer.customer_number?.trim())
 .map((customer) => [customer.customer_number.trim(), customer])
 );

 return {
 ...group,
 members: group.members.map((member) => {
 const customer =
 byId.get(member.customerId.trim()) ??
 (member.customerNumber ? byNumber.get(member.customerNumber.trim()) : undefined);
 const registrationName = customer ? customerRegistrationDisplayName(customer) : "";
 return {
 ...member,
 customerName: registrationName || member.customerName,
 customerNumber: member.customerNumber || customer?.customer_number || "",
 phone: member.phone || customer?.phone_primary || "",
 monthlyIncome: member.monthlyIncome ?? customer?.monthly_income,
 nationalId: member.nationalId || customer?.national_id,
 riskGrade: member.riskGrade || customer?.risk_grade,
 };
 }),
 };
}
