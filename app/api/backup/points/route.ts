import { NextResponse } from "next/server";
import { getAllDataSummary, listBackupFlowData, listBackupPoints } from "@/lib/mock-backup-data";

export async function GET() {
  return NextResponse.json({
    backup_points: listBackupPoints(),
    summary: getAllDataSummary(),
    flow: listBackupFlowData(),
  });
}
