import { NextResponse } from "next/server";
import { requireApiUser, resolvedBranchIdForListQuery } from "@/lib/authorization";
import { loadBranchCustomersEnriched } from "@/lib/customer-portfolio";

/** Branch-scoped customers with relationship manager fields for team assignment UI. */
export async function GET(request: Request) {
 const auth = await requireApiUser(request, ["branch_manager", "super_admin"]);
 if ("response" in auth) return auth.response;

 const url = new URL(request.url);
 const branch_id = resolvedBranchIdForListQuery(auth.user, url.searchParams.get("branch_id"));
 if (!branch_id) {
 return NextResponse.json({ customers: [] });
 }

 const page_size = url.searchParams.get("page_size") ?? "100";
 const customers = await loadBranchCustomersEnriched(request, branch_id, { pageSize: page_size });

 return NextResponse.json({ customers });
}
