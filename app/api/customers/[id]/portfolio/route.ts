import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/authorization";
import { loadCustomerPortfolioData } from "@/lib/customer-portfolio-detail";

export async function GET(
 request: Request,
 context: { params: Promise<{ id: string }> }
) {
 const auth = await requireApiUser(request);
 if ("response" in auth) return auth.response;

 const { id } = await context.params;
 if (!id) {
 return NextResponse.json({ message: "Customer id is required" }, { status: 400 });
 }

 const result = await loadCustomerPortfolioData(request, id, auth.user);
 if (!result.ok) {
 return NextResponse.json({ message: result.message }, { status: result.status });
 }

 return NextResponse.json(result.data);
}
