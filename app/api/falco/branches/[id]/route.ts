import { NextResponse } from "next/server";
import { requireApiUser, ensurePathBranchIdAllowed } from "@/lib/authorization";
import { extractBranchesList, extractSingleBranch } from "@/lib/branch-adapters";
import { falcoServerFetch } from "@/lib/server-falco";

function branchKey(value: string): string {
 return value.trim().toLowerCase().replace(/^branch[-_\s]*/, "").replace(/[^a-z0-9]/g, "");
}

/** Reads branch metadata from the export payload (see `GET /branches/{branch}/export`). */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const { id } = await context.params;
 if (!id) {
 return NextResponse.json({ message: "Branch id is required" }, { status: 400 });
 }

 const denied = ensurePathBranchIdAllowed(auth.user, id);
 if (denied) return denied;

 const res = await falcoServerFetch<unknown>(`/branches/${encodeURIComponent(id)}/export`, { request });
 if (res.ok) {
 const branch = extractSingleBranch(res.data);
 if (branch) return NextResponse.json({ branch });
 }

 const listRes = await falcoServerFetch<unknown>("/branches", { request });
 if (listRes.ok) {
 const scopedKey = branchKey(id);
 const branch = extractBranchesList(listRes.data).find(
 (item) => branchKey(String(item.id)) === scopedKey || branchKey(String(item.code)) === scopedKey
 );
 if (branch) return NextResponse.json({ branch });
 }

 if (!res.ok) {
 return NextResponse.json({ message: res.error.message, details: res.error.details }, { status: res.error.status });
 }

 if (!listRes.ok) {
 return NextResponse.json(
 { message: listRes.error.message, details: listRes.error.details },
 { status: listRes.error.status }
 );
 }

 return NextResponse.json({ message: "Unexpected branch response from server" }, { status: 502 });
}

/** Proxies `PATCH /branches/{branch}` (see `backend-documentation/branches-controller.md`). */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const { id } = await context.params;
 if (!id) {
 return NextResponse.json({ message: "Branch id is required" }, { status: 400 });
 }

 const denied = ensurePathBranchIdAllowed(auth.user, id);
 if (denied) return denied;

 let body: unknown;
 try {
 body = await request.json();
 } catch {
 return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
 }

 const res = await falcoServerFetch<unknown>(`/branches/${encodeURIComponent(id)}`, {
 method: "PATCH",
 body,
 });
 if (!res.ok) {
 return NextResponse.json({ message: res.error.message, details: res.error.details }, { status: res.error.status });
 }

 const branch = extractSingleBranch(res.data);
 if (!branch) {
 return NextResponse.json({ message: "Unexpected branch update response from server" }, { status: 502 });
 }

 return NextResponse.json({ branch });
}
