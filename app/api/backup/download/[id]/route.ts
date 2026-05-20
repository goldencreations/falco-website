import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { normalizeBackupsPayload } from "@/lib/backup-adapters";
import { falcoServerFetch } from "@/lib/server-falco";

/** Metadata download for V1 — audits on LMS and returns a JSON artifact the browser can save. */
export async function GET(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const { id } = await context.params;
 if (!id) {
 return NextResponse.json({ message: "Backup id is required" }, { status: 400 });
 }

 const auditRes = await falcoServerFetch<unknown>(`/backups/${encodeURIComponent(id)}/download`, {
 request,
 });
 if (!auditRes.ok) {
 return NextResponse.json(
 { message: auditRes.error.message, details: auditRes.error.details },
 { status: auditRes.error.status }
 );
 }

 const listRes = await falcoServerFetch<unknown>("/backups", { request });
 if (!listRes.ok) {
 return NextResponse.json(
 { message: listRes.error.message, details: listRes.error.details },
 { status: listRes.error.status }
 );
 }

 const normalized = normalizeBackupsPayload(listRes.data);
 const point = normalized.backup_points.find((p) => p.id === id);
 if (!point) {
 return NextResponse.json({ message: "Backup point not found" }, { status: 404 });
 }

 const payload = {
 ok: true,
 artifact_type: "metadata_json_v1",
 backup_point: point,
 lms_download: auditRes.data,
 summary: normalized.summary,
 exported_at: new Date().toISOString(),
 note: "V1 stores backup metadata only. Binary ZIP/folder artifacts are not yet streamed from storage.",
 };

 const body = JSON.stringify(payload, null, 2);
 return new NextResponse(body, {
 status: 200,
 headers: {
 "Content-Type": "application/json; charset=utf-8",
 "Content-Disposition": `attachment; filename="backup-${id}-metadata.json"`,
 },
 });
}
