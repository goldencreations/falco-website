import { NextResponse } from "next/server";
import { listDirectoryUsers } from "@/lib/mock-user-directory";

export async function GET() {
  return NextResponse.json({ users: listDirectoryUsers() });
}
