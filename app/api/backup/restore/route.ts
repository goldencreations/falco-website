import { NextResponse } from "next/server";
import { simulateRestore } from "@/lib/mock-backup-data";

export async function POST(request: Request) {
  const body = (await request.json()) as { backup_point_id?: string; reason?: string };
  if (!body.backup_point_id) {
    return NextResponse.json({ message: "backup_point_id is required" }, { status: 400 });
  }
  const result = simulateRestore({
    backup_point_id: body.backup_point_id,
    reason: body.reason?.trim() || "Manual recovery point selection",
  });
  if (!result) {
    return NextResponse.json({ message: "Backup point not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, restore_result: result });
}
