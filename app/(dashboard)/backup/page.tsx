"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
 CalendarClock,
 DatabaseBackup,
 Download,
 FileDown,
 HardDriveDownload,
 Play,
 RefreshCcw,
 RotateCcw,
 ShieldAlert,
} from "lucide-react";
import {
 CartesianGrid,
 Line,
 LineChart,
 ResponsiveContainer,
 Tooltip,
 XAxis,
 YAxis,
} from "recharts";
import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow,
} from "@/components/ui/table";
import { schedulePatchBody } from "@/lib/backup-adapters";
import type { BackupFlowPoint, BackupPoint, BackupSchedule, BackupScope } from "@/lib/backup-types";
import { formatApiResponseError } from "@/lib/falco-api";
import { useSessionUser } from "@/lib/use-session-user";

type PointsResponse = {
 backup_points: BackupPoint[];
 summary: { totals: Record<string, number>; total_backup_size_bytes: number };
 flow: BackupFlowPoint[];
};

const SCOPE_OPTIONS: BackupScope[] = ["all", "customers", "applications", "payments", "loans", "users"];

const DEFAULT_SCHEDULE: BackupSchedule = {
 enabled: true,
 frequency: "daily",
 run_time_24h: "23:30",
 day_of_week: null,
 day_of_month: null,
 retention_days: 30,
 destination_mode: "zip",
 notify_user_id: null,
 updated_at: new Date().toISOString(),
 updated_by: "",
};

function formatBytes(sizeBytes: number) {
 const units = ["B", "KB", "MB", "GB"];
 let value = sizeBytes;
 let unit = 0;
 while (value >= 1024 && unit < units.length - 1) {
 value /= 1024;
 unit += 1;
 }
 return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export default function BackupPage() {
 const router = useRouter();
 const { user, loaded } = useSessionUser();
 const [points, setPoints] = useState<BackupPoint[]>([]);
 const [flow, setFlow] = useState<BackupFlowPoint[]>([]);
 const [summary, setSummary] = useState<{ totals: Record<string, number>; total_backup_size_bytes: number }>({
 totals: {},
 total_backup_size_bytes: 0,
 });
 const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
 const [scope, setScope] = useState<BackupScope>("all");
 const [artifactFormat, setArtifactFormat] = useState<"zip" | "folder">("zip");
 const [restoreOpen, setRestoreOpen] = useState(false);
 const [selectedPoint, setSelectedPoint] = useState<BackupPoint | null>(null);
 const [restoreReason, setRestoreReason] = useState("");
 const [busy, setBusy] = useState(false);
 const [listError, setListError] = useState("");
 const [scheduleError, setScheduleError] = useState("");
 const [actionMessage, setActionMessage] = useState<string | null>(null);
 const [actionError, setActionError] = useState<string | null>(null);

 const canAccess = user?.role === "super_admin";

 const loadPoints = async () => {
 setListError("");
 const response = await fetch("/api/backup/points", { credentials: "include" });
 if (response.status === 401) {
 router.replace("/login");
 return;
 }
 const payload = (await response.json()) as PointsResponse & { message?: string };
 if (!response.ok) {
 setListError(typeof payload.message === "string" ? payload.message : `Could not load backups (${response.status})`);
 setPoints([]);
 setFlow([]);
 setSummary({ totals: {}, total_backup_size_bytes: 0 });
 return;
 }
 setPoints(payload.backup_points ?? []);
 setFlow(payload.flow ?? []);
 setSummary(
 payload.summary ?? {
 totals: {},
 total_backup_size_bytes: 0,
 }
 );
 };

 const loadSchedule = async () => {
 setScheduleError("");
 const response = await fetch("/api/backup/schedule", { credentials: "include" });
 if (response.status === 401) {
 router.replace("/login");
 return;
 }
 const payload = (await response.json()) as { schedule?: BackupSchedule; message?: string };
 if (!response.ok) {
 setScheduleError(typeof payload.message === "string" ? payload.message : "Could not load schedule");
 setSchedule({ ...DEFAULT_SCHEDULE });
 return;
 }
 setSchedule(payload.schedule ? { ...DEFAULT_SCHEDULE, ...payload.schedule } : { ...DEFAULT_SCHEDULE });
 };

 useEffect(() => {
 if (!loaded || !canAccess) return;
 void loadPoints();
 void loadSchedule();
 }, [loaded, canAccess]);

 const latestPoint = useMemo(() => points[0] ?? null, [points]);

 const runBackup = async () => {
 if (!user?.id) return;
 setBusy(true);
 setActionError(null);
 setActionMessage(null);
 try {
 const notifyId = Number(user.id);
 const response = await fetch("/api/backup/run", {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 scope: scope === "all" ? ["all"] : [scope],
 artifact_format: artifactFormat,
 ...(Number.isFinite(notifyId) ? { notify_user_id: notifyId } : {}),
 }),
 });
 if (response.status === 401) {
 router.replace("/login");
 return;
 }
 const payload = (await response.json().catch(() => ({}))) as {
 ok?: boolean;
 backup_point?: BackupPoint;
 message?: string;
 };
 if (!response.ok) {
 setActionError(formatApiResponseError(payload, "Backup creation failed"));
 return;
 }
 setActionMessage(
 payload.backup_point
 ? `Backup ${payload.backup_point.id} recorded (${payload.backup_point.status}).`
 : "Backup job accepted."
 );
 await loadPoints();
 } finally {
 setBusy(false);
 }
 };

 const runRestore = async () => {
 if (!selectedPoint) return;
 setBusy(true);
 setActionError(null);
 setActionMessage(null);
 try {
 const response = await fetch("/api/backup/restore", {
 method: "POST",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 backup_point_id: selectedPoint.id,
 reason: restoreReason.trim() || "Manual recovery point selected by super admin",
 }),
 });
 if (response.status === 401) {
 router.replace("/login");
 return;
 }
 const payload = (await response.json().catch(() => ({}))) as {
 ok?: boolean;
 restore_result?: { action?: string; details?: string };
 message?: string;
 };
 if (!response.ok) {
 setActionError(formatApiResponseError(payload, "Restore simulation failed"));
 return;
 }
 setRestoreOpen(false);
 setRestoreReason("");
 setSelectedPoint(null);
 setActionMessage(
 payload.restore_result?.action === "restore_simulated"
 ? `Restore simulated for backup ${selectedPoint.id}. No live data was overwritten (V1 policy).`
 : "Restore request accepted."
 );
 await loadPoints();
 } finally {
 setBusy(false);
 }
 };

 const saveSchedule = async () => {
 if (!schedule) return;
 setBusy(true);
 setActionError(null);
 try {
 const response = await fetch("/api/backup/schedule", {
 method: "PATCH",
 credentials: "include",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(schedulePatchBody(schedule)),
 });
 if (response.status === 401) {
 router.replace("/login");
 return;
 }
 const payload = (await response.json().catch(() => ({}))) as { message?: string };
 if (!response.ok) {
 setActionError(formatApiResponseError(payload, "Could not save schedule"));
 return;
 }
 setActionMessage("Backup schedule updated.");
 await loadSchedule();
 } finally {
 setBusy(false);
 }
 };

 const downloadBackup = async (id: string) => {
 setActionError(null);
 const response = await fetch(`/api/backup/download/${encodeURIComponent(id)}`, {
 credentials: "include",
 });
 if (response.status === 401) {
 router.replace("/login");
 return;
 }
 if (!response.ok) {
 const data = (await response.json().catch(() => ({}))) as { message?: string };
 setActionError(formatApiResponseError(data, "Download failed"));
 return;
 }
 const blob = await response.blob();
 const url = URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download = `backup-${id}-metadata.json`;
 a.click();
 URL.revokeObjectURL(url);
 setActionMessage(`Downloaded metadata for backup ${id}.`);
 };

 const exportCsv = async () => {
 setActionError(null);
 const params = new URLSearchParams({ format: "csv" });
 const response = await fetch(`/api/backup/export?${params.toString()}`, { credentials: "include" });
 if (response.status === 401) {
 router.replace("/login");
 return;
 }
 if (!response.ok) {
 const err = (await response.json().catch(() => ({}))) as { message?: string };
 setActionError(formatApiResponseError(err, "Export failed"));
 return;
 }
 const blob = await response.blob();
 const url = URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download = `backups-export-${Date.now()}.csv`;
 a.click();
 URL.revokeObjectURL(url);
 setActionMessage("Backup metadata CSV exported.");
 };

 if (!loaded) {
 return (
 <>
 <DashboardHeader title="Backup Management" description="Loading…" />
 <main className="flex-1 p-4 lg:p-6">
 <p className="text-sm text-muted-foreground">Loading session…</p>
 </main>
 </>
 );
 }

 if (!canAccess) {
 return (
 <>
 <DashboardHeader title="Backup Management" description="Super admin access only." />
 <main className="flex-1 p-4 lg:p-6">
 <Card className="mx-auto max-w-3xl border-destructive/30 bg-destructive/5">
 <CardHeader>
 <CardTitle className="flex items-center gap-2 text-destructive">
 <ShieldAlert className="h-5 w-5" />
 Access denied
 </CardTitle>
 <CardDescription>
 Only top admin can manually back up system data, select recovery points, and download artifacts.
 </CardDescription>
 </CardHeader>
 </Card>
 </main>
 </>
 );
 }

 return (
 <>
 <DashboardHeader
 title="Backup Management"
 description="Manual system backups, recovery points, auto-schedule, and downloadable exports."
 />
 <main className="flex-1 overflow-auto p-4 lg:p-6">
 <div className="mx-auto max-w-7xl space-y-6">
 <Card className="border-emerald-100 bg-gradient-to-r from-emerald-50 to-background">
 <CardContent className="p-4">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div>
 <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
 Top Admin Backup Console
 </p>
 <p className="text-sm text-muted-foreground">
 Back up metadata, simulate recovery, and download JSON/CSV artifacts. V1 does not overwrite live data or
 stream binary ZIP files yet.
 </p>
 <div className="mt-3 flex flex-wrap items-end gap-3">
 <div className="space-y-1">
 <Label className="text-xs">Scope</Label>
 <Select value={scope} onValueChange={(value) => setScope(value as BackupScope)}>
 <SelectTrigger className="w-[160px]">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {SCOPE_OPTIONS.map((item) => (
 <SelectItem key={item} value={item}>
 {item}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-1">
 <Label className="text-xs">Artifact format</Label>
 <Select
 value={artifactFormat}
 onValueChange={(value) => setArtifactFormat(value as "zip" | "folder")}
 >
 <SelectTrigger className="w-[140px]">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="zip">ZIP</SelectItem>
 <SelectItem value="folder">Folder</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 </div>
 <div className="flex flex-wrap gap-2">
 <Button onClick={runBackup} disabled={busy}>
 <Play className="mr-2 h-4 w-4" />
 Create Backup Now
 </Button>
 <Button
 variant="outline"
 disabled={!latestPoint}
 onClick={() => latestPoint && void downloadBackup(latestPoint.id)}
 >
 <HardDriveDownload className="mr-2 h-4 w-4" />
 Download Latest
 </Button>
 <Button variant="outline" onClick={() => void exportCsv()}>
 <FileDown className="mr-2 h-4 w-4" />
 Export CSV
 </Button>
 </div>
 </div>
 {listError ? <p className="text-sm text-destructive">{listError}</p> : null}
 {scheduleError ? <p className="text-sm text-amber-700">{scheduleError}</p> : null}
 {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
 {actionMessage ? <p className="text-sm text-emerald-700">{actionMessage}</p> : null}
 <div className="mt-4 grid gap-3 sm:grid-cols-3">
 <div className="rounded-lg border bg-background p-3">
 <p className="text-xs text-muted-foreground">Backup points</p>
 <p className="text-xl font-semibold">{points.length}</p>
 </div>
 <div className="rounded-lg border bg-background p-3">
 <p className="text-xs text-muted-foreground">Total backup size</p>
 <p className="text-xl font-semibold">{formatBytes(summary.total_backup_size_bytes)}</p>
 </div>
 <div className="rounded-lg border bg-background p-3">
 <p className="text-xs text-muted-foreground">Last backup</p>
 <p className="text-sm font-semibold">
 {latestPoint ? new Date(latestPoint.started_at).toLocaleString() : "No backup yet"}
 </p>
 </div>
 </div>
 </CardContent>
 </Card>

 <div className="grid gap-6 xl:grid-cols-3">
 <Card className="xl:col-span-2">
 <CardHeader>
 <CardTitle>Backup Data Flow</CardTitle>
 <CardDescription>Volume trend for customers, applications, payments, and disbursement amounts.</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="h-[280px]">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={flow}>
 <CartesianGrid strokeDasharray="3 3" />
 <XAxis dataKey="period" />
 <YAxis />
 <Tooltip />
 <Line type="monotone" dataKey="customers" stroke="#10b981" name="Customers" />
 <Line type="monotone" dataKey="applications" stroke="#0ea5e9" name="Applications" />
 <Line type="monotone" dataKey="payments" stroke="#f59e0b" name="Payments" />
 </LineChart>
 </ResponsiveContainer>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Auto Backup Schedule</CardTitle>
 <CardDescription>Configure periodic backup creation and destination mode.</CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="flex items-center justify-between rounded-lg border p-3">
 <div>
 <p className="text-sm font-medium">Schedule enabled</p>
 <p className="text-xs text-muted-foreground">Turn automatic backup creation on or off.</p>
 </div>
 <Button
 type="button"
 variant={schedule?.enabled ? "default" : "outline"}
 size="sm"
 onClick={() =>
 setSchedule((prev) => (prev ? { ...prev, enabled: !prev.enabled } : prev))
 }
 >
 {schedule?.enabled ? "On" : "Off"}
 </Button>
 </div>
 <div className="space-y-2">
 <Label>Frequency</Label>
 <Select
 value={schedule?.frequency ?? "daily"}
 onValueChange={(value) =>
 setSchedule((prev) => (prev ? { ...prev, frequency: value as BackupSchedule["frequency"] } : prev))
 }
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="hourly">Hourly</SelectItem>
 <SelectItem value="daily">Daily</SelectItem>
 <SelectItem value="weekly">Weekly</SelectItem>
 <SelectItem value="monthly">Monthly</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label>Run Time</Label>
 <Input
 type="time"
 value={schedule?.run_time_24h ?? "23:30"}
 onChange={(event) =>
 setSchedule((prev) => (prev ? { ...prev, run_time_24h: event.target.value } : prev))
 }
 />
 </div>
 <div className="space-y-2">
 <Label>Retention Days</Label>
 <Input
 type="number"
 min={1}
 value={schedule?.retention_days ?? 30}
 onChange={(event) =>
 setSchedule((prev) =>
 prev ? { ...prev, retention_days: Number(event.target.value || 30) } : prev
 )
 }
 />
 </div>
 <div className="space-y-2">
 <Label>Destination Mode</Label>
 <Select
 value={schedule?.destination_mode ?? "zip"}
 onValueChange={(value) =>
 setSchedule((prev) => (prev ? { ...prev, destination_mode: value as "zip" | "folder" } : prev))
 }
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="zip">Single File (ZIP)</SelectItem>
 <SelectItem value="folder">Folder Package</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <Button className="w-full" onClick={saveSchedule} disabled={busy || !schedule}>
 <CalendarClock className="mr-2 h-4 w-4" />
 Save Backup Schedule
 </Button>
 </CardContent>
 </Card>
 </div>

 <Card>
 <CardHeader>
 <CardTitle>Export Center</CardTitle>
 <CardDescription>
 Download a CSV summary of available backup points.
 </CardDescription>
 </CardHeader>
 <CardContent>
 <Button variant="outline" onClick={() => void exportCsv()}>
 <FileDown className="mr-2 h-4 w-4" />
 Download backup index (CSV)
 </Button>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Available Backup Points</CardTitle>
 <CardDescription>
 Review available backup points, download details, or run a restore check.
 </CardDescription>
 </CardHeader>
 <CardContent className="p-0">
 <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
 <Table className="min-w-[980px]">
 <TableHeader>
 <TableRow>
 <TableHead>Backup ID</TableHead>
 <TableHead>Started</TableHead>
 <TableHead>Scope</TableHead>
 <TableHead>Format</TableHead>
 <TableHead>Size</TableHead>
 <TableHead>Status</TableHead>
 <TableHead className="text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {points.length === 0 ? (
 <TableRow>
 <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
 No backup points yet. Create one to register metadata.
 </TableCell>
 </TableRow>
 ) : (
 points.map((point) => (
 <TableRow key={point.id}>
 <TableCell className="font-mono text-xs">{point.id}</TableCell>
 <TableCell>{new Date(point.started_at).toLocaleString()}</TableCell>
 <TableCell className="capitalize">{point.scope.join(", ")}</TableCell>
 <TableCell className="uppercase">{point.artifact_format}</TableCell>
 <TableCell>{formatBytes(point.size_bytes)}</TableCell>
 <TableCell>
 <Badge
 variant={
 point.status === "completed"
 ? "default"
 : point.status === "running"
 ? "secondary"
 : "destructive"
 }
 >
 {point.status}
 </Badge>
 </TableCell>
 <TableCell className="text-right">
 <div className="flex justify-end gap-2">
 <Button
 size="sm"
 variant="outline"
 onClick={() => void downloadBackup(point.id)}
 >
 <Download className="mr-1 h-3 w-3" />
 Download
 </Button>
 <Button
 size="sm"
 variant="outline"
 onClick={() => {
 setSelectedPoint(point);
 setRestoreOpen(true);
 }}
 >
 <RotateCcw className="mr-1 h-3 w-3" />
 Recovery Point
 </Button>
 </div>
 </TableCell>
 </TableRow>
 ))
 )}
 </TableBody>
 </Table>
 </div>
 </CardContent>
 </Card>
 </div>
 </main>

 <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Simulate Restore</DialogTitle>
 <DialogDescription>
 Recovery point: {selectedPoint?.id}. This checks the restore process without changing live data.
 </DialogDescription>
 </DialogHeader>
 <div className="space-y-2">
 <Label>Reason</Label>
 <Textarea
 value={restoreReason}
 onChange={(event) => setRestoreReason(event.target.value)}
 placeholder="Why this recovery point is selected."
 />
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setRestoreOpen(false)}>
 Cancel
 </Button>
 <Button onClick={runRestore} disabled={!selectedPoint || busy}>
 <RefreshCcw className="mr-2 h-4 w-4" />
 Confirm Restore Simulation
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </>
 );
}
