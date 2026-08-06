export type PaymentLike = {
  payment_method?: string | null;
  mobile_money_provider?: string | null;
  source?: string | null;
  metadata?: {
    source?: string | null;
    [key: string]: unknown;
  } | null;
};

const providerLabels: Record<string, string> = {
  "TIGO-PESA": "Tigo Pesa",
  TIGOPESA: "Tigo Pesa",
  YAS: "Yas",
  "M-PESA": "M-Pesa",
  MPESA: "M-Pesa",
  "AIRTEL-MONEY": "Airtel Money",
  "AIRTEL MONEY": "Airtel Money",
  HALOPESA: "HaloPesa",
  "HALO-PESA": "HaloPesa",
  NMB: "NMB",
  CRDB: "CRDB",
};

const methodLabels: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  mobile_money: "Mobile money",
  cheque: "Cheque",
  gateway: "Gateway",
};

const AUTOMATIC_SOURCES = new Set(["clickpesa_webhook", "webhook", "gateway_reconciliation"]);

/** Real provider/channel label — never "Gateway (Auto)". */
export function paymentMethodLabel(payment: PaymentLike): string {
  const provider = payment.mobile_money_provider?.trim();

  if (provider) {
    return providerLabels[provider.toUpperCase()] ?? provider;
  }

  const method = payment.payment_method?.trim().toLowerCase();
  return methodLabels[method ?? ""] ?? payment.payment_method ?? "Unknown";
}

/** How the payment entered Falco — separate from Method. */
export function paymentSourceLabel(payment: PaymentLike): "Automatic" | "Manual" {
  const raw = payment.source ?? payment.metadata?.source;
  const source = raw == null ? "" : String(raw).toLowerCase();
  return AUTOMATIC_SOURCES.has(source) ? "Automatic" : "Manual";
}
