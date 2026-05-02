import { NextResponse } from "next/server";
import {
  branches,
  customers,
  getProductById,
  getUserById,
  loans,
  payments,
} from "@/lib/mock-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const branch = branches.find((item) => item.id === id);
  if (!branch) {
    return NextResponse.json({ message: "Branch not found" }, { status: 404 });
  }

  const manager = getUserById(branch.manager_id);
  const branchLoanOfficers = Array.from(
    new Set(
      loans
        .filter((loan) => loan.branch_id === branch.id)
        .map((loan) => loan.loan_officer_id)
        .filter(Boolean)
    )
  )
    .map((loanOfficerId) => getUserById(loanOfficerId as string))
    .filter(Boolean)
    .map((user) => ({
      id: user!.id,
      full_name: user!.full_name,
      phone: user!.phone,
      employee_id: user!.employee_id,
    }));

  const branchCustomers = customers
    .filter((customer) => customer.branch_id === branch.id)
    .map((customer) => {
      const customerLoans = loans.filter(
        (loan) => loan.branch_id === branch.id && loan.customer_id === customer.id
      );
      const customerLoanIds = new Set(customerLoans.map((loan) => loan.id));
      const customerPayments = payments.filter(
        (payment) => payment.status === "completed" && customerLoanIds.has(payment.loan_id)
      );
      const assignedLoanOfficerId = customerLoans[0]?.loan_officer_id ?? null;
      const assignedLoanOfficer = assignedLoanOfficerId
        ? getUserById(assignedLoanOfficerId)
        : null;
      return {
        customer_id: customer.id,
        customer_number: customer.customer_number,
        customer_name: `${customer.first_name} ${customer.last_name}`,
        contact_phone: customer.phone_primary,
        region: customer.region,
        district: customer.district,
        ward: customer.ward,
        assigned_loan_officer: assignedLoanOfficer
          ? {
              id: assignedLoanOfficer.id,
              full_name: assignedLoanOfficer.full_name,
              phone: assignedLoanOfficer.phone,
            }
          : null,
        total_taken: customerLoans.reduce((sum, loan) => sum + loan.principal_amount, 0),
        total_outstanding: customerLoans.reduce((sum, loan) => sum + loan.total_outstanding, 0),
        loans: customerLoans.map((loan) => ({
          loan_id: loan.id,
          loan_number: loan.loan_number,
          product_name: getProductById(loan.product_id)?.name ?? "Unknown product",
          principal_amount: loan.principal_amount,
          total_outstanding: loan.total_outstanding,
          maturity_date: loan.maturity_date,
          loan_officer_name: assignedLoanOfficer?.full_name ?? "Unassigned",
        })),
        payments: customerPayments.map((payment) => ({
          payment_number: payment.payment_number,
          amount: payment.amount,
          method: payment.payment_method,
          payment_date: payment.payment_date,
          received_by: getUserById(payment.received_by)?.full_name ?? "Unknown",
        })),
      };
    });

  const branchPayments = payments
    .filter((payment) =>
      loans.some((loan) => loan.branch_id === branch.id && loan.id === payment.loan_id)
    )
    .map((payment) => ({
      payment_number: payment.payment_number,
      customer_name:
        customers.find((customer) => customer.id === payment.customer_id)?.first_name ?? "Unknown",
      amount: payment.amount,
      status: payment.status,
      method: payment.payment_method,
      payment_date: payment.payment_date,
      received_by: getUserById(payment.received_by)?.full_name ?? "Unknown",
    }));

  const totalDisbursed = loans
    .filter((loan) => loan.branch_id === branch.id)
    .reduce((sum, loan) => sum + loan.principal_amount, 0);
  const totalOutstanding = loans
    .filter((loan) => loan.branch_id === branch.id)
    .reduce((sum, loan) => sum + loan.total_outstanding, 0);
  const totalCollected = branchPayments
    .filter((payment) => payment.status === "completed")
    .reduce((sum, payment) => sum + payment.amount, 0);

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    branch: {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      region: branch.region,
      address: branch.address,
      phone: branch.phone,
      manager: manager
        ? {
            id: manager.id,
            full_name: manager.full_name,
            phone: manager.phone,
            email: manager.email,
          }
        : null,
      loan_officers: branchLoanOfficers,
      totals: {
        customers: branchCustomers.length,
        disbursed: totalDisbursed,
        collected: totalCollected,
        outstanding: totalOutstanding,
      },
    },
    customers: branchCustomers,
    payments: branchPayments,
  });
}
