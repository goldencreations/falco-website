import { NextResponse } from "next/server";
import { getBackupSchedule, updateBackupSchedule } from "@/lib/mock-backup-data";
import type { ArtifactFormat, BackupFrequency } from "@/lib/backup-types";

export async function GET() {
  return NextResponse.json({ schedule: getBackupSchedule() });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    enabled?: boolean;
    frequency?: BackupFrequency;
    run_time_24h?: string;
    day_of_week?: number | null;
    day_of_month?: number | null;
    retention_days?: number;
    destination_mode?: ArtifactFormat;
    notify_user_id?: string | null;
  };
  const schedule = updateBackupSchedule(body);
  return NextResponse.json({ ok: true, schedule });
}
