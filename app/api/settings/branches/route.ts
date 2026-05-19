import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { fetchBranchesForSessionUser } from "@/lib/branch-summary-fallback";
import { parseSettingsBranches } from "@/lib/settings-adapters";
import { canViewSettingsBranches } from "@/lib/settings-permissions";
import { falcoServerFetch } from "@/lib/server-falco";

/** Proxies `GET /settings/branches` (branch-scoped for non–super-admins). */
export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 if (!canViewSettingsBranches(auth.user)) {
 return NextResponse.json({ data: [] });
 }

 const res = await falcoServerFetch<unknown>("/settings/branches", { request });
 if (!res.ok) {
 if (auth.user.role === "loan_officer" && auth.user.branch_id?.trim()) {
 const branches = await fetchBranchesForSessionUser(auth.user);
 const mine = branches.filter((b) => b.id === auth.user.branch_id.trim());
 if (mine.length) {
 return NextResponse.json({
 data: mine.map((b) => ({ id: b.id, name: b.name, code: b.code, region: b.region })),
 });
 }
 }
 return NextResponse.json(
 { message: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 let data = parseSettingsBranches(res.data);
 if (auth.user.role === "loan_officer" && auth.user.branch_id?.trim()) {
 const bid = auth.user.branch_id.trim();
 data = data.filter((b) => b.id === bid);
 if (!data.length) {
 const branches = await fetchBranchesForSessionUser(auth.user);
 const mine = branches.find((b) => b.id === bid);
 if (mine) data = [{ id: mine.id, name: mine.name, code: mine.code, region: mine.region }];
 }
 }

 return NextResponse.json({ data });
}
