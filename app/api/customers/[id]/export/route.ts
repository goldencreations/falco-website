import { NextResponse } from "next/server";
import { adaptApiCustomerRowToCustomer, extractCustomerDetail } from "@/lib/customer-adapters";
import { requireApiUser, ensureResourceBranchAllowed } from "@/lib/authorization";
import { loadCustomerPortfolioData } from "@/lib/customer-portfolio-detail";
import { falcoServerFetch } from "@/lib/server-falco";
import type { Branch } from "@/lib/types";

function extractBranchesList(raw: unknown): Branch[] {
 if (Array.isArray(raw)) return raw as Branch[];
 if (raw && typeof raw === "object" && Array.isArray((raw as { branches?: Branch[] }).branches)) {
 return (raw as { branches: Branch[] }).branches;
 }
 if (raw && typeof raw === "object" && Array.isArray((raw as { data?: Branch[] }).data)) {
 return (raw as { data: Branch[] }).data;
 }
 return [];
}

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

 const custRes = await falcoServerFetch<unknown>(`/customers/${encodeURIComponent(id)}`, { request });
 if (!custRes.ok) {
 return NextResponse.json(
 { message: custRes.error.message, details: custRes.error.details },
 { status: custRes.error.status }
 );
 }

 const row = extractCustomerDetail(custRes.data);
 if (!row) {
 return NextResponse.json({ message: "Unexpected customer response from server" }, { status: 502 });
 }

 const customer = adaptApiCustomerRowToCustomer(row);
 const denied = ensureResourceBranchAllowed(auth.user, customer.branch_id);
 if (denied) return denied;
 const branchId = customer.branch_id;

 let branchName = "Unknown branch";
 const bRes = await falcoServerFetch<unknown>("/branches", { request, query: { page_size: "200" } });

 const portfolio = await loadCustomerPortfolioData(request, id, auth.user);
 const loans = portfolio.ok ? portfolio.data.loans : [];
 const payments = portfolio.ok ? portfolio.data.payments : [];
 const summary = portfolio.ok
 ? portfolio.data.summary
 : {
 total_loans: 0,
 total_borrowed: 0,
 total_paid: 0,
 total_outstanding: 0,
 total_payments: 0,
 };

 const loanNumberById = new Map(loans.map((l) => [l.id, l.loan_number]));
 if (bRes.ok) {
 const branches = extractBranchesList(bRes.data);
 const br = branches.find((b) => b.id === branchId);
 if (br) branchName = br.name;
 }

 const md =
 row.metadata && typeof row.metadata === "object" && row.metadata !== null
 ? (row.metadata as Record<string, unknown>)
 : {};
 const createdByName =
 md.created_by_name != null
 ? String(md.created_by_name)
 : md.created_by != null
 ? String(md.created_by)
 : "—";

 const fullName = [customer.first_name, customer.middle_name, customer.last_name].filter(Boolean).join(" ");

 return NextResponse.json({
 generated_at: new Date().toISOString(),
 customer: {
 customer_number: customer.customer_number,
 full_name: fullName,
 customer_type: customer.customer_type,
 national_id: customer.national_id,
 phone_primary: customer.phone_primary,
 phone_secondary: customer.phone_secondary ?? null,
 email: customer.email ?? null,
 physical_address: customer.physical_address,
 ward: customer.ward,
 district: customer.district,
 region: customer.region,
 risk_grade: customer.risk_grade,
 credit_score: customer.credit_score ?? null,
 is_blacklisted: customer.is_blacklisted,
 monthly_income: customer.monthly_income,
 branch_name: branchName,
 created_by_name: createdByName,
 created_at: customer.created_at,
 },
 summary: {
 total_loans: summary.total_loans,
 total_borrowed: summary.total_borrowed,
 total_paid: summary.total_paid,
 total_outstanding: summary.total_outstanding,
 total_payments: summary.total_payments,
 },
 loans: loans.map((loan) => ({
 loan_number: loan.loan_number,
 status: loan.status,
 product_name: loan.productName || loan.product_id,
 principal_amount: loan.principal_amount,
 total_paid: loan.total_paid,
 total_outstanding: loan.total_outstanding,
 disbursement_date: loan.disbursement_date,
 maturity_date: loan.maturity_date,
 follow_up_loan_officer: loan.loanOfficerDisplayName || "—",
 branch_manager: "—",
 })),
 payments: payments.map((payment) => ({
 payment_number: payment.payment_number,
 amount: payment.amount,
 payment_method: payment.payment_method,
 payment_status: payment.status,
 payment_date: payment.payment_date,
 received_by: payment.received_by || "—",
 loan_number: loanNumberById.get(payment.loan_id) ?? payment.loan_id,
 follow_up_loan_officer: "—",
 })),
 });
}
