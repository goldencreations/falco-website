"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  DatabaseBackup,
  Download,
  FileDown,
  FileText,
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
import { currentUser } from "@/lib/mock-data";
import type { BackupFlowPoint, BackupPoint, BackupSchedule, BackupScope } from "@/lib/backup-types";

type PointsResponse = {
  backup_points: BackupPoint[];
  summary: { totals: Record<string, number>; total_backup_size_bytes: number };
  flow: BackupFlowPoint[];
};

const SCOPE_OPTIONS: BackupScope[] = ["all", "customers", "applications", "payments", "loans", "users"];

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
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [busy, setBusy] = useState(false);

  const canAccess = currentUser.role === "super_admin";

  const loadPoints = async () => {
    const response = await fetch("/api/backup/points");
    const payload = (await response.json()) as PointsResponse;
    setPoints(payload.backup_points);
    setFlow(payload.flow);
    setSummary(payload.summary);
  };

  const loadSchedule = async () => {
    const response = await fetch("/api/backup/schedule");
    const payload = (await response.json()) as { schedule: BackupSchedule };
    setSchedule(payload.schedule);
  };

  useEffect(() => {
    if (!canAccess) return;
    void loadPoints();
    void loadSchedule();
  }, [canAccess]);

  const latestPoint = useMemo(() => points[0] ?? null, [points]);

  const runBackup = async () => {
    setBusy(true);
    try {
      await fetch("/api/backup/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: scope === "all" ? ["all"] : [scope],
          artifact_format: artifactFormat,
          notify_user_id: currentUser.id,
        }),
      });
      await loadPoints();
    } finally {
      setBusy(false);
    }
  };

  const runRestore = async () => {
    if (!selectedPoint) return;
    setBusy(true);
    try {
      await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backup_point_id: selectedPoint.id,
          reason: restoreReason || "Manual recovery point selected by top admin",
        }),
      });
      setRestoreOpen(false);
      setRestoreReason("");
      setSelectedPoint(null);
      await loadPoints();
    } finally {
      setBusy(false);
    }
  };

  const saveSchedule = async () => {
    if (!schedule) return;
    setBusy(true);
    try {
      await fetch("/api/backup/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      });
      await loadSchedule();
    } finally {
      setBusy(false);
    }
  };

  const exportFile = (format: "csv" | "pdf", exportScope: BackupScope) => {
    const params = new URLSearchParams({
      format,
      scope: exportScope,
      from: fromDate,
      to: toDate,
    });
    window.location.href = `/api/backup/export?${params.toString()}`;
  };

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
                    Manually back up system data, see available backup points, choose recovery points, and download stored files.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={runBackup} disabled={busy}>
                    <Play className="mr-2 h-4 w-4" />
                    Create Backup Now
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!latestPoint}
                    onClick={() => latestPoint && (window.location.href = `/api/backup/download/${latestPoint.id}`)}
                  >
                    <HardDriveDownload className="mr-2 h-4 w-4" />
                    Download Latest
                  </Button>
                  <Button variant="outline" onClick={() => exportFile("csv", "all")}>
                    <FileDown className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                  <Button variant="outline" onClick={() => exportFile("pdf", "all")}>
                    <FileText className="mr-2 h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </div>
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
                Select category and time range. CSV and PDF are downloadable and ready for backend data sources.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-4">
                <Select value={scope} onValueChange={(value) => setScope(value as BackupScope)}>
                  <SelectTrigger>
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
                <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => exportFile("csv", scope)}>
                    CSV
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => exportFile("pdf", scope)}>
                    PDF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Available Backup Points</CardTitle>
              <CardDescription>Select and recover from backup points. Files are downloadable to local device.</CardDescription>
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
                    {points.map((point) => (
                      <TableRow key={point.id}>
                        <TableCell className="font-mono text-xs">{point.id}</TableCell>
                        <TableCell>{new Date(point.started_at).toLocaleString()}</TableCell>
                        <TableCell className="capitalize">{point.scope.join(", ")}</TableCell>
                        <TableCell className="uppercase">{point.artifact_format}</TableCell>
                        <TableCell>{formatBytes(point.size_bytes)}</TableCell>
                        <TableCell>
                          <Badge variant={point.status === "completed" ? "default" : "destructive"}>
                            {point.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => (window.location.href = `/api/backup/download/${point.id}`)}
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
                    ))}
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
              Recovery point: {selectedPoint?.id}. This is simulated now and ready for backend restore integration.
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
