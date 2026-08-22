import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildManualCalculatorPreview,
  buildProductCalculatorPreview,
  type CalculatorPreviewForm,
} from "./calculator-adapters";
import type { LoanProduct } from "./types";

const baseForm: CalculatorPreviewForm = {
  mode: "manual",
  productId: "",
  principal: "",
  termDays: "",
  loanPeriodMonths: "",
  repaymentFrequency: "weekly",
  interestType: "flat_interest",
  interestRatePerMonth: "3.5",
  processingFeePercent: "20",
  insuranceFeePercent: "1",
  startDate: "2026-08-07",
};

function manualForm(overrides: Partial<CalculatorPreviewForm>): CalculatorPreviewForm {
  return { ...baseForm, ...overrides };
}

describe("buildManualCalculatorPreview", () => {
  it("matches spreadsheet row: 100,000 principal, 2 months, weekly", () => {
    const result = buildManualCalculatorPreview(
      manualForm({ principal: "100000", loanPeriodMonths: "2" })
    );
    assert.equal(result.totalRepayment, 129_400);
    assert.equal(result.repaymentCount, 8);
    assert.equal(result.installmentAmount, 16_175);
    assert.equal(Math.round(result.interestOnPrincipal ?? 0), 7_000);
    assert.equal(Math.round(result.interestOnProcessingFee ?? 0), 1_400);
    assert.equal(result.processingFee, 20_000);
    assert.equal(result.insuranceFee, 1_000);
  });

  it("matches spreadsheet row: 300,000 principal, 3 months, weekly", () => {
    const result = buildManualCalculatorPreview(
      manualForm({ principal: "300000", loanPeriodMonths: "3" })
    );
    assert.equal(result.totalRepayment, 400_800);
    assert.equal(result.repaymentCount, 12);
    assert.equal(result.installmentAmount, 33_400);
  });

  it("matches spreadsheet row: 1,000,000 principal, 3 months, weekly", () => {
    const result = buildManualCalculatorPreview(
      manualForm({ principal: "1000000", loanPeriodMonths: "3" })
    );
    assert.equal(result.totalRepayment, 1_336_000);
    assert.equal(result.repaymentCount, 12);
    assert.equal(Math.round(result.installmentAmount), 111_333);
  });

  it("uses total loan formula components correctly for 300,000", () => {
    const result = buildManualCalculatorPreview(
      manualForm({ principal: "300000", loanPeriodMonths: "3" })
    );
    const recomposed =
      result.principal +
      result.processingFee +
      (result.interestOnProcessingFee ?? 0) +
      (result.interestOnPrincipal ?? 0) +
      result.insuranceFee;
    assert.equal(recomposed, result.totalRepayment);
  });
});

describe("buildProductCalculatorPreview", () => {
  const microProduct: LoanProduct = {
    id: "micro-03",
    name: "INDIVIDUAL LOAN/MIKOPO BINAFSI (MICRO-03)",
    code: "MICRO-03",
    description: "",
    min_amount: 100_000,
    max_amount: 5_000_000,
    min_term_days: 30,
    max_term_days: 180,
    interest_rate: 72,
    interest_rate_per_month: 6,
    interest_type: "flat",
    processing_fee_percent: 21,
    insurance_fee_percent: 1,
    late_payment_fee_percent: 0,
    required_documents: [],
    allowed_risk_grades: ["A", "B", "C", "D", "E"],
    repayment_frequency: "weekly",
    grace_period_days: 0,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  it("matches manual formula for 300,000 principal and 60-day term", () => {
    const productResult = buildProductCalculatorPreview(
      manualForm({ mode: "product", principal: "300000", termDays: "60", loanPeriodMonths: "" }),
      microProduct
    );
    const manualResult = buildManualCalculatorPreview(
      manualForm({
        principal: "300000",
        loanPeriodMonths: "2",
        interestRatePerMonth: "6",
        processingFeePercent: "21",
        insuranceFeePercent: "1",
        repaymentFrequency: "weekly",
      })
    );

    assert.equal(productResult.totalRepayment, manualResult.totalRepayment);
    assert.equal(productResult.installmentAmount, manualResult.installmentAmount);
    assert.equal(productResult.repaymentCount, 8);
    assert.equal(productResult.totalRepayment, 409_560);
    assert.equal(productResult.installmentAmount, 51_195);
  });
});
