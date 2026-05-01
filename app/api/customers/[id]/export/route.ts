import { NextResponse } from "next/server";
import {
  customers,
  getBranchById,
  getLoansByCustomerId,
  getProductById,
  getUserById,
  payments,
} from "@/lib/mock-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const customer = customers.find((item) => item.id === id);

  if (!customer) {
    return NextResponse.json({ message: "Customer not found" }, { status: 404 });
  }

  const customerBranch = getBranchById(customer.branch_id);
  const createdBy = getUserById(customer.created_by);
  const customerLoans = getLoansByCustomerId(customer.id).map((loan) => {
    const product = getProductById(loan.product_id);
    const loanOfficer = loan.loan_officer_id ? getUserById(loan.loan_officer_id) : undefined;
    const manager = loan.manager_id ? getUserById(loan.manager_id) : undefined;
    return {
      id: loan.id,
      loan_number: loan.loan_number,
      status: loan.status,
      product_name: product?.name ?? "Unknown product",
      principal_amount: loan.principal_amount,
      total_paid: loan.total_paid,
      total_outstanding: loan.total_outstanding,
      disbursement_date: loan.disbursement_date,
      maturity_date: loan.maturity_date,
      follow_up_loan_officer: loanOfficer?.full_name ?? "Unassigned",
      branch_manager: manager?.full_name ?? "Unassigned",
    };
  });

  const customerPayments = payments
    .filter((payment) => payment.customer_id === customer.id)
    .map((payment) => {
      const receiver = getUserById(payment.received_by);
      const loan = customerLoans.find((item) => item.id === payment.loan_id);
      return {
        payment_number: payment.payment_number,
        amount: payment.amount,
        payment_method: payment.payment_method,
        payment_status: payment.status,
        payment_date: payment.payment_date,
        reference_number: payment.reference_number,
        principal_allocated: payment.principal_allocated,
        interest_allocated: payment.interest_allocated,
        fees_allocated: payment.fees_allocated,
        received_by: receiver?.full_name ?? "Unknown receiver",
        loan_number: loan?.loan_number ?? "Unknown loan",
        follow_up_loan_officer: loan?.follow_up_loan_officer ?? "Unassigned",
      };
    });

  const totalBorrowed = customerLoans.reduce((sum, loan) => sum + loan.principal_amount, 0);
  const totalPaid = customerLoans.reduce((sum, loan) => sum + loan.total_paid, 0);
  const totalOutstanding = customerLoans.reduce((sum, loan) => sum + loan.total_outstanding, 0);

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    customer: {
      id: customer.id,
      customer_number: customer.customer_number,
      full_name: `${customer.first_name} ${customer.middle_name ?? ""} ${customer.last_name}`.replace(
        /\s+/g,
        " "
      ),
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
      branch_name: customerBranch?.name ?? "Unknown branch",
      created_by_name: createdBy?.full_name ?? "Unknown user",
      created_at: customer.created_at,
    },
    summary: {
      total_loans: customerLoans.length,
      total_borrowed: totalBorrowed,
      total_paid: totalPaid,
      total_outstanding: totalOutstanding,
      total_payments: customerPayments.length,
    },
    loans: customerLoans,
    payments: customerPayments,
  });
}
