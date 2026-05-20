import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { falcoServerFetch } from "@/lib/server-falco";

export async function GET(request: Request) {
 const auth = await requireApiUser(request, ["branch_manager", "super_admin"]);
 if ("response" in auth) return auth.response;
 const user = auth.user;

 const res = await falcoServerFetch<unknown>("/users/access-requests", {});
 if (!res.ok) {
 return NextResponse.json(
 { error: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }

 const data = res.data as { data?: unknown[]; requests?: unknown[] };
 const requests = Array.isArray(data.data) ? data.data : data.requests ?? [];
 if (user.role === "branch_manager") {
 return NextResponse.json({
 requests: requests.filter(
 (r) =>
 typeof r === "object" &&
 r !== null &&
 "requested_by" in r &&
 String((r as { requested_by: string }).requested_by) === user.id
 ),
 });
 }
 return NextResponse.json({ requests });
}

export async function POST(request: Request) {
 const auth = await requireApiUser(request, ["branch_manager"]);
 if ("response" in auth) return auth.response;

 const body = (await request.json()) as Record<string, unknown>;
 const res = await falcoServerFetch<unknown>("/users/access-requests", {
 method: "POST",
 body,
 });

 if (!res.ok) {
 return NextResponse.json(
 { error: res.error.message, details: res.error.details },
 { status: res.error.status }
 );
 }
 return NextResponse.json(res.data);
}
