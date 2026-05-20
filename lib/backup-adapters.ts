import type { BackupFlowPoint, BackupPoint, BackupSchedule, BackupScope } from "@/lib/backup-types";

const SCOPES: Set<string> = new Set(["all", "customers", "applications", "payments", "loans", "users"]);

function asScopes(v: unknown): BackupScope[] {
 if (!Array.isArray(v)) return ["all"];
 const out = v.map((x) => String(x)).filter((s): s is BackupScope => SCOPES.has(s));
 return out.length ? out : ["all"];
}

/** Normalize a single backup row from GET /backups into our `BackupPoint` UI shape. */
export function adaptBackupPoint(row: Record<string, unknown>): BackupPoint {
 const scopeList = asScopes(row.scope ?? row.scopes);
 return {
 id: String(row.id ?? row.backup_id ?? ""),
 name: String(row.name ?? row.label ?? "Backup"),
 status: (row.status === "running" || row.status === "failed" ? row.status : "completed") as BackupPoint["status"],
 scope: scopeList.length ? scopeList : ["all"],
 artifact_format: row.artifact_format === "folder" ? "folder" : "zip",
 size_bytes: Number(row.size_bytes ?? row.size ?? 0),
 checksum: String(row.checksum ?? ""),
 storage_path: String(row.storage_path ?? row.path ?? ""),
 started_at: String(row.started_at ?? row.created_at ?? new Date().toISOString()),
 completed_at: row.completed_at != null ? String(row.completed_at) : null,
 created_by: String(row.created_by ?? row.created_by_id ?? ""),
 failure_reason: row.failure_reason != null ? String(row.failure_reason) : null,
 };
}

export function normalizeBackupsPayload(data: unknown): {
 backup_points: BackupPoint[];
 summary: { totals: Record<string, number>; total_backup_size_bytes: number };
 flow: BackupFlowPoint[];
} {
 if (!data || typeof data !== "object") {
 return {
 backup_points: [],
 summary: { totals: {}, total_backup_size_bytes: 0 },
 flow: [],
 };
 }
 const o = data as Record<string, unknown>;
 const rawPointsField = o.backup_points;
 let rawPoints: Record<string, unknown>[] = [];
 if (Array.isArray(rawPointsField)) {
 rawPoints = rawPointsField as Record<string, unknown>[];
 } else if (rawPointsField && typeof rawPointsField === "object") {
 const wrapped = rawPointsField as Record<string, unknown>;
 if (Array.isArray(wrapped.data)) rawPoints = wrapped.data as Record<string, unknown>[];
 }
 const backup_points = rawPoints.map((row) => {
 if (row.id != null || row.backup_id != null) return adaptBackupPoint(row);
 const attrs = (row as { attributes?: Record<string, unknown> }).attributes;
 return adaptBackupPoint(attrs && typeof attrs === "object" ? attrs : row);
 });

 const summaryRaw = o.summary;
 let summary: { totals: Record<string, number>; total_backup_size_bytes: number };
 if (summaryRaw && typeof summaryRaw === "object") {
 const s = summaryRaw as Record<string, unknown>;
 const totals = s.totals && typeof s.totals === "object" ? (s.totals as Record<string, number>) : {};
 summary = {
 totals,
 total_backup_size_bytes: Number(s.total_backup_size_bytes ?? s.total_size_bytes ?? 0),
 };
 } else {
 summary = { totals: {}, total_backup_size_bytes: 0 };
 }

 const flowRaw = Array.isArray(o.flow) ? (o.flow as Record<string, unknown>[]) : [];
 const flow: BackupFlowPoint[] = flowRaw.map((f) => ({
 period: String(f.period ?? f.label ?? ""),
 customers: Number(f.customers ?? 0),
 applications: Number(f.applications ?? 0),
 payments: Number(f.payments ?? 0),
 disbursements: Number(f.disbursements ?? f.disbursement_amount ?? 0),
 backup_size_bytes: Number(f.backup_size_bytes ?? f.size_bytes ?? 0),
 }));

 return { backup_points, summary, flow };
}

function normalizeTime24h(value: unknown): string {
 const s = String(value ?? "02:00");
 const match = s.match(/^(\d{1,2}):(\d{2})/);
 if (!match) return "02:00";
 return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function adaptBackupSchedule(row: Record<string, unknown>): BackupSchedule {
 return {
 enabled: Boolean(row.enabled ?? false),
 frequency: (["hourly", "daily", "weekly", "monthly"].includes(String(row.frequency))
 ? String(row.frequency)
 : "daily") as BackupSchedule["frequency"],
 run_time_24h: normalizeTime24h(row.run_time_24h),
 day_of_week: row.day_of_week != null ? Number(row.day_of_week) : null,
 day_of_month: row.day_of_month != null ? Number(row.day_of_month) : null,
 retention_days: Number(row.retention_days ?? 30),
 destination_mode: row.destination_mode === "folder" ? "folder" : "zip",
 notify_user_id: row.notify_user_id != null ? String(row.notify_user_id) : null,
 updated_at: String(row.updated_at ?? new Date().toISOString()),
 updated_by: row.updated_by != null ? String(row.updated_by) : "",
 };
}

export function normalizeSchedulePayload(data: unknown): BackupSchedule | null {
 if (!data || typeof data !== "object") return null;
 const o = data as Record<string, unknown>;
 const inner = o.schedule && typeof o.schedule === "object" ? (o.schedule as Record<string, unknown>) : o;
 return adaptBackupSchedule(inner);
}

export function schedulePatchBody(schedule: BackupSchedule): Record<string, unknown> {
 return {
 enabled: schedule.enabled,
 frequency: schedule.frequency,
 run_time_24h: schedule.run_time_24h,
 day_of_week: schedule.day_of_week,
 day_of_month: schedule.day_of_month,
 retention_days: schedule.retention_days,
 destination_mode: schedule.destination_mode,
 notify_user_id: schedule.notify_user_id ? Number(schedule.notify_user_id) : null,
 };
}
