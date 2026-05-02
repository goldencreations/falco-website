export type BackupStatus = "completed" | "running" | "failed";

export type BackupScope =
  | "all"
  | "customers"
  | "applications"
  | "payments"
  | "loans"
  | "users";

export type ArtifactFormat = "zip" | "folder";

export type BackupFrequency = "hourly" | "daily" | "weekly" | "monthly";

export interface BackupPoint {
  id: string;
  name: string;
  status: BackupStatus;
  scope: BackupScope[];
  artifact_format: ArtifactFormat;
  size_bytes: number;
  checksum: string;
  storage_path: string;
  started_at: string;
  completed_at: string | null;
  created_by: string;
  failure_reason: string | null;
}

export interface BackupSchedule {
  enabled: boolean;
  frequency: BackupFrequency;
  run_time_24h: string;
  day_of_week: number | null;
  day_of_month: number | null;
  retention_days: number;
  destination_mode: ArtifactFormat;
  notify_user_id: string | null;
  updated_at: string;
  updated_by: string;
}

export interface BackupRunRequest {
  scope: BackupScope[];
  artifact_format: ArtifactFormat;
  notify_user_id?: string;
}

export interface RestoreRequest {
  backup_point_id: string;
  reason: string;
}

export interface BackupAuditLog {
  id: string;
  action: "backup_created" | "restore_simulated" | "schedule_updated";
  backup_point_id?: string;
  actor_id: string;
  created_at: string;
  details: string;
}

export interface BackupFlowPoint {
  period: string;
  customers: number;
  applications: number;
  payments: number;
  disbursements: number;
  backup_size_bytes: number;
}
