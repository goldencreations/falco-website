import { NextResponse } from "next/server";
import { getBackupPointById } from "@/lib/mock-backup-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const point = getBackupPointById(id);
  if (!point) {
    return NextResponse.json({ message: "Backup point not found" }, { status: 404 });
  }

  const content = JSON.stringify(
    {
      backup_id: point.id,
      scope: point.scope,
      created_at: point.started_at,
      completed_at: point.completed_at,
      artifact_format: point.artifact_format,
      storage_path: point.storage_path,
      checksum: point.checksum,
    },
    null,
    2
  );
  const ext = point.artifact_format === "zip" ? "zip.json" : "folder.json";
  return new NextResponse(content, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${point.id}.${ext}"`,
    },
  });
}
