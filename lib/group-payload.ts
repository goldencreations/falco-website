/** Build `POST /groups` body per `backend-documentation/groups-controller.md`. */

import { encodeMeetingGeoInNotes } from "@/lib/group-meeting-location";

export type GroupCreateForm = {
 group_name: string;
 group_code: string;
 branch_id: string;
 loan_officer_id: string;
 chairperson_customer_id: string;
 secretary_customer_id: string;
 treasurer_customer_id: string;
 member_customer_ids: string[];
 formation_date: string;
 meeting_day: string;
 meeting_location: string;
 village_or_street: string;
 meeting_latitude: number | null;
 meeting_longitude: number | null;
 status: "active" | "inactive" | "suspended";
 notes: string;
};

function coerceForm(input: GroupCreateForm | Record<string, unknown>): GroupCreateForm {
 const row = input as Record<string, unknown>;
 return {
 group_name: String(row.group_name ?? ""),
 group_code: String(row.group_code ?? ""),
 branch_id: String(row.branch_id ?? ""),
 loan_officer_id: String(row.loan_officer_id ?? ""),
 chairperson_customer_id: String(row.chairperson_customer_id ?? ""),
 secretary_customer_id: String(row.secretary_customer_id ?? ""),
 treasurer_customer_id: String(row.treasurer_customer_id ?? ""),
 member_customer_ids: Array.isArray(row.member_customer_ids)
 ? row.member_customer_ids.map((id) => String(id))
 : [],
 formation_date: String(row.formation_date ?? ""),
 meeting_day: String(row.meeting_day ?? ""),
 meeting_location: String(row.meeting_location ?? ""),
 village_or_street: String(row.village_or_street ?? ""),
 meeting_latitude: (() => {
 const value = row.meeting_latitude;
 if (value == null || value === "") return null;
 const n = Number(value);
 return Number.isFinite(n) ? n : null;
 })(),
 meeting_longitude: (() => {
 const value = row.meeting_longitude;
 if (value == null || value === "") return null;
 const n = Number(value);
 return Number.isFinite(n) ? n : null;
 })(),
 status:
 row.status === "inactive" || row.status === "suspended" ? row.status : "active",
 notes: String(row.notes ?? ""),
 };
}

export function mapFormToGroupApi(input: GroupCreateForm | Record<string, unknown>): Record<string, unknown> {
 const form = coerceForm(input);
 const members = Array.from(
 new Set(
 [
 form.chairperson_customer_id,
 form.secretary_customer_id,
 form.treasurer_customer_id,
 ...form.member_customer_ids,
 ]
 .map((id) => id.trim())
 .filter(Boolean)
 )
 );

 const body: Record<string, unknown> = {
 group_name: form.group_name.trim(),
 loan_officer_id: form.loan_officer_id.trim(),
 chairperson_customer_id: form.chairperson_customer_id.trim(),
 formation_date: form.formation_date,
 meeting_day: form.meeting_day.trim(),
 meeting_location: form.meeting_location.trim(),
 village_or_street: form.village_or_street.trim(),
 status: form.status,
 member_customer_ids: members,
 };

 if (form.group_code.trim()) body.group_code = form.group_code.trim();
 if (form.branch_id.trim()) body.branch_id = form.branch_id.trim();
 if (form.secretary_customer_id.trim()) {
 body.secretary_customer_id = form.secretary_customer_id.trim();
 }
 if (form.treasurer_customer_id.trim()) {
 body.treasurer_customer_id = form.treasurer_customer_id.trim();
 }
 const notesWithGeo = encodeMeetingGeoInNotes(
 form.notes,
 form.meeting_latitude,
 form.meeting_longitude
 );
 if (notesWithGeo.trim()) body.notes = notesWithGeo.trim();

 return body;
}
