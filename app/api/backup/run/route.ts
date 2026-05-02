import { NextResponse } from "next/server";
import { createBackupPoint } from "@/lib/mock-backup-data";
import type { ArtifactFormat, BackupScope } from "@/lib/backup-types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    scope?: BackupScope[];
    artifact_format?: ArtifactFormat;
    notify_user_id?: string;
  };

  const point = createBackupPoint({
    scope: body.scope?.length ? body.scope : ["all"],
    artifact_format: body.artifact_format ?? "zip",
    notify_user_id: body.notify_user_id,
  });

  return NextResponse.json({ ok: true, backup_point: point });
}
