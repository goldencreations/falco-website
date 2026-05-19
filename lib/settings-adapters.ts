import { mapApiRoleToAppRole } from "@/lib/api-roles";
import type { AppLanguage } from "@/lib/preferences";
import type { SessionUserClient } from "@/lib/use-session-user";
import type { UserRole } from "@/lib/types";

export type ProfilePreferences = {
 theme_mode: "light" | "dark" | "system";
 language: AppLanguage;
 email_alerts: boolean;
 session_lock_enabled: boolean;
};

export type OrganizationSettings = {
 default_currency: string;
 fiscal_year_end_month: number;
 business_day_cutoff_time: string;
 features: Record<string, boolean>;
 theme_mode: "light" | "dark" | "system";
 language: AppLanguage;
 mfa_enabled: boolean;
 email_alerts: boolean;
 session_lock_enabled: boolean;
};

export type SettingsBranchRow = {
 id: string;
 name: string;
 code?: string;
 region?: string;
};

const DEFAULT_PREFERENCES: ProfilePreferences = {
 theme_mode: "system",
 language: "en",
 email_alerts: true,
 session_lock_enabled: true,
};

export function parseProfileResponse(data: unknown): {
 user: SessionUserClient | null;
 preferences: ProfilePreferences;
} {
 if (!data || typeof data !== "object") {
 return { user: null, preferences: DEFAULT_PREFERENCES };
 }
 const o = data as Record<string, unknown>;
 const rawUser = o.user;
 const rawPrefs = o.preferences;

 let user: SessionUserClient | null = null;
 if (rawUser && typeof rawUser === "object") {
 const u = rawUser as Record<string, unknown>;
 const mappedRole = mapApiRoleToAppRole(String(u.role ?? ""));
 user = {
 id: String(u.id ?? ""),
 email: String(u.email ?? ""),
 full_name: String(u.full_name ?? ""),
 role: (mappedRole ?? "loan_officer") as UserRole,
 branch_id: u.branch_id != null ? String(u.branch_id) : "",
 employee_id: u.employee_id != null ? String(u.employee_id) : undefined,
 phone: u.phone != null ? String(u.phone) : undefined,
 is_active: u.is_active !== false,
 permissions: Array.isArray(u.permissions) ? (u.permissions as string[]) : undefined,
 };
 }

 const preferences = parsePreferences(rawPrefs);

 return { user, preferences };
}

export function parsePreferences(raw: unknown): ProfilePreferences {
 if (!raw || typeof raw !== "object") return DEFAULT_PREFERENCES;
 const p = raw as Record<string, unknown>;
 const lang = String(p.language ?? "en");
 return {
 theme_mode:
 p.theme_mode === "light" || p.theme_mode === "dark" ? p.theme_mode : "system",
 language: lang === "sw" ? "sw" : "en",
 email_alerts: p.email_alerts !== false,
 session_lock_enabled: p.session_lock_enabled !== false,
 };
}

export function preferencesPatchBody(prefs: ProfilePreferences): Record<string, unknown> {
 return {
 theme_mode: prefs.theme_mode,
 language: prefs.language,
 email_alerts: prefs.email_alerts,
 session_lock_enabled: prefs.session_lock_enabled,
 };
}

export function parseOrganizationSettings(data: unknown): OrganizationSettings | null {
 if (!data || typeof data !== "object") return null;
 const o = data as Record<string, unknown>;
 const inner = o.settings && typeof o.settings === "object" ? (o.settings as Record<string, unknown>) : o;
 const lang = String(inner.language ?? "en");
 return {
 default_currency: String(inner.default_currency ?? "TZS"),
 fiscal_year_end_month: Number(inner.fiscal_year_end_month ?? 12),
 business_day_cutoff_time: String(inner.business_day_cutoff_time ?? "17:00").slice(0, 5),
 features:
 inner.features && typeof inner.features === "object"
 ? (inner.features as Record<string, boolean>)
 : {},
 theme_mode:
 inner.theme_mode === "light" || inner.theme_mode === "dark" ? inner.theme_mode : "system",
 language: lang === "sw" ? "sw" : "en",
 mfa_enabled: Boolean(inner.mfa_enabled),
 email_alerts: inner.email_alerts !== false,
 session_lock_enabled: Boolean(inner.session_lock_enabled),
 };
}

export function organizationPatchBody(settings: OrganizationSettings): Record<string, unknown> {
 return {
 default_currency: settings.default_currency,
 fiscal_year_end_month: settings.fiscal_year_end_month,
 business_day_cutoff_time: settings.business_day_cutoff_time,
 features: settings.features,
 theme_mode: settings.theme_mode,
 language: settings.language,
 mfa_enabled: settings.mfa_enabled,
 email_alerts: settings.email_alerts,
 session_lock_enabled: settings.session_lock_enabled,
 };
}

export function parseSettingsBranches(data: unknown): SettingsBranchRow[] {
 if (!data || typeof data !== "object") return [];
 const o = data as Record<string, unknown>;
 const rows = Array.isArray(o.data) ? o.data : [];
 return rows
 .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
 .map((r) => ({
 id: String(r.id ?? ""),
 name: String(r.name ?? r.branch_name ?? ""),
 code:
 r.code != null
 ? String(r.code)
 : r.branch_code != null
 ? String(r.branch_code)
 : undefined,
 region: r.region != null ? String(r.region) : undefined,
 }));
}
