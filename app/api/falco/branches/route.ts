import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { extractSingleBranch } from "@/lib/branch-adapters";
import { fetchBranchesForSessionUser } from "@/lib/branch-summary-fallback";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const branches = await fetchBranchesForSessionUser(auth.user, request);
 if (!branches.length) {
 return NextResponse.json(
 { message: "No branches available for your account", branches: [] },
 { status: 200 }
 );
 }
 return NextResponse.json({ branches });
}

/** Proxies `POST /branches` (see `backend-documentation/branches-controller.md`). */
export async function POST(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 let body: unknown;
 try {
 body = await request.json();
 } catch {
 return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
 }

  const res = await falcoServerFetch<unknown>("/branches", { method: "POST", body });
 if (!res.ok) {
 console.error("[POST /api/falco/branches] backend error", {
 status: res.error.status,
 message: res.error.message,
 code: res.error.code,
 details: res.error.details,
 body,
 });
 return NextResponse.json({ message: res.error.message, details: res.error.details }, { status: res.error.status });
 }

 const branch = extractSingleBranch(res.data);
 if (!branch) {
 return NextResponse.json({ message: "Unexpected branch create response from server" }, { status: 502 });
 }

 return NextResponse.json({ branch });
}
