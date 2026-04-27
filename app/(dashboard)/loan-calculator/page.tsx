"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/mock-data";

export default function LoanCalculatorPage() {
  const [form, setForm] = useState({
    loanAmount: "",
    loanPeriod: "",
    repaymentFrequency: "monthly",
    interestType: "declining_balance",
    interestRatePerMonth: "",
    processingFeePercent: "",
    startDate: "",
  });

  const toNumber = (value: string) => parseFloat(value) || 0;
  const principal = toNumber(form.loanAmount);
  const periodInMonths = toNumber(form.loanPeriod);
  const monthlyRate = toNumber(form.interestRatePerMonth) / 100;
  const processingFee = principal * (toNumber(form.processingFeePercent) / 100);

  let calculation: {
    periods: number;
    totalInterest: number;
    installment: number;
    totalRepayment: number;
    firstRepaymentDate: string;
  } | null = null;

  if (principal > 0 && periodInMonths > 0 && monthlyRate >= 0) {
    const frequencyMultiplier = form.repaymentFrequency === "weekly" ? 4 : 1;
    const periods = Math.max(1, Math.round(periodInMonths * frequencyMultiplier));
    const periodicRate = form.repaymentFrequency === "weekly" ? monthlyRate / 4 : monthlyRate;

    let totalInterest = 0;
    let installment = 0;
    if (form.interestType === "flat_interest") {
      totalInterest = principal * monthlyRate * periodInMonths;
      installment = (principal + totalInterest) / periods;
    } else if (periodicRate === 0) {
      installment = principal / periods;
    } else {
      installment =
        (principal * periodicRate) / (1 - Math.pow(1 + periodicRate, -periods));
      totalInterest = installment * periods - principal;
    }

    const totalRepayment = principal + totalInterest + processingFee;
    const firstRepaymentDate = form.startDate
      ? new Date(
          new Date(form.startDate).getTime() +
            (form.repaymentFrequency === "weekly" ? 7 : 30) * 24 * 60 * 60 * 1000
        ).toISOString().slice(0, 10)
      : "";

    calculation = { periods, totalInterest, installment, totalRepayment, firstRepaymentDate };
  }

  return (
    <>
      <DashboardHeader
        title="Loan Calculator"
        description="Standalone loan repayment calculator"
      />
      <main className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Loan Terms Input
              </CardTitle>
              <CardDescription>
                Fill details to calculate installment amount and total repayment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel>Loan Amount (TZS)</FieldLabel>
                  <Input
                    type="number"
                    value={form.loanAmount}
                    onChange={(e) => setForm((prev) => ({ ...prev, loanAmount: e.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel>Loan Period (Months)</FieldLabel>
                  <Input
                    type="number"
                    value={form.loanPeriod}
                    onChange={(e) => setForm((prev) => ({ ...prev, loanPeriod: e.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel>Repayment Frequency</FieldLabel>
                  <Select
                    value={form.repaymentFrequency}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, repaymentFrequency: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Interest Type</FieldLabel>
                  <Select
                    value={form.interestType}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, interestType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="declining_balance">Declining Balance</SelectItem>
                      <SelectItem value="flat_interest">Flat Interest</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Interest Rate (% per month)</FieldLabel>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.interestRatePerMonth}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, interestRatePerMonth: e.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Processing Fee (%)</FieldLabel>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.processingFeePercent}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, processingFeePercent: e.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Start Date</FieldLabel>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Calculation Result</CardTitle>
            </CardHeader>
            <CardContent>
              {calculation ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Installments</span>
                    <span>{calculation.periods}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Interest</span>
                    <span>{formatCurrency(calculation.totalInterest)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Processing Fee</span>
                    <span>{formatCurrency(processingFee)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-medium">Installment Amount</span>
                    <span className="font-semibold">{formatCurrency(calculation.installment)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Total Repayment</span>
                    <span className="font-semibold text-primary">
                      {formatCurrency(calculation.totalRepayment)}
                    </span>
                  </div>
                  {calculation.firstRepaymentDate && (
                    <p className="text-xs text-muted-foreground">
                      First repayment date: {calculation.firstRepaymentDate}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Fill all required values to see the loan calculation.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
