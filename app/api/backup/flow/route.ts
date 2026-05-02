import { NextResponse } from "next/server";
import { listBackupFlowData } from "@/lib/mock-backup-data";

export async function GET() {
  return NextResponse.json({ flow: listBackupFlowData() });
}
