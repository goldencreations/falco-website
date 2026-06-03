import { digitsOnly, TZ_PHONE_MAX_DIGITS } from "@/lib/tz-form-inputs";

export type LeadStatus = "new" | "follow_up" | "contacted" | "converted";
export type LeadLocationType = "home" | "work" | "sponsor";

export type LeadView = {
 id: string;
 customerId?: string;
 fullName: string;
 phoneNumber: string;
 alternatePhone?: string;
 locationType: LeadLocationType;
 locationName: string;
 region?: string;
 district?: string;
 ward?: string;
 latitude?: string;
 longitude?: string;
 notes: string;
 followUpDate?: string;
 status: LeadStatus;
 branchId?: string;
 createdBy?: string;
 createdAt: string;
 convertedAt?: string;
};

const LOC_TAG_RE = /^\[LOC:(home|work|sponsor)\]\s*/i;

export function parseLocationTypeFromNotes(notes: string): LeadLocationType {
 const m = notes.match(LOC_TAG_RE);
 if (m?.[1]) return m[1].toLowerCase() as LeadLocationType;
 return "home";
}

export function stripLocationTagFromNotes(notes: string): string {
 return notes.replace(LOC_TAG_RE, "").trim();
}

function asLeadStatus(v: string | undefined): LeadStatus {
 const s = (v ?? "new").toLowerCase();
 if (s === "follow_up" || s === "contacted" || s === "converted" || s === "new") {
 return s as LeadStatus;
 }
 return "new";
}

function str(v: unknown, fallback = ""): string {
 if (v == null) return fallback;
 return String(v);
}

export function adaptApiLeadRow(raw: Record<string, unknown>): LeadView {
 const inner =
 raw.lead && typeof raw.lead === "object" ? (raw.lead as Record<string, unknown>) : raw;
 const rawNotes = str(inner.notes);
 const locationType = parseLocationTypeFromNotes(rawNotes);
 const notes = stripLocationTagFromNotes(rawNotes);

 return {
 id: str(inner.id),
 customerId: inner.converted_customer_id ? str(inner.converted_customer_id) : undefined,
 fullName: str(inner.full_name),
 phoneNumber: str(inner.phone_number),
 alternatePhone: inner.alternate_phone ? str(inner.alternate_phone) : undefined,
 locationType,
 locationName: str(inner.location_name),
 region: inner.region ? str(inner.region) : undefined,
 district: inner.district ? str(inner.district) : undefined,
 ward: inner.ward ? str(inner.ward) : undefined,
 latitude: inner.latitude != null && String(inner.latitude).trim() ? str(inner.latitude) : undefined,
 longitude:
 inner.longitude != null && String(inner.longitude).trim() ? str(inner.longitude) : undefined,
 notes,
 followUpDate: inner.follow_up_date ? str(inner.follow_up_date) : undefined,
 status: asLeadStatus(inner.status ? str(inner.status) : undefined),
 branchId: inner.branch_id ? str(inner.branch_id) : undefined,
 createdBy: inner.created_by ? str(inner.created_by) : undefined,
 createdAt: str(inner.created_at ?? new Date().toISOString()),
 convertedAt: inner.converted_at ? str(inner.converted_at) : undefined,
 };
}

export function extractLeadsList(json: unknown): LeadView[] {
 if (!json || typeof json !== "object") return [];
 const o = json as Record<string, unknown>;
 const rows = Array.isArray(o.data) ? o.data : Array.isArray(o.leads) ? o.leads : [];
 if (!Array.isArray(rows)) return [];
 return (rows as Record<string, unknown>[]).map(adaptApiLeadRow);
}

export function extractLeadDetail(json: unknown): LeadView | null {
 if (!json || typeof json !== "object") return null;
 return adaptApiLeadRow(json as Record<string, unknown>);
}

function normalizePhone(phone: string): string {
 return digitsOnly(phone).slice(0, TZ_PHONE_MAX_DIGITS);
}

/** Map UI create form → `POST /leads` body. */
export function mapUiLeadCreateToApi(form: {
 fullName: string;
 phoneNumber: string;
 alternatePhone?: string;
 locationType: LeadLocationType;
 locationName: string;
 region?: string;
 district?: string;
 ward?: string;
 latitude?: string;
 longitude?: string;
 notes?: string;
 followUpDate?: string;
 status?: LeadStatus;
}): Record<string, unknown> {
 const locTag = `[LOC:${form.locationType}]`;
 let notes = (form.notes ?? "").trim();
 if (!notes.includes("[LOC:")) notes = notes ? `${locTag} ${notes}` : locTag;

 const locationParts = [form.locationName.trim()];
 const geo = [form.ward, form.district, form.region].filter((p) => p?.trim());
 if (geo.length) locationParts.push(geo.join(", "));

 const payload: Record<string, unknown> = {
 full_name: form.fullName.trim(),
 phone_number: normalizePhone(form.phoneNumber),
 location_name: locationParts.join(", "),
 notes: notes || undefined,
 status: form.status ?? "new",
 };

 const alt = form.alternatePhone?.trim();
 if (alt) payload.alternate_phone = normalizePhone(alt);
 if (form.followUpDate?.trim()) payload.follow_up_date = form.followUpDate.trim();

 const lat = form.latitude?.trim() ? Number(form.latitude) : NaN;
 const lng = form.longitude?.trim() ? Number(form.longitude) : NaN;
 if (!Number.isNaN(lat) && lat >= -90 && lat <= 90) payload.latitude = lat;
 if (!Number.isNaN(lng) && lng >= -180 && lng <= 180) payload.longitude = lng;

 return payload;
}

export function mapUiLeadUpdateToApi(form: Partial<{
 status: LeadStatus;
 notes: string;
 followUpDate: string;
}>): Record<string, unknown> {
 const payload: Record<string, unknown> = {};
 if (form.status) payload.status = form.status;
 if (form.notes !== undefined) payload.notes = form.notes;
 if (form.followUpDate !== undefined) payload.follow_up_date = form.followUpDate || null;
 return payload;
}
