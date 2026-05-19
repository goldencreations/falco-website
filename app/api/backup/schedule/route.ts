import { NextResponse } from "next/server";
import type { BackupSchedule } from "@/lib/backup-types";
import { normalizeSchedulePayload, schedulePatchBody } from "@/lib/backup-adapters";
import { requireApiUser } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

const DEFAULT_SCHEDULE: BackupSchedule = {
 enabled: false,
 frequency: "daily",
 run_time_24h: "02:00",
 day_of_week: null,
 day_of_month: null,
 retention_days: 30,
 destination_mode: "zip",
 notify_user_id: null,
 updated_at: new Date().toISOString(),
 updated_by: "",
};

function wrapSchedule(data: unknown): { schedule: BackupSchedule } {
 return { schedule: normalizeSchedulePayload(data) ?? DEFAULT_SCHEDULE };
}

/** Proxies `GET /backups/schedule`. */
export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const res = await falcoServerFetch<unknown>("/backups/schedule", { request });
 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 try {
 return NextResponse.json(wrapSchedule(res.data));
 } catch {
 return NextResponse.json({ message: "Unexpected schedule response from server" }, { status: 502 });
 }
}

/** Proxies `PATCH /backups/schedule`. */
export async function PATCH(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 let body: Record<string, unknown>;
 try {
 body = (await request.json()) as Record<string, unknown>;
 } catch {
 return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
 }

 const res = await falcoServerFetch<unknown>("/backups/schedule", {
 method: "PATCH",
 body: schedulePatchBody(body as unknown as BackupSchedule),
 request,
 });

 if (!res.ok) {
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 try {
 return NextResponse.json(wrapSchedule(res.data));
 } catch {
 return NextResponse.json({ message: "Unexpected schedule response from server" }, { status: 502 });
 }
}

/** Legacy `POST` forwards as `PATCH /backups/schedule`. */
export async function POST(request: Request) {
 return PATCH(request);
}
