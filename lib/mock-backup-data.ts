import { currentUser, customers, loanApplications, loans, payments, users } from "@/lib/mock-data";
import type {
  BackupAuditLog,
  BackupFlowPoint,
  BackupPoint,
  BackupRunRequest,
  BackupSchedule,
  BackupScope,
  RestoreRequest,
} from "@/lib/backup-types";

let backupPoints: BackupPoint[] = [
  {
    id: "bkp-2026-04-30-001",
    name: "Nightly Full Backup",
    status: "completed",
    scope: ["all"],
    artifact_format: "zip",
    size_bytes: 89_320_552,
    checksum: "sha256:ee8f86f1fd38167a7d64",
    storage_path: "C:/backup/falco/nightly-2026-04-30.zip",
    started_at: "2026-04-30T22:00:00.000Z",
    completed_at: "2026-04-30T22:05:23.000Z",
    created_by: "usr-001",
    failure_reason: null,
  },
  {
    id: "bkp-2026-04-29-001",
    name: "Daily Operations Backup",
    status: "completed",
    scope: ["customers", "applications", "payments"],
    artifact_format: "folder",
    size_bytes: 44_102_890,
    checksum: "sha256:81ab5482b94fd214fcd9",
    storage_path: "C:/backup/falco/daily-2026-04-29/",
    started_at: "2026-04-29T18:30:00.000Z",
    completed_at: "2026-04-29T18:33:00.000Z",
    created_by: "usr-001",
    failure_reason: null,
  },
];

let backupSchedule: BackupSchedule = {
  enabled: true,
  frequency: "daily",
  run_time_24h: "23:30",
  day_of_week: null,
  day_of_month: null,
  retention_days: 30,
  destination_mode: "zip",
  notify_user_id: "usr-001",
  updated_at: new Date().toISOString(),
  updated_by: "usr-001",
};

let backupAuditLogs: BackupAuditLog[] = [];

const flowData: BackupFlowPoint[] = [
  { period: "Nov", customers: 6, applications: 4, payments: 14, disbursements: 8_200_000, backup_size_bytes: 31_000_000 },
  { period: "Dec", customers: 7, applications: 5, payments: 18, disbursements: 10_500_000, backup_size_bytes: 36_000_000 },
  { period: "Jan", customers: 8, applications: 6, payments: 21, disbursements: 11_200_000, backup_size_bytes: 40_500_000 },
  { period: "Feb", customers: 9, applications: 7, payments: 24, disbursements: 12_000_000, backup_size_bytes: 45_700_000 },
  { period: "Mar", customers: 11, applications: 8, payments: 28, disbursements: 13_800_000, backup_size_bytes: 49_200_000 },
  { period: "Apr", customers: 12, applications: 9, payments: 33, disbursements: 14_500_000, backup_size_bytes: 53_100_000 },
];

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function listBackupPoints() {
  return [...backupPoints].sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
}

export function getBackupPointById(id: string) {
  return backupPoints.find((point) => point.id === id);
}

export function createBackupPoint(run: BackupRunRequest) {
  const now = new Date();
  const sizeBytes =
    (customers.length * 1024 * 12) +
    (loanApplications.length * 1024 * 10) +
    (payments.length * 1024 * 4) +
    (loans.length * 1024 * 8) +
    (users.length * 1024 * 2);

  const point: BackupPoint = {
    id: uid("bkp"),
    name: run.scope.includes("all") ? "Manual Full Backup" : "Manual Selective Backup",
    status: "completed",
    scope: run.scope,
    artifact_format: run.artifact_format,
    size_bytes: sizeBytes,
    checksum: `sha256:${Math.random().toString(16).slice(2, 20)}`,
    storage_path:
      run.artifact_format === "zip"
        ? `C:/backup/falco/manual-${now.toISOString().slice(0, 10)}.zip`
        : `C:/backup/falco/manual-${now.toISOString().slice(0, 10)}/`,
    started_at: now.toISOString(),
    completed_at: new Date(now.getTime() + 1000 * 10).toISOString(),
    created_by: currentUser.id,
    failure_reason: null,
  };
  backupPoints = [point, ...backupPoints];
  backupAuditLogs = [
    {
      id: uid("audit"),
      action: "backup_created",
      backup_point_id: point.id,
      actor_id: currentUser.id,
      created_at: new Date().toISOString(),
      details: `Manual backup created for scope: ${run.scope.join(", ")}`,
    },
    ...backupAuditLogs,
  ];
  return point;
}

export function simulateRestore(request: RestoreRequest) {
  const point = getBackupPointById(request.backup_point_id);
  if (!point) return null;
  const result = {
    restore_id: uid("restore"),
    backup_point_id: point.id,
    restored_scope: point.scope,
    restored_at: new Date().toISOString(),
    restored_by: currentUser.id,
    reason: request.reason,
    status: "simulated_success",
  };
  backupAuditLogs = [
    {
      id: uid("audit"),
      action: "restore_simulated",
      backup_point_id: point.id,
      actor_id: currentUser.id,
      created_at: result.restored_at,
      details: `Simulated restore completed for backup ${point.id}`,
    },
    ...backupAuditLogs,
  ];
  return result;
}

export function getBackupSchedule() {
  return backupSchedule;
}

export function updateBackupSchedule(next: Partial<BackupSchedule>) {
  backupSchedule = {
    ...backupSchedule,
    ...next,
    updated_at: new Date().toISOString(),
    updated_by: currentUser.id,
  };
  backupAuditLogs = [
    {
      id: uid("audit"),
      action: "schedule_updated",
      actor_id: currentUser.id,
      created_at: new Date().toISOString(),
      details: `Backup schedule updated to ${backupSchedule.frequency} at ${backupSchedule.run_time_24h}`,
    },
    ...backupAuditLogs,
  ];
  return backupSchedule;
}

export function listBackupFlowData() {
  return flowData;
}

export function listBackupAuditLogs() {
  return backupAuditLogs;
}

export function getScopeRows(scope: BackupScope) {
  if (scope === "customers") {
    return customers.map((item) => ({
      id: item.id,
      customer_number: item.customer_number,
      name: `${item.first_name} ${item.last_name}`,
      branch_id: item.branch_id,
      created_by: item.created_by,
      created_at: item.created_at,
    }));
  }
  if (scope === "applications") {
    return loanApplications.map((item) => ({
      id: item.id,
      application_number: item.application_number,
      customer_id: item.customer_id,
      branch_id: item.branch_id,
      amount: item.requested_amount,
      created_by: item.created_by,
      created_at: item.created_at,
    }));
  }
  if (scope === "payments") {
    return payments.map((item) => ({
      id: item.id,
      payment_number: item.payment_number,
      customer_id: item.customer_id,
      loan_id: item.loan_id,
      amount: item.amount,
      method: item.payment_method,
      received_by: item.received_by,
      payment_date: item.payment_date,
    }));
  }
  if (scope === "loans") {
    return loans.map((item) => ({
      id: item.id,
      loan_number: item.loan_number,
      customer_id: item.customer_id,
      branch_id: item.branch_id,
      principal_amount: item.principal_amount,
      total_outstanding: item.total_outstanding,
      loan_officer_id: item.loan_officer_id ?? "",
      manager_id: item.manager_id ?? "",
      disbursement_date: item.disbursement_date,
    }));
  }
  return users.map((item) => ({
    id: item.id,
    full_name: item.full_name,
    role: item.role,
    branch_id: item.branch_id,
    is_active: item.is_active,
  }));
}

export function getAllDataSummary() {
  return {
    totals: {
      customers: customers.length,
      applications: loanApplications.length,
      payments: payments.length,
      loans: loans.length,
      users: users.length,
    },
    total_backup_size_bytes: backupPoints.reduce((sum, item) => sum + item.size_bytes, 0),
  };
}
