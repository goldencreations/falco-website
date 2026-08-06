import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paymentMethodLabel, paymentSourceLabel } from "./payment-method-display";

describe("paymentMethodLabel", () => {
  it("formats known mobile money providers", () => {
    assert.equal(paymentMethodLabel({ mobile_money_provider: "TIGO-PESA" }), "Tigo Pesa");
    assert.equal(paymentMethodLabel({ mobile_money_provider: "M-PESA" }), "M-Pesa");
    assert.equal(paymentMethodLabel({ mobile_money_provider: "MPESA" }), "M-Pesa");
    assert.equal(paymentMethodLabel({ mobile_money_provider: "AIRTEL-MONEY" }), "Airtel Money");
    assert.equal(paymentMethodLabel({ mobile_money_provider: "HALOPESA" }), "HaloPesa");
    assert.equal(paymentMethodLabel({ mobile_money_provider: "NMB" }), "NMB");
    assert.equal(paymentMethodLabel({ mobile_money_provider: "CRDB" }), "CRDB");
  });

  it("shows unknown providers as returned by the backend", () => {
    assert.equal(paymentMethodLabel({ mobile_money_provider: "NEW-WALLET" }), "NEW-WALLET");
  });

  it("falls back to formatted payment_method when provider is missing", () => {
    assert.equal(paymentMethodLabel({ payment_method: "cash" }), "Cash");
    assert.equal(paymentMethodLabel({ payment_method: "gateway" }), "Gateway");
    assert.equal(paymentMethodLabel({ payment_method: "bank_transfer" }), "Bank transfer");
    assert.equal(paymentMethodLabel({ payment_method: "mobile_money" }), "Mobile money");
  });

  it("prefers provider over broad payment_method", () => {
    assert.equal(
      paymentMethodLabel({
        payment_method: "gateway",
        mobile_money_provider: "TIGO-PESA",
      }),
      "Tigo Pesa"
    );
  });

  it("returns Unknown when nothing is available", () => {
    assert.equal(paymentMethodLabel({}), "Unknown");
  });
});

describe("paymentSourceLabel", () => {
  it("labels webhook and reconciliation sources as Automatic", () => {
    assert.equal(paymentSourceLabel({ source: "clickpesa_webhook" }), "Automatic");
    assert.equal(paymentSourceLabel({ source: "webhook" }), "Automatic");
    assert.equal(paymentSourceLabel({ source: "gateway_reconciliation" }), "Automatic");
    assert.equal(
      paymentSourceLabel({ metadata: { source: "clickpesa_webhook" } }),
      "Automatic"
    );
  });

  it("labels staff-entered rows as Manual", () => {
    assert.equal(paymentSourceLabel({ source: "manual" }), "Manual");
    assert.equal(paymentSourceLabel({ payment_method: "cash" }), "Manual");
    assert.equal(paymentSourceLabel({}), "Manual");
  });
});

describe("method and source together", () => {
  it("shows Automatic Tigo Pesa without Gateway (Auto)", () => {
    const payment = {
      payment_method: "gateway",
      mobile_money_provider: "TIGO-PESA",
      source: "clickpesa_webhook",
    };
    assert.equal(paymentMethodLabel(payment), "Tigo Pesa");
    assert.equal(paymentSourceLabel(payment), "Automatic");
  });

  it("shows Manual cash", () => {
    const payment = { payment_method: "cash", source: "manual" };
    assert.equal(paymentMethodLabel(payment), "Cash");
    assert.equal(paymentSourceLabel(payment), "Manual");
  });

  it("shows Gateway + Automatic when provider is missing", () => {
    const payment = { payment_method: "gateway", source: "clickpesa_webhook" };
    assert.equal(paymentMethodLabel(payment), "Gateway");
    assert.equal(paymentSourceLabel(payment), "Automatic");
  });
});
