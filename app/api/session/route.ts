import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";

export async function GET(request: Request) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;
 return NextResponse.json({ user: auth.user });
}
