import { NextResponse } from "next/server";
import { getCustomersWithAssignments } from "@/lib/mock-customer-assignment";

export async function GET() {
  return NextResponse.json({ customers: getCustomersWithAssignments() });
}
