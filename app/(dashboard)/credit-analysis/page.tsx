"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Scale, Plus, Trash2, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  formatCurrency,
  formatDate,
  getCustomerById,
  getLoansByCustomerId,
  getProductById,
  loanApplications,
} from "@/lib/mock-data";

const creditAnalysisSections = [
  "Home",
  "Customer Info",
  "Cash Flow",
  "Balance Sheet",
  "Loan Proposal",
  "Risk Analysis",
  "Decision",
  "Credit Committee",
  "Attachments",
];

function CreditAnalysisPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("applicationId");

  const selectedApplication = useMemo(
    () => loanApplications.find((app) => app.id === applicationId),
    [applicationId]
  );
  const selectedCustomer = selectedApplication
    ? getCustomerById(selectedApplication.customer_id)
    : undefined;
  const selectedCustomerLoans = selectedCustomer ? getLoansByCustomerId(selectedCustomer.id) : [];

  const [creditScore, setCreditScore] = useState("");
  const [cashFlow, setCashFlow] = useState({
    salesRevenue: "",
    purchasesCogs: "",
    businessExpenses: "",
    existingMonthlyDebtRepayments: "",
    householdExpenses: "",
    otherIncome: "",
  });
  const [loanProposal, setLoanProposal] = useState({
    amountRequested: "",
    amountApproved: "",
    bccApprovedAmount: "",
    loanCycle: "1",
    loanOfficerName: "",
    maturityMonths: "",
    proposedInstallment: "",
    interestRate: "6.00",
    loanPurpose: "",
    totalLoans: "",
    equity: "",
    inventory: "",
    currentAssets: "",
    currentLiabilities: "",
  });
  const [risks, setRisks] = useState([
    { description: "", severity: "low", mitigationPlan: "" },
    { description: "", severity: "low", mitigationPlan: "" },
    { description: "", severity: "low", mitigationPlan: "" },
  ]);
  const [crbDetails, setCrbDetails] = useState({
    source: "",
    scoreStatus: "",
    checkDate: "",
    remarks: "",
    attachment: null as File | null,
  });
  const [committeeVotes, setCommitteeVotes] = useState([
    { memberName: "", vote: "pending", comments: "" },
  ]);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedApplication) return;
    setLoanProposal((prev) => ({
      ...prev,
      amountRequested: String(selectedApplication.requested_amount || ""),
      loanPurpose: selectedApplication.purpose || "",
    }));
  }, [selectedApplication]);

  const toNumber = (value: string) => parseFloat(value) || 0;

  const grossCashFlow = toNumber(cashFlow.salesRevenue) - toNumber(cashFlow.purchasesCogs);
  const operatingNet = grossCashFlow - toNumber(cashFlow.businessExpenses);
  const disposableIncome =
    operatingNet +
    toNumber(cashFlow.otherIncome) -
    toNumber(cashFlow.existingMonthlyDebtRepayments) -
    toNumber(cashFlow.householdExpenses);
  const repaymentCapacity = disposableIncome * 0.6;

  const amountRequested = toNumber(loanProposal.amountRequested);
  const amountApproved = toNumber(loanProposal.amountApproved);
  const proposedInstallment = toNumber(loanProposal.proposedInstallment);
  const dsr = repaymentCapacity > 0 ? proposedInstallment / repaymentCapacity : 0;
  const leverageRatio =
    toNumber(loanProposal.equity) > 0
      ? toNumber(loanProposal.totalLoans) / toNumber(loanProposal.equity)
      : 0;
  const rotationRatio =
    toNumber(loanProposal.inventory) > 0
      ? toNumber(cashFlow.salesRevenue) / toNumber(loanProposal.inventory)
      : 0;
  const liquidityRatio =
    toNumber(loanProposal.currentLiabilities) > 0
      ? toNumber(loanProposal.currentAssets) / toNumber(loanProposal.currentLiabilities)
      : toNumber(loanProposal.currentAssets) > 0
        ? 1
        : 0;

  const amountDecisionText =
    amountApproved === 0
      ? "No approved amount set"
      : amountApproved < amountRequested
        ? "Approved < Requested"
        : amountApproved > amountRequested
          ? "Approved > Requested"
          : "Approved = Requested";

  const activeLoanCount = selectedCustomerLoans.filter(
    (loan) => loan.status === "active" || loan.status === "in_arrears"
  ).length;
  const totalOutstandingBalance = selectedCustomerLoans.reduce(
    (total, loan) => total + loan.total_outstanding,
    0
  );
  const customerIncomeEstimate =
    (selectedCustomer?.monthly_income ?? 0) + (selectedCustomer?.other_income ?? 0);
  const indebtednessRatio =
    customerIncomeEstimate > 0 ? totalOutstandingBalance / customerIncomeEstimate : 0;

  const recommendationChecks = {
    repaymentCapacity: repaymentCapacity > 0,
    debtService: proposedInstallment > 0 && dsr <= 1,
    creditScore: !creditScore || Number(creditScore) >= 600,
    leverage: leverageRatio <= 3,
    liquidity: liquidityRatio >= 1,
    riskGrade: selectedCustomer ? ["A", "B", "C"].includes(selectedCustomer.risk_grade) : false,
    delinquency: activeLoanCount <= 2,
  };

  const failedRecommendationChecks = [
    !recommendationChecks.repaymentCapacity && "No repayment capacity from current cash flow",
    !recommendationChecks.debtService &&
      "Proposed installment exceeds repayment capacity (DSR above threshold)",
    !recommendationChecks.creditScore && "Credit score is below the minimum benchmark (600)",
    !recommendationChecks.leverage && "Leverage ratio is above acceptable range",
    !recommendationChecks.liquidity && "Liquidity ratio is below 1.0",
    !recommendationChecks.riskGrade && "Customer risk grade is outside policy threshold",
    !recommendationChecks.delinquency &&
      "Customer has too many active/in-arrears loans to approve safely",
  ].filter(Boolean) as string[];

  const recommendationScore =
    Object.values(recommendationChecks).filter((check) => check).length /
    Object.values(recommendationChecks).length;

  const recommendationDecision =
    failedRecommendationChecks.length === 0
      ? "Approve"
      : failedRecommendationChecks.length <= 2
        ? "Approve with Conditions"
        : "Decline";

  const committeeVoteStats = committeeVotes.reduce(
    (acc, vote) => {
      if (vote.vote === "approve") acc.approve += 1;
      if (vote.vote === "reject") acc.reject += 1;
      if (vote.vote === "abstain") acc.abstain += 1;
      return acc;
    },
    { approve: 0, reject: 0, abstain: 0 }
  );

  const committeeDecision =
    committeeVoteStats.approve > committeeVoteStats.reject
      ? "Approved by committee"
      : committeeVoteStats.reject > committeeVoteStats.approve
        ? "Rejected by committee"
        : "Pending committee decision";

  const pendingApplications = useMemo(
    () =>
      loanApplications.filter(
        (app) => app.status === "submitted" || app.status === "under_review" || app.status === "draft"
      ),
    []
  );

  const getStatusLabel = (status: string) => {
    if (status === "submitted" || status === "under_review" || status === "draft") {
      return "Pending";
    }
    return status.replaceAll("_", " ");
  };

  return (
    <>
      <DashboardHeader
        title="Credit Analysis"
        description="Review loan proposal, risks, CRB report, and committee decision"
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Loan Application for Analysis</CardTitle>
              <CardDescription>
                Click on a loan application to perform credit analysis
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Application Code</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Amount Requested (TZS)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Application Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingApplications.map((app) => {
                    const customer = getCustomerById(app.customer_id);
                    const product = getProductById(app.product_id);
                    const businessInfo = customer?.business_name || app.purpose || "-";
                    return (
                      <TableRow key={app.id}>
                        <TableCell className="font-medium">{app.application_number}</TableCell>
                        <TableCell>
                          {customer
                            ? `${customer.first_name} ${customer.middle_name ? `${customer.middle_name} ` : ""}${customer.last_name}`
                            : "-"}
                        </TableCell>
                        <TableCell>{businessInfo}</TableCell>
                        <TableCell>{product?.name || "-"}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(app.requested_amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{getStatusLabel(app.status)}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(app.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => router.push(`/credit-analysis?applicationId=${app.id}`)}
                            >
                              Analyze
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/credit-analysis?applicationId=${app.id}`)}
                            >
                              View Analyses Details
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {selectedApplication && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => router.push("/credit-analysis")}>
                Start Over
              </Button>
              <Button onClick={() => setLastSavedAt(new Date().toISOString())}>
                Save Analysis
              </Button>
              {lastSavedAt && (
                <Badge variant="outline">Saved: {formatDate(lastSavedAt)}</Badge>
              )}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Credit Analysis</CardTitle>
              <CardDescription>
                Application: {selectedApplication?.application_number ?? "N/A"} | Customer:{" "}
                {selectedCustomer
                  ? `${selectedCustomer.first_name} ${selectedCustomer.middle_name ? `${selectedCustomer.middle_name} ` : ""}${selectedCustomer.last_name}`
                  : "N/A"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {creditAnalysisSections.map((section) => (
                  <Badge key={section} variant="outline" className="text-xs">
                    {section}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedApplication && selectedCustomer && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Customer Review Snapshot</CardTitle>
                  <CardDescription>
                    Quick profile view to support loan officer analysis
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer Number</span>
                    <span>{selectedCustomer.customer_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer Type</span>
                    <span className="capitalize">{selectedCustomer.customer_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Risk Grade</span>
                    <span>{selectedCustomer.risk_grade}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Credit Score</span>
                    <span>{selectedCustomer.credit_score ?? "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimated Monthly Income</span>
                    <span>{formatCurrency(customerIncomeEstimate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active / In-Arrears Loans</span>
                    <span>{activeLoanCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Outstanding Balance</span>
                    <span>{formatCurrency(totalOutstandingBalance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Indebtedness Ratio</span>
                    <span>{indebtednessRatio.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Loan Decision Recommendation</CardTitle>
                  <CardDescription>
                    Generated from cash flow, ratios, customer profile, and repayment assumptions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <span className="text-sm text-muted-foreground">Recommendation</span>
                    <Badge
                      variant={
                        recommendationDecision === "Approve"
                          ? "default"
                          : recommendationDecision === "Approve with Conditions"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {recommendationDecision}
                    </Badge>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                    <p className="font-medium">Confidence Score</p>
                    <p className="mt-1 text-muted-foreground">
                      {(recommendationScore * 100).toFixed(0)}% checks passed
                    </p>
                  </div>
                  {failedRecommendationChecks.length > 0 ? (
                    <div className="rounded-lg border border-border p-3">
                      <p className="mb-2 text-sm font-medium">Key Risk Flags</p>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {failedRecommendationChecks.map((issue) => (
                          <li key={issue}>- {issue}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
                      All key risk checks passed for the current analysis values.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Cash Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Credit Score</FieldLabel>
                  <Input
                    type="number"
                    placeholder="e.g., 650"
                    value={creditScore}
                    onChange={(e) => setCreditScore(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>Other Income</FieldLabel>
                  <Input
                    type="number"
                    value={cashFlow.otherIncome}
                    onChange={(e) =>
                      setCashFlow((prev) => ({ ...prev, otherIncome: e.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Sales / Revenue (period)</FieldLabel>
                  <Input
                    type="number"
                    value={cashFlow.salesRevenue}
                    onChange={(e) =>
                      setCashFlow((prev) => ({ ...prev, salesRevenue: e.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Purchases / COGS</FieldLabel>
                  <Input
                    type="number"
                    value={cashFlow.purchasesCogs}
                    onChange={(e) =>
                      setCashFlow((prev) => ({ ...prev, purchasesCogs: e.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Business Expenses (operating)</FieldLabel>
                  <Input
                    type="number"
                    value={cashFlow.businessExpenses}
                    onChange={(e) =>
                      setCashFlow((prev) => ({ ...prev, businessExpenses: e.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Existing Monthly Debt Repayments</FieldLabel>
                  <Input
                    type="number"
                    value={cashFlow.existingMonthlyDebtRepayments}
                    onChange={(e) =>
                      setCashFlow((prev) => ({
                        ...prev,
                        existingMonthlyDebtRepayments: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Home / Household Expenses</FieldLabel>
                  <Input
                    type="number"
                    value={cashFlow.householdExpenses}
                    onChange={(e) =>
                      setCashFlow((prev) => ({ ...prev, householdExpenses: e.target.value }))
                    }
                  />
                </Field>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <p className="mb-3 text-sm font-semibold">Cash Flow Results</p>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gross Cash Flow (Sales - COGS)</span>
                    <span>{formatCurrency(grossCashFlow)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Operating Net (Gross - Business Expenses)</span>
                    <span>{formatCurrency(operatingNet)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Disposable Income</span>
                    <span>{formatCurrency(disposableIncome)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Repayment Capacity</span>
                    <span>{formatCurrency(repaymentCapacity)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Loan Proposal & Ratios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field>
                  <FieldLabel>Amount Requested</FieldLabel>
                  <Input
                    type="number"
                    value={loanProposal.amountRequested}
                    onChange={(e) =>
                      setLoanProposal((prev) => ({ ...prev, amountRequested: e.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Amount Approved</FieldLabel>
                  <Input
                    type="number"
                    value={loanProposal.amountApproved}
                    onChange={(e) =>
                      setLoanProposal((prev) => ({ ...prev, amountApproved: e.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>BCC Approved Amount</FieldLabel>
                  <Input
                    type="number"
                    value={loanProposal.bccApprovedAmount}
                    onChange={(e) =>
                      setLoanProposal((prev) => ({ ...prev, bccApprovedAmount: e.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Loan Cycle</FieldLabel>
                  <Input
                    type="number"
                    value={loanProposal.loanCycle}
                    onChange={(e) =>
                      setLoanProposal((prev) => ({ ...prev, loanCycle: e.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>LO Name</FieldLabel>
                  <Input
                    value={loanProposal.loanOfficerName}
                    onChange={(e) =>
                      setLoanProposal((prev) => ({ ...prev, loanOfficerName: e.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Maturity (months)</FieldLabel>
                  <Input
                    type="number"
                    value={loanProposal.maturityMonths}
                    onChange={(e) =>
                      setLoanProposal((prev) => ({ ...prev, maturityMonths: e.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Installment (proposed monthly)</FieldLabel>
                  <Input
                    type="number"
                    value={loanProposal.proposedInstallment}
                    onChange={(e) =>
                      setLoanProposal((prev) => ({
                        ...prev,
                        proposedInstallment: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Interest Rate (% per month)</FieldLabel>
                  <Input
                    type="number"
                    step="0.01"
                    value={loanProposal.interestRate}
                    onChange={(e) =>
                      setLoanProposal((prev) => ({ ...prev, interestRate: e.target.value }))
                    }
                  />
                </Field>
                <Field className="sm:col-span-2 lg:col-span-3">
                  <FieldLabel>Loan Purpose</FieldLabel>
                  <Textarea
                    rows={2}
                    value={loanProposal.loanPurpose}
                    onChange={(e) =>
                      setLoanProposal((prev) => ({ ...prev, loanPurpose: e.target.value }))
                    }
                  />
                </Field>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <p className="mb-3 text-sm font-semibold">Financial Ratios</p>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      DSR (Installment ÷ Repayment Capacity)
                    </span>
                    <span>{dsr.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Leverage Ratio (Loans ÷ Equity)</span>
                    <span>{leverageRatio.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rotation Ratio (Sales ÷ Inventory)</span>
                    <span>{rotationRatio.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Liquidity Ratio (Current Assets ÷ Current Liabilities)
                    </span>
                    <span>{liquidityRatio.toFixed(2)}</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Loans (for Leverage)</FieldLabel>
                    <Input
                      type="number"
                      value={loanProposal.totalLoans}
                      onChange={(e) =>
                        setLoanProposal((prev) => ({ ...prev, totalLoans: e.target.value }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Equity</FieldLabel>
                    <Input
                      type="number"
                      value={loanProposal.equity}
                      onChange={(e) =>
                        setLoanProposal((prev) => ({ ...prev, equity: e.target.value }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Inventory</FieldLabel>
                    <Input
                      type="number"
                      value={loanProposal.inventory}
                      onChange={(e) =>
                        setLoanProposal((prev) => ({ ...prev, inventory: e.target.value }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Current Assets</FieldLabel>
                    <Input
                      type="number"
                      value={loanProposal.currentAssets}
                      onChange={(e) =>
                        setLoanProposal((prev) => ({ ...prev, currentAssets: e.target.value }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Current Liabilities</FieldLabel>
                    <Input
                      type="number"
                      value={loanProposal.currentLiabilities}
                      onChange={(e) =>
                        setLoanProposal((prev) => ({
                          ...prev,
                          currentLiabilities: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 text-sm">
                <p className="font-semibold">Amount Requested vs Approved</p>
                <p className="mt-1 text-muted-foreground">{amountDecisionText}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk Analysis</CardTitle>
              <CardDescription>
                Capture key risks, severity, mitigation plan, and CRB / credit report details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {risks.map((risk, index) => (
                <div key={index} className="rounded-lg border border-border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold">Risk {index + 1}</p>
                    {risks.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setRisks((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field>
                      <FieldLabel>Risk Description</FieldLabel>
                      <Textarea
                        rows={2}
                        value={risk.description}
                        onChange={(e) =>
                          setRisks((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, description: e.target.value } : item
                            )
                          )
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Severity</FieldLabel>
                      <Select
                        value={risk.severity}
                        onValueChange={(value) =>
                          setRisks((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, severity: value } : item
                            )
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Mitigation Plan</FieldLabel>
                      <Textarea
                        rows={2}
                        value={risk.mitigationPlan}
                        onChange={(e) =>
                          setRisks((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, mitigationPlan: e.target.value } : item
                            )
                          )
                        }
                      />
                    </Field>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setRisks((prev) => [
                    ...prev,
                    { description: "", severity: "low", mitigationPlan: "" },
                  ])
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Risk
              </Button>

              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <p className="mb-3 text-sm font-semibold">CRB / Credit Report Details</p>
                <FieldGroup>
                  <Field>
                    <FieldLabel>CRB Source</FieldLabel>
                    <Input
                      value={crbDetails.source}
                      onChange={(e) =>
                        setCrbDetails((prev) => ({ ...prev, source: e.target.value }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>CRB Score / Status</FieldLabel>
                    <Input
                      value={crbDetails.scoreStatus}
                      onChange={(e) =>
                        setCrbDetails((prev) => ({ ...prev, scoreStatus: e.target.value }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>CRB Check Date</FieldLabel>
                    <Input
                      type="date"
                      value={crbDetails.checkDate}
                      onChange={(e) =>
                        setCrbDetails((prev) => ({ ...prev, checkDate: e.target.value }))
                      }
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel>CRB Remarks / Summary</FieldLabel>
                    <Textarea
                      rows={3}
                      value={crbDetails.remarks}
                      onChange={(e) =>
                        setCrbDetails((prev) => ({ ...prev, remarks: e.target.value }))
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel>CRB Report Attachment</FieldLabel>
                    <Input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) =>
                        setCrbDetails((prev) => ({
                          ...prev,
                          attachment: e.target.files?.[0] ?? null,
                        }))
                      }
                    />
                    {crbDetails.attachment && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Attached: {crbDetails.attachment.name}
                      </p>
                    )}
                  </Field>
                </FieldGroup>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Credit Committee</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {committeeVotes.map((vote, index) => (
                <div key={index} className="rounded-lg border border-border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold">Member Vote {index + 1}</p>
                    {committeeVotes.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setCommitteeVotes((prev) => prev.filter((_, i) => i !== index))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field>
                      <FieldLabel>Committee Member</FieldLabel>
                      <Input
                        value={vote.memberName}
                        onChange={(e) =>
                          setCommitteeVotes((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, memberName: e.target.value } : item
                            )
                          )
                        }
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Vote</FieldLabel>
                      <Select
                        value={vote.vote}
                        onValueChange={(value) =>
                          setCommitteeVotes((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, vote: value } : item))
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approve">Approve</SelectItem>
                          <SelectItem value="reject">Reject</SelectItem>
                          <SelectItem value="abstain">Abstain</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Comments</FieldLabel>
                      <Input
                        value={vote.comments}
                        onChange={(e) =>
                          setCommitteeVotes((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, comments: e.target.value } : item
                            )
                          )
                        }
                      />
                    </Field>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setCommitteeVotes((prev) => [
                    ...prev,
                    { memberName: "", vote: "pending", comments: "" },
                  ])
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Committee Member Vote
              </Button>
              <div className="rounded-lg bg-muted/40 p-4 text-sm">
                <p className="font-semibold">Committee Tally</p>
                <p className="mt-2 flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Approve: {committeeVoteStats.approve}
                </p>
                <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Reject: {committeeVoteStats.reject}
                </p>
                <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                  <MinusCircle className="h-4 w-4 text-amber-600" />
                  Abstain: {committeeVoteStats.abstain}
                </p>
                <p className="mt-2 font-medium">{committeeDecision}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

export default function CreditAnalysisPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading credit analysis...</div>}>
      <CreditAnalysisPageContent />
    </Suspense>
  );
}
